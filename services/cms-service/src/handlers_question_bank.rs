use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::models::{
    CreateQuestionBankPayload, ImportQuestionFromMySQLPayload, QuestionBank, QuestionBankFilters,
    QuestionBankType, UpdateQuestionBankPayload,
};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

const QUESTION_BANK_SELECT_COLUMNS: &str = r#"
id,
organization_id,
question_text,
question_type,
options,
correct_answer,
explanation,
audio_url,
audio_text,
audio_status,
audio_metadata,
media_url,
media_type,
points,
difficulty,
tags,
skill_assessed,
source,
source_metadata,
imported_mysql_id,
imported_mysql_course_id,
usage_count,
last_used_at,
is_active,
is_archived,
created_by,
created_at,
updated_at,
embedding::text AS embedding,
embedding_updated_at,
source_asset_id,
unit_number
"#;

fn normalize_answer_keywords_value(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Array(items) => serde_json::Value::Array(
            items
                .into_iter()
                .map(normalize_answer_keywords_value)
                .collect(),
        ),
        serde_json::Value::Object(map) => {
            let answer_text = map
                .get("answer")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            if map.contains_key("keywords") {
                if let Some(answer) = answer_text {
                    return serde_json::Value::String(answer);
                }
            }

            let normalized_map = map
                .into_iter()
                .map(|(k, v)| (k, normalize_answer_keywords_value(v)))
                .collect();

            serde_json::Value::Object(normalized_map)
        }
        other => other,
    }
}

fn normalize_question_bank_payload_values(
    options: Option<serde_json::Value>,
    correct_answer: Option<serde_json::Value>,
) -> (Option<serde_json::Value>, Option<serde_json::Value>) {
    (
        options.map(normalize_answer_keywords_value),
        correct_answer.map(normalize_answer_keywords_value),
    )
}

async fn connect_mysql_pool(env_var: &str) -> Result<sqlx::MySqlPool, (StatusCode, String)> {
    use sqlx::mysql::MySqlPoolOptions;

    let mysql_url = std::env::var(env_var)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let mut last_error = String::new();

    for attempt in 1..=3 {
        let result = MySqlPoolOptions::new()
            // Keep per-request pools small to avoid exhausting remote MySQL.
            .max_connections(2)
            .min_connections(0)
            .acquire_timeout(std::time::Duration::from_secs(15))
            .idle_timeout(std::time::Duration::from_secs(30))
            .max_lifetime(std::time::Duration::from_secs(300))
            .connect(&mysql_url)
            .await;

        match result {
            Ok(pool) => return Ok(pool),
            Err(e) => {
                last_error = e.to_string();
                tracing::warn!(
                    "Intento de conexión a MySQL {}/3 fallido para {}: {}",
                    attempt,
                    env_var,
                    last_error
                );

                if attempt < 3 {
                    tokio::time::sleep(std::time::Duration::from_secs(2 * attempt)).await;
                }
            }
        }
    }

    Err((
        StatusCode::INTERNAL_SERVER_ERROR,
        format!(
            "Error al conectar a MySQL tras 3 intentos: {}",
            last_error
        ),
    ))
}

// ==================== Planes de Estudio y Cursos de MySQL ====================

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct MySqlStudyPlan {
    pub id: i32,
    pub mysql_id: i32,
    pub organization_id: Uuid,
    pub name: String,
    pub course_type: String,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct MySqlCourse {
    pub id: i32,
    pub mysql_id: i32,
    pub organization_id: Uuid,
    pub study_plan_id: i32,
    pub name: String,
    pub level: Option<i32>,
    pub course_type: String,
    pub level_calculated: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Guardar o actualizar planes de estudio y cursos de MySQL durante la importación
pub async fn save_mysql_courses_and_plans(
    pool: &PgPool,
    org_id: Uuid,
    plans: Vec<MySqlPlanInfo>,
    courses: Vec<MySqlCourseInfo>,
) -> Result<(), String> {
    let plans_count = plans.len();
    let courses_count = courses.len();
    tracing::info!("Guardando {} planes de estudio y {} cursos de MySQL", plans_count, courses_count);
    
    // Guardar planes de estudio primero
    for plan in plans {
        let course_type = calculate_course_type(&plan.nombre_plan);
        tracing::debug!("Guardando plan de estudios: {} (ID: {})", plan.nombre_plan, plan.id_plan_de_estudios);

        // Reflejar la estructura SAM en PostgreSQL usando nombres de columna nativos de SAM.
        sqlx::query(
            r#"
            INSERT INTO sam_study_plans (organization_id, idPlanDeEstudios, Nombre, Activo)
            VALUES ($1, $2, $3, TRUE)
            ON CONFLICT (organization_id, idPlanDeEstudios) DO UPDATE SET
                Nombre = EXCLUDED.Nombre,
                Activo = EXCLUDED.Activo,
                updated_at = NOW()
            "#
        )
        .bind(org_id)
        .bind(plan.id_plan_de_estudios)
        .bind(&plan.nombre_plan)
        .execute(pool)
        .await
        .map_err(|e| format!("Error al guardar el reflejo del plan de estudios SAM: {}", e))?;

        sqlx::query(
            r#"
            INSERT INTO mysql_study_plans (mysql_id, organization_id, name, course_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (mysql_id) DO UPDATE SET
                name = EXCLUDED.name,
                course_type = EXCLUDED.course_type,
                updated_at = NOW()
            "#
        )
        .bind(plan.id_plan_de_estudios)
        .bind(org_id)
        .bind(&plan.nombre_plan)
        .bind(&course_type)
        .execute(pool)
        .await
        .map_err(|e| format!("Error al guardar el plan de estudios: {}", e))?;
    }

    // Guardar cursos
    for course in courses {
        // Determinar el course_type a partir de la duración (40h = regular, 80h = intensivo)
        let course_type = calculate_course_type_from_duration(course.duracion);
        let level_calculated = calculate_course_level(course.nivel_curso);
        tracing::debug!("Guardando curso: {} (ID: {}, ID de Plan: {})", course.nombre_curso, course.id_cursos, course.id_plan_de_estudios);

        sqlx::query(
            r#"
            INSERT INTO sam_courses (
                organization_id, idCursos, idPlanDeEstudios, NombreCurso, NivelCurso, Duracion, Activo
            )
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            ON CONFLICT (organization_id, idCursos) DO UPDATE SET
                idPlanDeEstudios = EXCLUDED.idPlanDeEstudios,
                NombreCurso = EXCLUDED.NombreCurso,
                NivelCurso = EXCLUDED.NivelCurso,
                Duracion = EXCLUDED.Duracion,
                Activo = EXCLUDED.Activo,
                updated_at = NOW()
            "#,
        )
        .bind(org_id)
        .bind(course.id_cursos)
        .bind(course.id_plan_de_estudios)
        .bind(&course.nombre_curso)
        .bind(course.nivel_curso)
        .bind(course.duracion)
        .execute(pool)
        .await
        .map_err(|e| format!("Error al guardar el reflejo del curso SAM: {}", e))?;

        // Obtener study_plan_id de mysql_study_plans
        let study_plan_id: i32 = sqlx::query_scalar(
            "SELECT id FROM mysql_study_plans WHERE mysql_id = $1 AND organization_id = $2"
        )
        .bind(course.id_plan_de_estudios)
        .bind(org_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Error al encontrar el plan de estudios: {}", e))?;

        sqlx::query(
            r#"
            INSERT INTO mysql_courses (
                mysql_id, organization_id, study_plan_id, name, level, duracion,
                course_type, level_calculated
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (mysql_id) DO UPDATE SET
                name = EXCLUDED.name,
                level = EXCLUDED.level,
                duracion = EXCLUDED.duracion,
                course_type = EXCLUDED.course_type,
                level_calculated = EXCLUDED.level_calculated,
                updated_at = NOW()
            "#
        )
        .bind(course.id_cursos)
        .bind(org_id)
        .bind(study_plan_id)
        .bind(&course.nombre_curso)
        .bind(course.nivel_curso)
        .bind(course.duracion)
        .bind(&course_type)
        .bind(&level_calculated)
        .execute(pool)
        .await
        .map_err(|e| format!("Error al guardar el curso: {}", e))?;
    }

    tracing::info!("Se guardaron con éxito {} planes de estudio y {} cursos", plans_count, courses_count);
    Ok(())
}

fn calculate_course_type(plan_name: &str) -> String {
    let plan_lower = plan_name.to_lowercase();
    if plan_lower.contains("intensive") || plan_lower.contains("intensivo") {
        "intensive".to_string()
    } else {
        "regular".to_string()
    }
}

fn calculate_course_type_from_duration(duracion: Option<f64>) -> String {
    match duracion {
        Some(d) if d as i64 >= 70 => "intensive".to_string(),  // 80h or more = intensive
        _ => "regular".to_string(),  // 40h or less = regular
    }
}

fn calculate_course_level(nivel: Option<i32>) -> String {
    match nivel {
        None => "intermediate".to_string(),
        Some(n) if n <= 2 => "beginner".to_string(),
        Some(n) if n <= 4 => "beginner_1".to_string(),
        Some(n) if n <= 6 => "beginner_2".to_string(),
        Some(n) if n <= 8 => "intermediate".to_string(),
        Some(n) if n <= 10 => "intermediate_1".to_string(),
        Some(n) if n <= 12 => "intermediate_2".to_string(),
        Some(_) => "advanced".to_string(),
    }
}

// ==================== Crear ====================

/// POST /api/question-bank - Crear una nueva pregunta en el banco
pub async fn create_question(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateQuestionBankPayload>,
) -> Result<Json<QuestionBank>, (StatusCode, String)> {
    let CreateQuestionBankPayload {
        question_text,
        question_type,
        options,
        correct_answer,
        explanation,
        points,
        difficulty,
        tags,
        media_url,
        media_type,
        skill_assessed,
    } = payload;

    let (normalized_options, normalized_correct_answer) =
        normalize_question_bank_payload_values(options, correct_answer);

    let create_question_sql = format!(
        r#"
        INSERT INTO question_bank (
            organization_id, created_by, question_text, question_type,
            options, correct_answer, explanation, points, difficulty,
            tags, skill_assessed, media_url, media_type, audio_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
        RETURNING {}
        "#,
        QUESTION_BANK_SELECT_COLUMNS
    );

    let question: QuestionBank = sqlx::query_as(
        &create_question_sql
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(&question_text)
    .bind(&question_type)
    .bind(&normalized_options)
    .bind(&normalized_correct_answer)
    .bind(&explanation)
    .bind(points.unwrap_or(1))
    .bind(difficulty.as_deref().unwrap_or("medium"))
    .bind(tags.as_deref())
    .bind(skill_assessed.as_deref())
    .bind(media_url.as_deref())
    .bind(media_type.as_deref())
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(question))
}

// ==================== Listar ====================

/// GET /api/question-bank - Listar preguntas con filtros
pub async fn list_questions(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<QuestionBankFilters>,
) -> Result<Json<Vec<QuestionBank>>, (StatusCode, String)> {
    let questions = if filters.question_type.is_none() 
        && filters.difficulty.is_none() 
        && filters.source.is_none()
        && filters.search.is_none()
        && filters.has_audio.is_none()
    {
        // Sin filtros - consulta simple
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    } else if filters.question_type.is_some() {
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND question_type = $2 ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .bind(filters.question_type.unwrap())
        .fetch_all(&pool)
        .await
    } else if filters.difficulty.is_some() {
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND difficulty = $2 ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .bind(filters.difficulty.as_ref().unwrap())
        .fetch_all(&pool)
        .await
    } else if filters.source.is_some() {
        let source_filter = filters.source.as_ref().unwrap().to_lowercase();
        match source_filter.as_str() {
            "mysql" => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source IN ('imported-mysql', 'sam-diagnostico') ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
            }
            "materials" | "materials-zip" => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source = 'imported-material' ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
            }
            "ai" => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source IN ('ai-generated', 'rag-ai') ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
            }
            _ => {
                sqlx::query_as::<_, QuestionBank>(
                    &format!(
                        "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND source = $2 ORDER BY created_at DESC",
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .bind(filters.source.as_ref().unwrap())
                .fetch_all(&pool)
                .await
            }
        }
    } else if filters.has_audio == Some(true) {
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false AND audio_status = 'ready' ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    } else {
        // Default fallback
        sqlx::query_as::<_, QuestionBank>(
            &format!(
                "SELECT {} FROM question_bank WHERE organization_id = $1 AND is_archived = false ORDER BY created_at DESC",
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    }
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(questions))
}

// ==================== Obtener ====================

/// GET /api/question-bank/{id} - Obtener una sola pregunta
pub async fn get_question(
    Org(org_ctx): Org,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<QuestionBank>, (StatusCode, String)> {
    let get_question_sql = format!(
        r#"
        SELECT {} FROM question_bank
        WHERE id = $1 AND organization_id = $2 AND is_archived = false
        "#,
        QUESTION_BANK_SELECT_COLUMNS
    );

    let question: QuestionBank = sqlx::query_as(
        &get_question_sql
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Pregunta no encontrada".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()),
    })?;

    Ok(Json(question))
}

// ==================== Actualizar ====================

/// PUT /api/question-bank/{id} - Actualizar una pregunta
pub async fn update_question(
    Org(org_ctx): Org,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateQuestionBankPayload>,
) -> Result<Json<QuestionBank>, (StatusCode, String)> {
    let UpdateQuestionBankPayload {
        question_text,
        question_type,
        options,
        correct_answer,
        explanation,
        points,
        difficulty,
        tags,
        is_active,
        is_archived,
    } = payload;

    let (normalized_options, normalized_correct_answer) =
        normalize_question_bank_payload_values(options, correct_answer);

    let update_question_sql = format!(
        r#"
        UPDATE question_bank
        SET
            question_text = COALESCE($3, question_text),
            question_type = COALESCE($4, question_type),
            options = COALESCE($5, options),
            correct_answer = COALESCE($6, correct_answer),
            explanation = COALESCE($7, explanation),
            points = COALESCE($8, points),
            difficulty = COALESCE($9, difficulty),
            tags = COALESCE($10, tags),
            is_active = COALESCE($11, is_active),
            is_archived = COALESCE($12, is_archived),
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING {}
        "#,
        QUESTION_BANK_SELECT_COLUMNS
    );

    let question: QuestionBank = sqlx::query_as(
        &update_question_sql
    )
    .bind(id)
    .bind(org_ctx.id)
    .bind(question_text)
    .bind(question_type.map(|t| t.to_string()))
    .bind(&normalized_options)
    .bind(&normalized_correct_answer)
    .bind(&explanation)
    .bind(points)
    .bind(difficulty)
    .bind(tags.as_deref())
    .bind(is_active)
    .bind(is_archived)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Pregunta no encontrada".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()),
    })?;

    Ok(Json(question))
}

// ==================== Eliminar ====================

/// DELETE /api/question-bank/{id} - Eliminar (archivar) una pregunta
pub async fn delete_question(
    Org(org_ctx): Org,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        r#"
        UPDATE question_bank
        SET is_archived = true, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Pregunta no encontrada".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Importar desde MySQL ====================

/// POST /api/question-bank/import-mysql - Importar preguntas desde el banco de preguntas de MySQL
pub async fn import_from_mysql(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ImportQuestionFromMySQLPayload>,
) -> Result<Json<Vec<QuestionBank>>, (StatusCode, String)> {
    use serde_json::json;
    
    // Conectar a MySQL
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;

    // Obtener todos los planes de estudio y cursos de MySQL para sincronizarlos
    let mysql_plans: Vec<MySqlPlanInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan
        FROM plandeestudios pe
        WHERE pe.Activo = 1
        ORDER BY pe.Nombre
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| {
        let error_msg = format!("Error al obtener: {}", e);
        tracing::error!("Error de MySQL: {}", error_msg);
        tracing::error!("Verifique los nombres de las columnas en su base de datos MySQL (tablas plandeestudios, curso)");
        (StatusCode::INTERNAL_SERVER_ERROR, error_msg)
    })?;

    tracing::info!("Se obtuvieron {} planes de estudio de MySQL", mysql_plans.len());

    let mysql_courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.Activo = 1
          AND pe.Activo = 1
        ORDER BY pe.Nombre, c.NivelCurso
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    tracing::info!("Se obtuvieron {} cursos de MySQL", mysql_courses.len());

    // Guardar planes y cursos en PostgreSQL
    tracing::info!("Guardando planes y cursos en PostgreSQL...");
    save_mysql_courses_and_plans(&pool, org_ctx.id, mysql_plans, mysql_courses)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener preguntas de MySQL
    let mysql_questions: Vec<MySqlQuestion> = if payload.import_all.unwrap_or(false) {
        // Importar TODAS las preguntas (sin límite)
        sqlx::query_as(
            r#"
            SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                   c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.activo = 1
              AND c.Activo = 1
              AND pe.Activo = 1
            ORDER BY bp.idPregunta
            "#
        )
        .fetch_all(&mysql_pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    } else if let Some(course_id) = payload.mysql_course_id {
        // Importar todas las preguntas para un curso específico (sin límite)
        sqlx::query_as(
            r#"
            SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                   c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
            FROM bancopreguntas bp
            JOIN curso c ON bp.idCursos = c.idCursos
            JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE bp.idCursos = ? AND bp.activo = 1
              AND c.Activo = 1
              AND pe.Activo = 1
            ORDER BY bp.idPregunta
            "#
        )
        .bind(course_id)
        .fetch_all(&mysql_pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    } else if let Some(question_ids) = payload.question_ids {
        // Obtener IDs de preguntas específicas - usar enfoque simple
        let mut imported_questions: Vec<QuestionBank> = vec![];
        
        for q_id in question_ids {
            let mq: Option<MySqlQuestion> = sqlx::query_as(
                r#"
                SELECT bp.idPregunta, bp.descripcion, bp.idTipoPregunta, bp.activo,
                       c.idCursos, c.NombreCurso, pe.idPlanDeEstudios, pe.Nombre as PlanNombre
                FROM bancopreguntas bp
                JOIN curso c ON bp.idCursos = c.idCursos
                JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
                WHERE bp.idPregunta = ? AND bp.activo = 1
                  AND c.Activo = 1
                  AND pe.Activo = 1
                "#
            )
            .bind(q_id)
            .fetch_optional(&mysql_pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
            
            if let Some(question) = mq {
                // Mapear el tipo de pregunta de MySQL al tipo de pregunta de la plataforma
                let question_type = map_mysql_question_type(question.id_tipo_pregunta, None);

                let options = if question_type == QuestionBankType::MultipleChoice {
                    Some(json!(["Opción A", "Opción B", "Opción C", "Opción D"]))
                } else if question_type == QuestionBankType::TrueFalse {
                    Some(json!(["Verdadero", "Falso"]))
                } else {
                    None
                };
                
                let source_metadata = json!({
                    "mysql_table": "bancopreguntas",
                    "idPregunta": question.id_pregunta,
                    "idCursos": question.id_cursos,
                    "nombre_curso": question.nombre_curso,
                    "idPlanDeEstudios": question.id_plan_de_estudios,
                    "plan_nombre": question.plan_nombre,
                    "idTipoPregunta": question.id_tipo_pregunta,
                    "imported_at": chrono::Utc::now().to_rfc3339(),
                });
                
                let qb: QuestionBank = sqlx::query_as(
                    &format!(
                        r#"
                        INSERT INTO question_bank (
                            organization_id, created_by, question_text, question_type,
                            options, correct_answer, source, source_metadata,
                            audio_status, is_active
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, 'pending', true)
                        RETURNING {}
                        "#,
                        QUESTION_BANK_SELECT_COLUMNS
                    )
                )
                .bind(org_ctx.id)
                .bind(claims.sub)
                .bind(&question.descripcion)
                .bind(&question_type)
                .bind(&options)
                .bind(&serde_json::Value::Null)
                .bind(&source_metadata)
                .fetch_one(&pool)
                .await
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
                
                imported_questions.push(qb);
            }
        }
        
        mysql_pool.close().await;
        return Ok(Json(imported_questions));
    } else {
        return Err((StatusCode::BAD_REQUEST, "Debe proporcionar course_id, question_ids o import_all".to_string()));
    };
    
    mysql_pool.close().await;
    
    if mysql_questions.is_empty() {
        return Err((StatusCode::NOT_FOUND, "No se encontraron preguntas en MySQL para importar".to_string()));
    }
    
    // Importar preguntas a PostgreSQL
    let mut imported_questions: Vec<QuestionBank> = vec![];
    let mut skipped_count = 0;

    for mq in mysql_questions {
        // Comprobar si la pregunta ya ha sido importada
        let exists: (bool,) = sqlx::query_as(
            "SELECT EXISTS(SELECT 1 FROM question_bank WHERE imported_mysql_id = $1 AND organization_id = $2)"
        )
        .bind(mq.id_pregunta)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

        if exists.0 {
            skipped_count += 1;
            continue; // Omitir pregunta ya importada
        }

        // Mapear el tipo de pregunta de MySQL al tipo de pregunta de la plataforma
        let question_type = map_mysql_question_type(mq.id_tipo_pregunta, None);

        // Crear opciones para opción múltiple (si corresponde)
        let options = if question_type == QuestionBankType::MultipleChoice {
            Some(json!(["Opción A", "Opción B", "Opción C", "Opción D"]))
        } else if question_type == QuestionBankType::TrueFalse {
            Some(json!(["Verdadero", "Falso"]))
        } else {
            None
        };

        let source_metadata = json!({
            "mysql_table": "bancopreguntas",
            "idPregunta": mq.id_pregunta,
            "idCursos": mq.id_cursos,
            "nombre_curso": mq.nombre_curso,
            "idPlanDeEstudios": mq.id_plan_de_estudios,
            "plan_nombre": mq.plan_nombre,
            "idTipoPregunta": mq.id_tipo_pregunta,
            "imported_at": chrono::Utc::now().to_rfc3339(),
        });

        let question: QuestionBank = sqlx::query_as(
            &format!(
                r#"
                INSERT INTO question_bank (
                    organization_id, created_by, question_text, question_type,
                    options, correct_answer, source, source_metadata,
                    imported_mysql_id, imported_mysql_course_id,
                    audio_status, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, $8, $9, 'pending', true)
                RETURNING {}
                "#,
                QUESTION_BANK_SELECT_COLUMNS
            )
        )
        .bind(org_ctx.id)
        .bind(claims.sub)
        .bind(&mq.descripcion)
        .bind(&question_type)
        .bind(&options)
        .bind(&serde_json::Value::Null) // Respuesta correcta para que el usuario la complete
        .bind(&source_metadata)
        .bind(mq.id_pregunta)
        .bind(mq.id_cursos)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

        imported_questions.push(question);
    }

    tracing::info!("Se importaron {} preguntas de MySQL (se omitieron {} ya importadas)", imported_questions.len(), skipped_count);

    Ok(Json(imported_questions))
}

// ==================== Auxiliares ====================

fn map_mysql_question_type(mysql_type: i32, tipo_nombre: Option<&str>) -> QuestionBankType {
    // Mapear tipos de preguntas de MySQL a tipos de plataforma
    // Primero intentar por nombre, luego por ID como respaldo
    if let Some(nombre) = tipo_nombre {
        let nombre_lower = nombre.to_lowercase();
        if nombre_lower.contains("selecc") || nombre_lower.contains("múltiple") || nombre_lower.contains("multiple") || nombre_lower.contains("alternativa") {
            return QuestionBankType::MultipleChoice;
        }
        if nombre_lower.contains("verdadero") || nombre_lower.contains("falso") {
            return QuestionBankType::TrueFalse;
        }
        if nombre_lower.contains("emparej") || nombre_lower.contains("match") {
            return QuestionBankType::Matching;
        }
        if nombre_lower.contains("orden") {
            return QuestionBankType::Ordering;
        }
        if nombre_lower.contains("complet") {
            return QuestionBankType::FillInTheBlanks;
        }
        if nombre_lower.contains("ensayo") || nombre_lower.contains("essay") {
            return QuestionBankType::Essay;
        }
        if nombre_lower.contains("corta") || nombre_lower.contains("short") || nombre_lower.contains("texto") {
            return QuestionBankType::ShortAnswer;
        }
        // El tipo audio en MySQL suele ser comprensión auditiva con respuestas de opción múltiple
        if nombre_lower.contains("audio") || nombre_lower.contains("listening") {
            return QuestionBankType::MultipleChoice;
        }
    }

    // Respaldo al mapeo por ID
    match mysql_type {
        1 => QuestionBankType::MultipleChoice, // Alternativa
        2 => QuestionBankType::MultipleChoice, // Audio (listening comprehension)
        3 => QuestionBankType::ShortAnswer,    // Texto
        4 => QuestionBankType::Matching,
        5 => QuestionBankType::Ordering,
        6 => QuestionBankType::FillInTheBlanks,
        7 => QuestionBankType::Essay,
        _ => QuestionBankType::MultipleChoice,
    }
}

/// Analizar el JSON de respuestas de MySQL y extraer opciones y respuesta correcta
fn parse_mysql_answers(
    answers_json: Option<&str>,
    question_type: QuestionBankType,
) -> (Option<serde_json::Value>, Option<serde_json::Value>) {
    if let Some(json_str) = answers_json {
        if let Ok(answers) = serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
            if !answers.is_empty() {
                // Extraer opciones (todos los textos de respuesta)
                let options: Vec<String> = answers
                    .iter()
                    .filter_map(|a| a.get("texto").and_then(|t| t.as_str()).map(String::from))
                    .collect();
                
                // Extraer respuesta(s) correcta(s)
                let correct_indices: Vec<usize> = answers
                    .iter()
                    .enumerate()
                    .filter(|(_, a)| a.get("es_correcta").and_then(|c| c.as_bool()).unwrap_or(false))
                    .map(|(i, _)| i)
                    .collect();
                
                let options_json = if !options.is_empty() {
                    Some(serde_json::json!(options))
                } else {
                    None
                };
                
                let correct_answer = if question_type == QuestionBankType::TrueFalse || 
                    question_type == QuestionBankType::MultipleChoice {
                    // Para opción múltiple, guardar índice/índices
                    if correct_indices.len() == 1 {
                        Some(serde_json::json!(correct_indices[0]))
                    } else if correct_indices.len() > 1 {
                        Some(serde_json::json!(correct_indices))
                    } else {
                        Some(serde_json::json!(0)) // Por defecto a la primera
                    }
                } else {
                    // Para otros tipos, guardar el texto
                    correct_indices.first()
                        .and_then(|&i| answers.get(i))
                        .and_then(|a| a.get("texto").and_then(|t| t.as_str()))
                        .map(|t| serde_json::json!(t))
                };
                
                return (options_json, correct_answer);
            }
        }
    }
    
    // Valores por defecto si no se proporcionan respuestas
    let default_options = match question_type {
        QuestionBankType::MultipleChoice => Some(serde_json::json!(["Opción A", "Opción B", "Opción C", "Opción D"])),
        QuestionBankType::TrueFalse => Some(serde_json::json!(["Verdadero", "Falso"])),
        _ => None,
    };
    
    (default_options, Some(serde_json::json!(0)))
}

// ==================== Integración con MySQL ====================

/// GET /api/question-bank/mysql-courses - Listar cursos de MySQL para importación
#[allow(dead_code)]
pub async fn list_mysql_courses(
    Org(_org_ctx): Org,
    State(_pool): State<PgPool>,
) -> Result<Json<Vec<MySqlCourseInfo>>, (StatusCode, String)> {
    // Conectar a MySQL
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;
    
    // Obtener cursos con sus nombres de plan
    let courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.Activo = 1
          AND pe.Activo = 1
        ORDER BY pe.Nombre, c.NivelCurso
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    mysql_pool.close().await;
    
    Ok(Json(courses))
}

/// GET /api/question-bank/mysql-plans - Obtener todos los planes de estudio de PostgreSQL (importados de MySQL)
pub async fn get_mysql_plans(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<MySqlPlanInfo>>, (StatusCode, String)> {
    // Leer del reflejo SAM en PostgreSQL con campos nativos de SAM.
    let mut plans: Vec<MySqlPlanInfo> = sqlx::query_as(
        r#"
        SELECT
            idPlanDeEstudios AS id_plan_de_estudios,
            Nombre AS nombre_plan
        FROM sam_study_plans
        WHERE organization_id = $1 AND Activo = TRUE
        ORDER BY Nombre
        "#
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Respaldo compatible con versiones anteriores: si el reflejo SAM está vacío, usar el reflejo de metadatos heredado.
    if plans.is_empty() {
        plans = sqlx::query_as(
            r#"
            SELECT
                mysql_id AS id_plan_de_estudios,
                name AS nombre_plan
            FROM mysql_study_plans
            WHERE organization_id = $1 AND is_active = TRUE
            ORDER BY name
            "#,
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    }

    // Auto-sincronización de último recurso: si sigue vacío, obtener metadatos de MySQL y persistirlos.
    if plans.is_empty() {
        match connect_mysql_pool("MYSQL_DATABASE_URL").await {
            Ok(mysql_pool) => {
                let mysql_plans: Result<Vec<MySqlPlanInfo>, sqlx::Error> = sqlx::query_as(
                    r#"
                    SELECT DISTINCT
                        pe.idPlanDeEstudios AS id_plan_de_estudios,
                        pe.Nombre AS nombre_plan
                    FROM plandeestudios pe
                    WHERE pe.Activo = 1
                    ORDER BY pe.Nombre
                    "#,
                )
                .fetch_all(&mysql_pool)
                .await;

                let mysql_courses: Result<Vec<MySqlCourseInfo>, sqlx::Error> = sqlx::query_as(
                    r#"
                    SELECT DISTINCT
                        c.idCursos AS id_cursos,
                        c.NombreCurso AS nombre_curso,
                        c.NivelCurso AS nivel_curso,
                        pe.idPlanDeEstudios AS id_plan_de_estudios,
                        pe.Nombre AS nombre_plan,
                        c.Duracion AS duracion
                    FROM curso c
                    JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
                    WHERE c.Activo = 1
                      AND pe.Activo = 1
                    ORDER BY pe.Nombre, c.NivelCurso
                    "#,
                )
                .fetch_all(&mysql_pool)
                .await;

                match (mysql_plans, mysql_courses) {
                    (Ok(p), Ok(c)) => {
                        if let Err(err) = save_mysql_courses_and_plans(&pool, org_ctx.id, p, c).await {
                            tracing::warn!("Fallo la auto-sincronización de metadatos de MySQL: {}", err);
                        }
                    }
                    (Err(e), _) => tracing::warn!("Fallo la consulta de planes de auto-sincronización: {}", e),
                    (_, Err(e)) => tracing::warn!("Fallo la consulta de cursos de auto-sincronización: {}", e),
                }

                mysql_pool.close().await;
            }
            Err(e) => {
                tracing::warn!("La auto-sincronización no pudo conectarse a MySQL: {:?}", e);
            }
        }

        // Recargar planes tras el intento de auto-sincronización.
        plans = sqlx::query_as(
            r#"
            SELECT
                idPlanDeEstudios AS id_plan_de_estudios,
                Nombre AS nombre_plan
            FROM sam_study_plans
            WHERE organization_id = $1 AND Activo = TRUE
            ORDER BY Nombre
            "#,
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        if plans.is_empty() {
            plans = sqlx::query_as(
                r#"
                SELECT
                    mysql_id AS id_plan_de_estudios,
                    name AS nombre_plan
                FROM mysql_study_plans
                WHERE organization_id = $1 AND is_active = TRUE
                ORDER BY name
                "#,
            )
            .bind(org_ctx.id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default();
        }
    }

    Ok(Json(plans))
}

/// GET /api/question-bank/mysql-courses - Obtener cursos filtrados por plan de PostgreSQL
pub async fn get_mysql_courses_by_plan(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<MySqlCoursesFilters>,
) -> Result<Json<Vec<MySqlCourseInfo>>, (StatusCode, String)> {
    // Leer del reflejo SAM en PostgreSQL con campos nativos de SAM.
    let mut courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            c.idPlanDeEstudios AS id_plan_de_estudios,
            p.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM sam_courses c
        JOIN sam_study_plans p
          ON p.organization_id = c.organization_id
         AND p.idPlanDeEstudios = c.idPlanDeEstudios
        WHERE c.organization_id = $1
          AND c.Activo = TRUE
          AND p.Activo = TRUE
          AND c.idPlanDeEstudios = $2
        ORDER BY c.NivelCurso
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.plan_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Intentar refrescar desde MySQL (fuente SAM) para evitar listas incompletas por espejo desactualizado.
    if let Ok(mysql_pool) = connect_mysql_pool("MYSQL_DATABASE_URL").await {
        let live_courses: Result<Vec<MySqlCourseInfo>, sqlx::Error> = sqlx::query_as(
            r#"
            SELECT DISTINCT
                c.idCursos AS id_cursos,
                c.NombreCurso AS nombre_curso,
                c.NivelCurso AS nivel_curso,
                pe.idPlanDeEstudios AS id_plan_de_estudios,
                pe.Nombre AS nombre_plan,
                c.Duracion AS duracion
            FROM curso c
            JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
            WHERE c.Activo = 1
              AND pe.Activo = 1
              AND pe.idPlanDeEstudios = ?
            ORDER BY c.NivelCurso, c.NombreCurso
            "#,
        )
        .bind(filters.plan_id)
        .fetch_all(&mysql_pool)
        .await;

        match live_courses {
            Ok(live) if !live.is_empty() => {
                if live.len() != courses.len() {
                    tracing::info!(
                        "Refrescando cursos SAM desde MySQL para plan {}: espejo={} mysql={}",
                        filters.plan_id,
                        courses.len(),
                        live.len()
                    );
                }

                // Best effort: sincronizar también el plan consultado al espejo PostgreSQL.
                let live_plans: Result<Vec<MySqlPlanInfo>, sqlx::Error> = sqlx::query_as(
                    r#"
                    SELECT DISTINCT
                        pe.idPlanDeEstudios AS id_plan_de_estudios,
                        pe.Nombre AS nombre_plan
                    FROM plandeestudios pe
                    WHERE pe.Activo = 1
                      AND pe.idPlanDeEstudios = ?
                    "#,
                )
                .bind(filters.plan_id)
                .fetch_all(&mysql_pool)
                .await;

                if let Ok(plan_rows) = live_plans {
                    if !plan_rows.is_empty() {
                        if let Err(err) = save_mysql_courses_and_plans(&pool, org_ctx.id, plan_rows, live.clone()).await {
                            tracing::warn!(
                                "No se pudo actualizar espejo SAM para plan {}: {}",
                                filters.plan_id,
                                err
                            );
                        }
                    }
                }

                courses = live;
            }
            Ok(_) => {
                tracing::debug!(
                    "MySQL devolvio 0 cursos activos para plan {}; se mantiene espejo local",
                    filters.plan_id
                );
            }
            Err(err) => {
                tracing::warn!(
                    "No se pudo refrescar cursos SAM desde MySQL para plan {}: {}",
                    filters.plan_id,
                    err
                );
            }
        }

        mysql_pool.close().await;
    }

    // Respaldo compatible con versiones anteriores: si el reflejo SAM está vacío, usar el reflejo de metadatos heredado.
    if courses.is_empty() {
        courses = sqlx::query_as(
            r#"
            SELECT
                c.mysql_id AS id_cursos,
                c.name AS nombre_curso,
                c.level AS nivel_curso,
                sp.mysql_id AS id_plan_de_estudios,
                sp.name AS nombre_plan,
                c.duracion::double precision AS duracion
            FROM mysql_courses c
            JOIN mysql_study_plans sp ON c.study_plan_id = sp.id
            WHERE c.organization_id = $1
              AND c.is_active = TRUE
              AND sp.is_active = TRUE
              AND sp.mysql_id = $2
            ORDER BY c.level
            "#,
        )
        .bind(org_ctx.id)
        .bind(filters.plan_id)
        .fetch_all(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    }

    Ok(Json(courses))
}

#[derive(Debug, Deserialize)]
pub struct MySqlCoursesFilters {
    pub plan_id: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MySqlPlanInfo {
    pub id_plan_de_estudios: i32,
    pub nombre_plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MySqlCourseInfo {
    pub id_cursos: i32,
    pub nombre_curso: String,
    pub nivel_curso: Option<i32>,
    pub id_plan_de_estudios: i32,
    pub nombre_plan: String,
    pub duracion: Option<f64>,  // Duración en horas (40=regular, 80=intensivo) - Tipo float de MySQL
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportAllFromMySQLPayload {
    pub import_metadata_only: Option<bool>,  // Solo importar metadatos (cursos/planes), no preguntas
}

/// POST /api/question-bank/import-mysql-all - Importar TODAS las preguntas de MySQL (importación masiva)
pub async fn import_all_from_mysql(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    body: String,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    use serde_json::json;

    // Analizar el cuerpo JSON opcional
    let import_metadata_only = if body.trim().is_empty() {
        false
    } else {
        serde_json::from_str::<ImportAllFromMySQLPayload>(&body)
            .map(|p| p.import_metadata_only.unwrap_or(false))
            .unwrap_or(false)
    };

    // Conectar a MySQL
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;

    // Obtener todos los planes de estudio y cursos de MySQL para sincronizarlos
    let mysql_plans: Vec<MySqlPlanInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan
        FROM plandeestudios pe
        WHERE pe.Activo = 1
        ORDER BY pe.Nombre
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|e| {
        let error_msg = format!("Error al obtener: {}", e);
        tracing::error!("Error de MySQL: {}", error_msg);
        tracing::error!("Verifique los nombres de las columnas en su base de datos MySQL (tablas plandeestudios, curso)");
        (StatusCode::INTERNAL_SERVER_ERROR, error_msg)
    })?;

    tracing::info!("Se obtuvieron {} planes de estudio de MySQL", mysql_plans.len());

    let mysql_courses: Vec<MySqlCourseInfo> = sqlx::query_as(
        r#"
        SELECT DISTINCT
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.Activo = 1
          AND pe.Activo = 1
        ORDER BY pe.Nombre, c.NivelCurso
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    tracing::info!("Se obtuvieron {} cursos de MySQL", mysql_courses.len());

    // Guardar planes y cursos en PostgreSQL
    tracing::info!("Guardando planes y cursos en PostgreSQL...");
    save_mysql_courses_and_plans(&pool, org_ctx.id, mysql_plans.clone(), mysql_courses.clone())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Si solo se solicita la importación de metadatos, salir antes
    if import_metadata_only {
        return Ok(Json(json!({
            "success": true,
            "message": "Metadatos importados exitosamente",
            "metadata": {
                "study_plans_imported": mysql_plans.len(),
                "courses_imported": mysql_courses.len(),
                "courses": mysql_courses.iter().map(|c| json!({
                    "id_cursos": c.id_cursos,
                    "nombre_curso": c.nombre_curso,
                    "nombre_plan": c.nombre_plan,
                    "duracion": c.duracion,
                    "nivel_curso": c.nivel_curso
                })).collect::<Vec<_>>()
            }
        })));
    }

    // Obtener TODAS las preguntas de MySQL con respuestas (usando agregación JSON para las respuestas)
    let mysql_questions: Vec<MySqlQuestionFull> = sqlx::query_as(
        r#"
        SELECT
            bp.idPregunta AS id_pregunta,
            bp.descripcion AS descripcion,
            bp.idTipoPregunta AS id_tipo_pregunta,
            bp.activo AS activo,
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS plan_nombre,
            tp.descripcion AS tipo_pregunta_nombre,
            CAST(
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'idRespuesta', br.idRespuesta,
                            'texto', br.descripcion,
                            'es_correcta', br.resultado = 1
                        )
                    )
                    FROM bancorespuestas br
                    WHERE br.idPregunta = bp.idPregunta
                    AND br.activo = 1
                ) AS CHAR
            ) AS respuestas_json
        FROM bancopreguntas bp
        JOIN curso c ON bp.idCursos = c.idCursos
        JOIN plandeestudios pe ON bp.idPlanDeEstudios = pe.idPlanDeEstudios
        JOIN tipopregunta tp ON bp.idTipoPregunta = tp.idTipoPregunta
        WHERE bp.activo = 1
          AND pe.Activo = 1
          AND c.Activo = 1
        ORDER BY pe.Nombre, c.NombreCurso, bp.idPregunta
        "#
    )
    .fetch_all(&mysql_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    mysql_pool.close().await;

    if mysql_questions.is_empty() {
        return Ok(Json(json!({
            "success": false,
            "imported": 0,
            "skipped": 0,
            "updated": 0,
            "error": "No se encontraron preguntas en MySQL"
        })));
    }
    
    // Importar preguntas a PostgreSQL
    let mut imported_count = 0;
    let mut skipped_count = 0;
    let mut updated_count = 0;
    
    for mq in mysql_questions {
        // Comprobar si la pregunta ya existe
        let existing: Option<(Uuid, bool)> = sqlx::query_as(
            "SELECT id, is_active FROM question_bank WHERE imported_mysql_id = $1 AND organization_id = $2"
        )
        .bind(mq.id_pregunta)
        .bind(org_ctx.id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
        
        match existing {
            Some((id, is_active)) => {
                // La pregunta existe - actualizar si estaba inactiva o tiene nuevos datos
                if !is_active {
                    // Reactivar y actualizar
                    let _ = sqlx::query(
                        "UPDATE question_bank SET is_active = true, question_text = $3, updated_at = NOW() WHERE id = $1 AND organization_id = $2"
                    )
                    .bind(id)
                    .bind(org_ctx.id)
                    .bind(&mq.descripcion)
                    .execute(&pool)
                    .await;
                    updated_count += 1;
                } else {
                    skipped_count += 1; // Ya existe y está activa, omitir
                }
            }
            None => {
                // Nueva pregunta - insertar con respuestas de MySQL
                let question_type = map_mysql_question_type(mq.id_tipo_pregunta, mq.tipo_pregunta_nombre.as_deref());
                
                // Analizar respuestas de MySQL
                let (options, correct_answer) = parse_mysql_answers(mq.respuestas_json.as_deref(), question_type);

                let has_answers = mq.respuestas_json.is_some();
                let question_type_name = mq.tipo_pregunta_nombre.clone();
                
                let source_metadata = serde_json::json!({
                    "mysql_table": "bancopreguntas",
                    "idPregunta": mq.id_pregunta,
                    "idCursos": mq.id_cursos,
                    "nombre_curso": mq.nombre_curso,
                    "nivel_curso": mq.nivel_curso,
                    "idPlanDeEstudios": mq.id_plan_de_estudios,
                    "plan_nombre": mq.plan_nombre,
                    "idTipoPregunta": mq.id_tipo_pregunta,
                    "tipo_pregunta_nombre": question_type_name,
                    "imported_at": chrono::Utc::now().to_rfc3339(),
                    "import_method": "bulk_import_all",
                    "has_answers": has_answers,
                });

                let _ = sqlx::query(
                    r#"
                    INSERT INTO question_bank (
                        organization_id, created_by, question_text, question_type,
                        options, correct_answer, source, source_metadata,
                        imported_mysql_id, imported_mysql_course_id,
                        audio_status, is_active
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'imported-mysql', $7, $8, $9, 'pending', true)
                    "#
                )
                .bind(org_ctx.id)
                .bind(claims.sub)
                .bind(&mq.descripcion)
                .bind(&question_type)
                .bind(&options)
                .bind(&correct_answer)
                .bind(&source_metadata)
                .bind(mq.id_pregunta)
                .bind(mq.id_cursos)
                .execute(&pool)
                .await;

                imported_count += 1;
            }
        }
    }
    
    tracing::info!(
        "Importación masiva desde MySQL: {} importadas, {} omitidas, {} actualizadas",
        imported_count,
        skipped_count,
        updated_count
    );

    Ok(Json(json!({
        "success": true,
        "imported": imported_count,
        "skipped": skipped_count,
        "updated": updated_count,
        "metadata": {
            "study_plans_imported": mysql_plans.len(),
            "courses_imported": mysql_courses.len()
        }
    })))
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct ImportResult {
    pub imported: i32,
    pub skipped: i32,
    pub updated: i32,
    pub error: Option<String>,
}

// Excel import - pendiente de fix
// /// POST /api/question-bank/import-excel - Import questions from Excel file
// pub async fn import_from_excel(
//     Org(org_ctx): Org,
//     claims: Claims,
//     State(pool): State<PgPool>,
//     multipart: axum::extract::Multipart,
// ) -> Result<Json<ImportResult>, (StatusCode, String)> {
//     // Implementation pending
//     unimplemented!()
// }

/// POST /question-bank/import-excel - Importar preguntas desde archivo Excel (.xlsx/.xls)
pub async fn import_from_excel(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<ImportResult>, (StatusCode, String)> {
    use calamine::{open_workbook_auto_from_rs, Reader};
    use std::io::Cursor;

    const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10 MB

    // Extraer el campo "file" del multipart
    let mut file_bytes: Option<Vec<u8>> = None;
    while let Some(field) = multipart.next_field().await.map_err(|_| {
        (StatusCode::BAD_REQUEST, "Error leyendo multipart".to_string())
    })? {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            let bytes = field.bytes().await.map_err(|_| {
                (StatusCode::BAD_REQUEST, "Error leyendo bytes del archivo".to_string())
            })?;
            if bytes.len() > MAX_FILE_SIZE {
                return Err((StatusCode::PAYLOAD_TOO_LARGE, "El archivo supera el límite de 10MB".to_string()));
            }
            file_bytes = Some(bytes.to_vec());
            break;
        }
    }

    let bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "No se recibió ningún archivo".to_string()))?;

    // Parsear el workbook
    let cursor = Cursor::new(bytes);
    let mut workbook = open_workbook_auto_from_rs(cursor).map_err(|_| {
        (StatusCode::BAD_REQUEST, "Archivo Excel inválido o no soportado".to_string())
    })?;

    let sheet_names = workbook.sheet_names().to_vec();
    let first_name = sheet_names.first().ok_or((StatusCode::BAD_REQUEST, "El archivo no contiene hojas".to_string()))?;
    let range = workbook.worksheet_range(first_name).map_err(|_| {
        (StatusCode::BAD_REQUEST, "No se pudo leer la hoja de cálculo".to_string())
    })?;

    let mut rows = range.rows();
    let header_row = rows.next().ok_or((StatusCode::BAD_REQUEST, "El archivo está vacío".to_string()))?;

    // Mapear índices de columnas por nombre (case-insensitive)
    let headers: Vec<String> = header_row.iter()
        .map(|c| c.to_string().trim().to_lowercase())
        .collect();

    let col = |name: &str| -> Option<usize> {
        headers.iter().position(|h| h == name)
    };

    let idx_question_text  = col("question_text");
    let idx_question_type  = col("question_type");
    let idx_options        = col("options");
    let idx_correct_answer = col("correct_answer");
    let idx_explanation    = col("explanation");
    let idx_difficulty     = col("difficulty");
    let idx_tags           = col("tags");
    let idx_points         = col("points");

    let get_cell = |row: &[calamine::Data], idx: Option<usize>| -> String {
        idx.and_then(|i| row.get(i))
            .map(|c: &calamine::Data| c.to_string().trim().to_string())
            .unwrap_or_default()
    };

    let to_question_type = |s: &str| -> Option<&'static str> {
        match s.to_lowercase().as_str() {
            "multiple-choice" | "multiple choice" | "mcq" => Some("multiple-choice"),
            "true-false" | "true false" | "boolean"       => Some("true-false"),
            "short-answer" | "short answer"                => Some("short-answer"),
            "essay"                                        => Some("essay"),
            "matching"                                     => Some("matching"),
            "ordering"                                     => Some("ordering"),
            "fill-in-the-blanks" | "fill in the blanks"   => Some("fill-in-the-blanks"),
            "audio-response" | "audio response"            => Some("audio-response"),
            "hotspot"                                      => Some("hotspot"),
            "code-lab" | "code lab"                        => Some("code-lab"),
            _                                              => None,
        }
    };

    let mut imported = 0i32;
    let mut skipped  = 0i32;

    for row in rows {
        let question_text = get_cell(row, idx_question_text);
        let question_type_raw = get_cell(row, idx_question_type);
        let Some(question_type) = to_question_type(&question_type_raw) else {
            skipped += 1;
            continue;
        };
        if question_text.is_empty() {
            skipped += 1;
            continue;
        }

        let options_raw     = get_cell(row, idx_options);
        let correct_raw     = get_cell(row, idx_correct_answer);
        let explanation_raw = get_cell(row, idx_explanation);
        let difficulty_raw  = get_cell(row, idx_difficulty);
        let tags_raw        = get_cell(row, idx_tags);
        let points_raw      = get_cell(row, idx_points);

        let difficulty = match difficulty_raw.to_lowercase().as_str() {
            "easy" | "hard" => difficulty_raw.to_lowercase(),
            _               => "medium".to_string(),
        };

        let options: serde_json::Value = if question_type == "true-false" {
            serde_json::json!(["Verdadero", "Falso"])
        } else if options_raw.starts_with('[') {
            serde_json::from_str(&options_raw).unwrap_or(serde_json::Value::Null)
        } else if !options_raw.is_empty() {
            let parts: Vec<&str> = options_raw.split(',').map(str::trim).collect();
            serde_json::json!(parts)
        } else {
            serde_json::Value::Null
        };

        let correct_answer: serde_json::Value = if question_type == "true-false" {
            let lower = correct_raw.to_lowercase();
            if lower == "verdadero" || lower == "true" {
                serde_json::json!(0)
            } else {
                serde_json::json!(1)
            }
        } else if correct_raw.starts_with('[') || correct_raw.starts_with('{') {
            serde_json::from_str(&correct_raw).unwrap_or(serde_json::Value::Null)
        } else if let Ok(n) = correct_raw.parse::<i64>() {
            serde_json::json!(n)
        } else {
            serde_json::json!(correct_raw)
        };

        let tags: Option<Vec<String>> = if tags_raw.is_empty() {
            None
        } else {
            Some(tags_raw.split(',').map(|t: &str| t.trim().to_string()).filter(|t: &String| !t.is_empty()).collect())
        };

        let points: i32 = points_raw.parse::<i32>().unwrap_or(1).max(1);

        let result = sqlx::query(
            r#"INSERT INTO question_bank
               (organization_id, question_text, question_type, options, correct_answer,
                explanation, difficulty, tags, points, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())"#
        )
        .bind(org_ctx.id)
        .bind(&question_text)
        .bind(question_type)
        .bind(&options)
        .bind(&correct_answer)
        .bind(if explanation_raw.is_empty() { None } else { Some(explanation_raw) })
        .bind(&difficulty)
        .bind(tags.as_deref().map(|t| serde_json::json!(t)))
        .bind(points)
        .execute(&pool)
        .await;

        match result {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }

    Ok(Json(ImportResult { imported, skipped, updated: 0, error: None }))
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct MySqlQuestionFull {
    pub id_pregunta: i32,
    pub descripcion: String,
    pub id_tipo_pregunta: i32,
    pub activo: bool,
    pub id_cursos: i32,
    pub nombre_curso: String,
    pub nivel_curso: Option<i32>,
    pub id_plan_de_estudios: i32,
    pub plan_nombre: String,
    pub respuestas_json: Option<String>, // Array JSON de respuestas
    pub tipo_pregunta_nombre: Option<String>, // Nombre del tipo de pregunta
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct MySqlQuestion {
    id_pregunta: i32,
    descripcion: String,
    id_tipo_pregunta: i32,
    activo: bool,
    id_cursos: i32,
    nombre_curso: String,
    id_plan_de_estudios: i32,
    plan_nombre: String,
}

// ==================== Generación por IA ====================

#[derive(Debug, Deserialize)]
pub struct AIGenerateQuestionPayload {
    pub question_text: Option<String>,
    #[allow(dead_code)]
    pub question_type: Option<String>,
    pub difficulty: Option<String>,
    pub skill: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIQuestionResponse {
    pub question_text: String,
    pub options: Vec<String>,
    pub correct_answer: serde_json::Value,
    pub explanation: String,
}

/// POST /question-bank/ai-generate - Generar opciones/respuestas de preguntas usando IA (solo Ollama)
pub async fn ai_generate_question(
    _org_ctx: Org,
    _claims: Claims,
    Json(payload): Json<AIGenerateQuestionPayload>,
) -> Result<Json<AIQuestionResponse>, (StatusCode, String)> {
    use std::env;
    use std::time::Duration;

    let question_text = payload.question_text.unwrap_or_else(|| "Pregunta de gramática inglesa".to_string());
    let question_type = payload.question_type.unwrap_or_else(|| "multiple-choice".to_string());
    let difficulty = payload.difficulty.unwrap_or_else(|| "medium".to_string());
    let skill = payload.skill.unwrap_or_else(|| "grammar".to_string());

    // Construir prompt para la IA
    let system_prompt = format!(
        r#"You are an expert English Teacher creating quiz questions.

        Create a multiple-choice question with the following parameters:
        - Topic/Context: {}
        - Question type: {}
        - Difficulty: {}
        - Skill assessed: {}

        Return ONLY a JSON object with this exact structure:
        {{
            "question_text": "The question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 0,
            "explanation": "Detailed explanation of why this is correct"
        }}"#,
        question_text, question_type, difficulty, skill
    );

    // Llamar a Ollama AI con tiempo de espera extendido
    let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
    let url = format!("{}/api/chat", base_url);
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600)) // 10 minutes timeout for slower machines
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    tracing::info!("Calling Ollama at {} with model {}", url, model);

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": "Generar la pregunta en formato JSON" }
            ],
            "stream": false,
            "format": "json"
        }))
        .send()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if !response.status().is_success() {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()));
    }

    let result: serde_json::Value = response.json().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Extraer contenido de la respuesta de Ollama
    let content = result
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Formato de respuesta de IA no válido".to_string()))?;

    // Analizar la respuesta de la IA como JSON
    let ai_question: AIQuestionResponse = serde_json::from_str(content)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(ai_question))
}

// ==================== Importar Cursos de MySQL ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportCourseFromMySQLPayload {
    pub mysql_course_id: i32,
    pub title: Option<String>,        // Optional custom title (defaults to MySQL course name)
    pub description: Option<String>,  // Optional description
    pub pacing_mode: Option<String>,  // self_paced or instructor_led
}

#[derive(Debug, Serialize)]
pub struct ImportCourseResult {
    pub course_id: Uuid,
    pub course_title: String,
    pub mysql_course_id: i32,
    pub modules_created: i32,
    pub lessons_created: i32,
    pub message: String,
}

/// POST /api/question-bank/import-course-mysql - Importar un curso de MySQL con estructura básica
pub async fn import_course_from_mysql(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ImportCourseFromMySQLPayload>,
) -> Result<Json<ImportCourseResult>, (StatusCode, String)> {
    use common::models::Course;

    // Conectar a MySQL
    let mysql_pool = connect_mysql_pool("MYSQL_DATABASE_URL").await?;

    // Obtener información del curso de MySQL
    let mysql_course: MySqlCourseInfo = sqlx::query_as(
        r#"
        SELECT 
            c.idCursos AS id_cursos,
            c.NombreCurso AS nombre_curso,
            c.NivelCurso AS nivel_curso,
            pe.idPlanDeEstudios AS id_plan_de_estudios,
            pe.Nombre AS nombre_plan,
            c.Duracion AS duracion
        FROM curso c
        JOIN plandeestudios pe ON c.idPlanDeEstudios = pe.idPlanDeEstudios
        WHERE c.idCursos = ? AND c.Activo = 1 AND pe.Activo = 1
        "#
    )
    .bind(payload.mysql_course_id)
    .fetch_one(&mysql_pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::RowNotFound = e {
            (StatusCode::NOT_FOUND, format!("Curso con ID {} no encontrado en MySQL", payload.mysql_course_id))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string())
        }
    })?;

    tracing::info!("Importando curso de MySQL: {} (ID: {})", mysql_course.nombre_curso, mysql_course.id_cursos);

    // Iniciar transacción
    let mut tx = pool.begin().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Determinar el tipo y nivel del curso para la generación de la estructura
    let course_type = calculate_course_type_from_duration(mysql_course.duracion);
    let level = calculate_course_level(mysql_course.nivel_curso);
    
    tracing::info!("Course type: {}, Level: {}", course_type, level);

    // Crear el curso en PostgreSQL
    let course_title = payload.title.unwrap_or_else(|| format!("{} ({})", mysql_course.nombre_curso, mysql_course.nombre_plan));
    let pacing_mode = payload.pacing_mode.unwrap_or_else(|| "self_paced".to_string());
    let description = payload.description.unwrap_or_else(|| format!("Curso importado desde MySQL - Plan: {}", mysql_course.nombre_plan));

    let new_course: Course = sqlx::query_as(
        r#"
        INSERT INTO courses (
            organization_id, instructor_id, title, pacing_mode, description,
            passing_percentage, certificate_template, imported_mysql_course_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(&course_title)
    .bind(&pacing_mode)
    .bind(&description)
    .bind(60.0)  // Default passing percentage
    .bind(serde_json::json!({
        "template": "default",
        "show_logo": true,
        "show_instructor": true
    }))
    .bind(mysql_course.id_cursos)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    tracing::info!("Curso creado en PostgreSQL: {}", new_course.id);

    // Generar estructura básica del curso basada en su tipo y nivel
    let (modules_count, lessons_count) = generate_course_structure(
        &mut tx,
        new_course.id,
        org_ctx.id,
        &course_type,
        &level,
        &mysql_course.nombre_curso,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // Confirmar transacción
    tx.commit().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    tracing::info!(
        "Curso {} importado con éxito con {} módulos y {} lecciones",
        new_course.id,
        modules_count,
        lessons_count
    );

    Ok(Json(ImportCourseResult {
        course_id: new_course.id,
        course_title: new_course.title.clone(),
        mysql_course_id: mysql_course.id_cursos,
        modules_created: modules_count,
        lessons_created: lessons_count,
        message: format!("Curso '{}' importado exitosamente con {} módulos y {} lecciones",
            new_course.title, modules_count, lessons_count),
    }))
}

/// Generar estructura básica del curso según tipo y nivel
async fn generate_course_structure<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Postgres>,
    course_id: Uuid,
    org_id: Uuid,
    course_type: &str,
    _level: &str,
    _course_name: &str,
) -> Result<(i32, i32), String> {
    // Definir la estructura de módulos basada en el tipo de curso
    // Regular (40h): 4 módulos
    // Intensivo (80h): 8 módulos
    let modules_config = match course_type {
        "intensive" => vec![
            ("Fundamentos Básicos", 6),
            ("Gramática Esencial", 6),
            ("Vocabulario Intermedio", 6),
            ("Comprensión Auditiva", 6),
            ("Expresión Oral", 6),
            ("Lectura y Escritura", 6),
            ("Práctica Avanzada", 6),
            ("Proyecto Final", 4),
        ],
        _ => vec![
            ("Introducción y Fundamentos", 5),
            ("Gramática Básica", 5),
            ("Vocabulario Esencial", 5),
            ("Práctica Integradora", 5),
        ],
    };

    let mut total_modules = 0;
    let mut total_lessons = 0;

    for (module_idx, (module_name, lessons_count)) in modules_config.iter().enumerate() {
        // Crear módulo
        let module: common::models::Module = sqlx::query_as(
            r#"
            INSERT INTO modules (course_id, organization_id, title, position)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#
        )
        .bind(course_id)
        .bind(org_id)
        .bind(format!("Módulo {}: {}", module_idx + 1, module_name))
        .bind(module_idx as i32)
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| format!("Error al crear el módulo {}: {}", module_idx + 1, e))?;

        total_modules += 1;

        // Crear lecciones para este módulo
        for lesson_idx in 0..*lessons_count {
            let lesson_position = (module_idx * lessons_count + lesson_idx) as i32;
            let lesson_title = format!("Lección {}.{}", module_idx + 1, lesson_idx + 1);
            
            // Determinar el tipo de contenido basado en la posición (rotar por tipos)
            let content_types = ["video", "document", "interactive", "quiz"];
            let content_type = content_types[lesson_idx % content_types.len()];

            sqlx::query(
                r#"
                INSERT INTO lessons (
                    module_id, organization_id, title, content_type,
                    content_url, position, is_graded, summary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                "#
            )
            .bind(module.id)
            .bind(org_id)
            .bind(&lesson_title)
            .bind(content_type)
            .bind("")  // URL de contenido vacía (para que el instructor la complete)
            .bind(lesson_position)
            .bind(lesson_idx % 4 == 3)  // Cada 4ª lección se califica (cuestionario)
            .bind(format!("Contenido de la lección: {}", lesson_title))
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("Error al crear la lección {}: {}", lesson_position, e))?;

            total_lessons += 1;
        }
    }

    Ok((total_modules, total_lessons))
}

// ==================== Importar desde SAM Diagnóstico ====================

/// Row retornada por GROUP BY sobre las tablas de SAM_diagnostico
#[derive(Debug, sqlx::FromRow)]
struct SamDiagnosticoQuestion {
    pub id_test: i32,
    pub id_curso: i32,
    pub id_pregunta: i32,
    pub pregunta_nombre: Option<String>,
    #[allow(dead_code)]
    pub tipo_pregunta: Option<String>,
    /// Opciones separadas por '|||' (GROUP_CONCAT)
    pub opciones: Option<String>,
    /// Texto de la respuesta correcta (valorRespuesta = 1)
    pub respuesta_correcta: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct ImportSamDiagnosticoPayload {
    /// "adultos", "kids", "teens" o null para importar las tres audiencias
    pub audience: Option<String>,
    /// Filtra por idTest específico (opcional)
    pub test_id: Option<i32>,
    /// Filtra por idCurso específico (opcional)
    pub curso_id: Option<i32>,
}

/// POST /api/question-bank/import-sam-diagnostico
/// Importa preguntas desde las tablas SAM_diagnostico (preguntasadultos,
/// preguntaskid, preguntasteens) al banco de preguntas de PostgreSQL.
pub async fn import_from_sam_diagnostico(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ImportSamDiagnosticoPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    use serde_json::json;

    let mysql_pool = connect_mysql_pool("SAM_DIAGNOSTICO_DATABASE_URL").await?;

    // Determinar qué tablas procesar según la audiencia solicitada
    let tables: Vec<(&str, &str)> = match payload.audience.as_deref() {
        Some("adultos") => vec![("adultos", "preguntasadultos")],
        Some("kids")    => vec![("kids",    "preguntaskid")],
        Some("teens")   => vec![("teens",   "preguntasteens")],
        _               => vec![
            ("adultos", "preguntasadultos"),
            ("kids",    "preguntaskid"),
            ("teens",   "preguntasteens"),
        ],
    };

    let mut total_imported: i64 = 0;
    let mut total_skipped: i64  = 0;
    let mut errors: Vec<String> = Vec::new();

    for (audience_label, table_name) in &tables {
        // GROUP_CONCAT agrupa todas las opciones de cada pregunta en una sola fila.
        // El separador '|||' no puede aparecer en los textos de respuesta normales.
        let base_query = format!(
            r#"
            SELECT
                idTest                                                          AS id_test,
                idCurso                                                         AS id_curso,
                idPregunta                                                      AS id_pregunta,
                CAST(MAX(preguntaNombre) AS CHAR CHARACTER SET utf8mb4)        AS pregunta_nombre,
                CAST(MAX(tipoPregunta) AS CHAR CHARACTER SET utf8mb4)          AS tipo_pregunta,
                GROUP_CONCAT(
                    CAST(respuestaNombre AS CHAR CHARACTER SET utf8mb4)
                    ORDER BY idOpcion
                    SEPARATOR '|||'
                )                                                               AS opciones,
                CAST(MAX(CASE WHEN valorRespuesta = 1 THEN respuestaNombre ELSE NULL END) AS CHAR CHARACTER SET utf8mb4)
                                                                                AS respuesta_correcta
            FROM {}
            WHERE 1=1
            {}
            {}
            GROUP BY idTest, idCurso, idPregunta
            ORDER BY idTest, idCurso, idPregunta
            "#,
            table_name,
            if payload.test_id.is_some()  { "AND idTest  = ?"  } else { "" },
            if payload.curso_id.is_some() { "AND idCurso = ?"  } else { "" },
        );

        // Bind parámetros opcionales de forma dinámica
        let rows: Vec<SamDiagnosticoQuestion> = {
            let mut q = sqlx::query_as::<_, SamDiagnosticoQuestion>(&base_query);
            if let Some(tid) = payload.test_id  { q = q.bind(tid); }
            if let Some(cid) = payload.curso_id { q = q.bind(cid); }
            q.fetch_all(&mysql_pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Failed to fetch from {}: {}", table_name, e),
                    )
                })?
        };

        tracing::info!(
            "SAM_diagnostico {}: {} preguntas encontradas",
            table_name, rows.len()
        );

        for question in rows {
            let question_text = match &question.pregunta_nombre {
                Some(t) if !t.trim().is_empty() => t.clone(),
                _ => continue, // Saltar preguntas sin texto
            };

            // Clave única para detectar duplicados
            let sam_id = format!(
                "{}-{}-{}-{}",
                audience_label, question.id_test, question.id_curso, question.id_pregunta
            );

            let exists: (bool,) = sqlx::query_as(
                "SELECT EXISTS(SELECT 1 FROM question_bank \
                 WHERE source_metadata->>'sam_id' = $1 AND organization_id = $2)"
            )
            .bind(&sam_id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al comprobar duplicado: {}", e),
                )
            })?;

            if exists.0 {
                total_skipped += 1;
                continue;
            }

            // Convertir GROUP_CONCAT → Vec<String>
            let options_vec: Vec<String> = question
                .opciones
                .as_deref()
                .unwrap_or("")
                .split("|||")
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty())
                .collect();

            let options_json = if options_vec.is_empty() {
                serde_json::Value::Null
            } else {
                json!(options_vec)
            };

            let correct_json = question
                .respuesta_correcta
                .as_ref()
                .map(|a| json!(a))
                .unwrap_or(serde_json::Value::Null);

            let source_metadata = json!({
                "sam_id":       sam_id,
                "audience":     audience_label,
                "tabla":        table_name,
                "idTest":       question.id_test,
                "idCurso":      question.id_curso,
                "idPregunta":   question.id_pregunta,
                "imported_at":  chrono::Utc::now().to_rfc3339(),
            });

            match sqlx::query(
                r#"
                INSERT INTO question_bank (
                    organization_id, created_by, question_text, question_type,
                    options, correct_answer, source, source_metadata,
                    audio_status, is_active
                )
                VALUES ($1, $2, $3, 'multiple-choice', $4, $5, 'sam-diagnostico', $6, 'pending', true)
                "#
            )
            .bind(org_ctx.id)
            .bind(claims.sub)
            .bind(&question_text)
            .bind(&options_json)
            .bind(&correct_json)
            .bind(&source_metadata)
            .execute(&pool)
            .await
            {
                Ok(_)  => total_imported += 1,
                Err(e) => errors.push(format!(
                    "Error importando pregunta {} ({}): {}",
                    question.id_pregunta, table_name, e
                )),
            }
        }
    }

    mysql_pool.close().await;

    tracing::info!(
        "Importación de SAM_diagnostico finalizada: imported={} skipped={} errors={}",
        total_imported, total_skipped, errors.len()
    );

    Ok(Json(json!({
        "imported": total_imported,
        "skipped":  total_skipped,
        "errors":   errors,
    })))
}
