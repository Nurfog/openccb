use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::models::{
    CourseLevel, CourseType, CreateTestTemplatePayload, TestTemplate, TestTemplateQuestion,
    TestTemplateSection, TestTemplateWithQuestions, TestType, UpdateTestTemplatePayload,
};
use common::{auth::Claims, middleware::Org};
use serde::Deserialize;
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

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

// ==================== Query Parameters ====================

#[derive(Debug, Deserialize)]
pub struct TestTemplateFilters {
    pub mysql_course_id: Option<i32>, // Filtrar por ID de curso MySQL
    pub level: Option<CourseLevel>,
    pub course_type: Option<CourseType>,
    pub test_type: Option<TestType>,
    pub tags: Option<String>, // Lista separada por comas
    pub search: Option<String>,
}

// ==================== Create ====================

/// POST /api/test-templates - Crear una nueva plantilla de test
pub async fn create_test_template(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateTestTemplatePayload>,
) -> Result<Json<TestTemplate>, (StatusCode, String)> {
    if let Some(mysql_course_id) = payload.mysql_course_id {
        ensure_mysql_course_metadata(&pool, org_ctx.id, mysql_course_id).await?;
    }

    let template: TestTemplate = sqlx::query_as(
        r#"
        INSERT INTO test_templates (
            organization_id, created_by, name, description, mysql_course_id,
            level, course_type, test_type, duration_minutes, passing_score, total_points,
            instructions, template_data, tags
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, organization_id, mysql_course_id, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_by, created_at, updated_at
        "#
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.mysql_course_id)
    .bind(payload.level.as_ref())
    .bind(payload.course_type.as_ref())
    .bind(&payload.test_type)
    .bind(payload.duration_minutes)
    .bind(payload.passing_score)
    .bind(payload.total_points)
    .bind(&payload.instructions)
    .bind(&payload.template_data)
    .bind(payload.tags.as_deref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(template))
}

// ==================== Read ====================

/// GET /api/test-templates - Listar plantillas de test con filtros
pub async fn list_test_templates(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<TestTemplateFilters>,
) -> Result<Json<Vec<TestTemplate>>, (StatusCode, String)> {
    // Consulta base
    let mut query = String::from("SELECT * FROM test_templates WHERE organization_id = $1");
    let mut param_count = 1;

    // Filtrar por mysql_course_id
    if filters.mysql_course_id.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND mysql_course_id = ${}", param_count));
    }

    // Filtrar por nivel
    if filters.level.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND level = ${}", param_count));
    }

    // Filtrar por tipo de curso
    if filters.course_type.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND course_type = ${}", param_count));
    }

    // Filtrar por tipo de test
    if filters.test_type.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND test_type = ${}", param_count));
    }

    // Filtrar por etiquetas (solapamiento de array)
    if filters.tags.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND tags && ${}", param_count));
    }

    // Buscar en nombre y descripción
    if filters.search.is_some() {
        param_count += 1;
        query.push_str(&format!(
            " AND (name ILIKE ${0} OR description ILIKE ${0})",
            param_count
        ));
    }

    query.push_str(" ORDER BY created_at DESC");

    // Construir consulta con binds dinámicos
    let mut sql_query = sqlx::query_as::<_, TestTemplate>(&query).bind(org_ctx.id);

    if let Some(mysql_course_id) = &filters.mysql_course_id {
        sql_query = sql_query.bind(mysql_course_id);
    }

    if let Some(level) = &filters.level {
        sql_query = sql_query.bind(level);
    }

    if let Some(course_type) = &filters.course_type {
        sql_query = sql_query.bind(course_type);
    }

    if let Some(test_type) = &filters.test_type {
        sql_query = sql_query.bind(test_type);
    }

    if let Some(tags_str) = &filters.tags {
        let tags: Vec<String> = tags_str.split(',').map(|s| s.trim().to_string()).collect();
        sql_query = sql_query.bind(tags);
    }

    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    if let Some(ref pattern) = search_pattern {
        sql_query = sql_query.bind(pattern);
    }

    let templates = sql_query
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(templates))
}

/// GET /api/test-templates/:id - Obtener una plantilla de test específica con preguntas
pub async fn get_test_template(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<TestTemplateWithQuestions>, (StatusCode, String)> {
    // Obtener plantilla
    let template: TestTemplate = sqlx::query_as(
        r#"
        SELECT id, organization_id, mysql_course_id, created_by, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_at, updated_at
        FROM test_templates
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Plantilla no encontrada".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()),
    })?;

    // Obtener secciones
    let sections: Vec<TestTemplateSection> = sqlx::query_as(
        r#"
        SELECT id, template_id, title, description, section_order, points, instructions, section_data, created_at
        FROM test_template_sections
        WHERE template_id = $1
        ORDER BY section_order
        "#
    )
    .bind(template_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener preguntas
    let questions: Vec<TestTemplateQuestion> = sqlx::query_as(
        r#"
        SELECT id, template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata, created_at
        FROM test_template_questions
        WHERE template_id = $1
        ORDER BY section_id, question_order
        "#
    )
    .bind(template_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(TestTemplateWithQuestions {
        template,
        sections,
        questions,
    }))
}

// ==================== Update ====================

/// PUT /api/test-templates/:id - Actualizar una plantilla de test
pub async fn update_test_template(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    _claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateTestTemplatePayload>,
) -> Result<Json<TestTemplate>, (StatusCode, String)> {
    let template: TestTemplate = sqlx::query_as(
        r#"
        UPDATE test_templates
        SET
            name = COALESCE($3, name),
            description = COALESCE($4, description),
            mysql_course_id = COALESCE($5, mysql_course_id),
            level = COALESCE($6, level),
            course_type = COALESCE($7, course_type),
            test_type = COALESCE($8, test_type),
            duration_minutes = COALESCE($9, duration_minutes),
            passing_score = COALESCE($10, passing_score),
            total_points = COALESCE($11, total_points),
            instructions = COALESCE($12, instructions),
            template_data = COALESCE($13, template_data),
            tags = COALESCE($14, tags),
            is_active = COALESCE($15, is_active),
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, organization_id, mysql_course_id, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_by, created_at, updated_at
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .bind(payload.name)
    .bind(payload.description)
    .bind(payload.mysql_course_id)
    .bind(payload.level)
    .bind(payload.course_type)
    .bind(payload.test_type)
    .bind(payload.duration_minutes)
    .bind(payload.passing_score)
    .bind(payload.total_points)
    .bind(payload.instructions)
    .bind(payload.template_data)
    .bind(payload.tags)
    .bind(payload.is_active)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Plantilla no encontrada".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()),
    })?;

    Ok(Json(template))
}

// ==================== Delete ====================

/// DELETE /api/test-templates/:id - Eliminar una plantilla de test
pub async fn delete_test_template(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        r#"
        DELETE FROM test_templates
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Plantilla no encontrada".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Gestión de Preguntas de la Plantilla ====================

/// POST /api/test-templates/:id/questions - Añadir una pregunta a una plantilla
pub async fn create_template_question(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateQuestionPayload>,
) -> Result<Json<TestTemplateQuestion>, (StatusCode, String)> {
    // Verificar que la plantilla existe y pertenece a la organización
    let exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM test_templates WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Plantilla no encontrada".to_string()));
    }

    let question: TestTemplateQuestion = sqlx::query_as(
        r#"
        INSERT INTO test_template_questions (
            template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata, created_at
        "#
    )
    .bind(template_id)
    .bind(payload.section_id)
    .bind(payload.question_order)
    .bind(&payload.question_type)
    .bind(&payload.question_text)
    .bind(payload.options.as_ref())
    .bind(payload.correct_answer.as_ref())
    .bind(&payload.explanation)
    .bind(payload.points)
    .bind(payload.metadata.as_ref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(question))
}

#[derive(Debug, Deserialize)]
pub struct CreateQuestionPayload {
    pub section_id: Option<Uuid>,
    pub question_order: i32,
    pub question_type: String,
    pub question_text: String,
    pub options: Option<serde_json::Value>,
    pub correct_answer: Option<serde_json::Value>,
    pub explanation: Option<String>,
    pub points: i32,
    pub metadata: Option<serde_json::Value>,
}

/// DELETE /api/test-templates/:template_id/questions/:question_id - Eliminar una pregunta
pub async fn delete_template_question(
    Org(org_ctx): Org,
    Path((template_id, question_id)): Path<(Uuid, Uuid)>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verificar que la plantilla existe y pertenece a la organización
    let exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM test_templates WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Plantilla no encontrada".to_string()));
    }

    let result = sqlx::query(
        r#"
        DELETE FROM test_template_questions
        WHERE id = $1 AND template_id = $2
        "#
    )
    .bind(question_id)
    .bind(template_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Pregunta no encontrada".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Gestión de Secciones de la Plantilla ====================

/// POST /api/test-templates/:id/sections - Añadir una sección a una plantilla
pub async fn create_template_section(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateSectionPayload>,
) -> Result<Json<TestTemplateSection>, (StatusCode, String)> {
    // Verificar que la plantilla existe
    let exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM test_templates WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if !exists.0 {
        return Err((StatusCode::NOT_FOUND, "Plantilla no encontrada".to_string()));
    }

    let section: TestTemplateSection = sqlx::query_as(
        r#"
        INSERT INTO test_template_sections (
            template_id, title, description, section_order, points, instructions, section_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, template_id, title, description, section_order, points, instructions, section_data, created_at
        "#
    )
    .bind(template_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(payload.section_order)
    .bind(payload.points)
    .bind(&payload.instructions)
    .bind(payload.section_data.as_ref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(section))
}

#[derive(Debug, Deserialize)]
pub struct CreateSectionPayload {
    pub title: String,
    pub description: Option<String>,
    pub section_order: i32,
    pub points: i32,
    pub instructions: Option<String>,
    pub section_data: Option<serde_json::Value>,
}

/// DELETE /api/test-templates/:template_id/sections/:section_id - Eliminar una sección
pub async fn delete_template_section(
    Org(_org_ctx): Org,
    Path((template_id, section_id)): Path<(Uuid, Uuid)>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        r#"
        DELETE FROM test_template_sections
        WHERE id = $1 AND template_id = $2
        "#
    )
    .bind(section_id)
    .bind(template_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Sección no encontrada".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Aplicar Plantilla a la Lección ====================

/// POST /api/test-templates/:id/apply - Aplicar una plantilla a una lección
pub async fn apply_template_to_lesson(
    Org(org_ctx): Org,
    Path(template_id): Path<Uuid>,
    _claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ApplyTemplatePayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verificar que la plantilla existe y pertenece a la organización
    let template: TestTemplate = sqlx::query_as(
        r#"
        SELECT id, organization_id, mysql_course_id, created_by, name, description, level, course_type,
            test_type, duration_minutes, passing_score, total_points, instructions,
            template_data, tags, is_active, usage_count, created_at, updated_at
        FROM test_templates
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Plantilla no encontrada".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()),
    })?;

    // Verificar que la lección existe y pertenece a la organización
    let lesson_exists: (bool,) = sqlx::query_as(
        r#"SELECT EXISTS(SELECT 1 FROM lessons WHERE id = $1 AND organization_id = $2)"#
    )
    .bind(payload.lesson_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if !lesson_exists.0 {
        return Err((StatusCode::NOT_FOUND, "Lección no encontrada".to_string()));
    }

    // Obtener las preguntas de la plantilla con sus secciones
    let template_questions: Vec<TestTemplateQuestion> = sqlx::query_as(
        r#"
        SELECT id, template_id, section_id, question_order, question_type, question_text,
            options, correct_answer, explanation, points, metadata, created_at
        FROM test_template_questions
        WHERE template_id = $1
        ORDER BY section_id, question_order
        "#
    )
    .bind(template_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if template_questions.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "La plantilla no tiene preguntas".to_string()));
    }

    // Construir el JSON quiz_data a partir de las preguntas de la plantilla
    let questions_json: Vec<serde_json::Value> = template_questions
        .iter()
        .map(|q| {
            serde_json::json!({
                "id": q.id.to_string(),
                "type": q.question_type,
                "question": q.question_text,
                "options": q.options.clone().unwrap_or(serde_json::Value::Null),
                "correct": q.correct_answer.clone().unwrap_or(serde_json::Value::Null),
                "explanation": q.explanation.clone().unwrap_or_default(),
                "points": q.points,
            })
        })
        .collect();

    let quiz_data = serde_json::json!({
        "questions": questions_json,
        "template_id": template_id.to_string(),
        "template_name": template.name,
        "test_type": template.test_type.to_string(),
        "duration_minutes": template.duration_minutes,
        "passing_score": template.passing_score,
        "total_points": template.total_points,
        "instructions": template.instructions,
        "max_attempts": 1, // Intento único según lo solicitado
        "show_feedback": true, // Show explanations after answering
        "permanent_history": true, // El estudiante siempre puede ver sus respuestas
    });

    // Actualizar lección con datos del cuestionario y configuración
    sqlx::query(
        r#"
        UPDATE lessons 
        SET content_type = 'quiz',
            content_url = NULL,
            metadata = $1,
            is_graded = true,
            max_attempts = 1,
            allow_retry = false,
            grading_category_id = $2,
            updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        "#
    )
    .bind(&quiz_data)
    .bind(payload.grading_category_id)
    .bind(payload.lesson_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Incrementar el contador de uso de la plantilla
    sqlx::query("SELECT increment_template_usage($1)")
        .bind(template_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    tracing::info!(
        "Plantilla '{}' aplicada a la lección '{}' con {} preguntas",
        template.name,
        payload.lesson_id,
        template_questions.len()
    );

    Ok(StatusCode::OK)
}

#[derive(Debug, Deserialize)]
pub struct ApplyTemplatePayload {
    pub lesson_id: Uuid,
    pub grading_category_id: Option<Uuid>,
}

// ==================== Generación de Preguntas RAG ====================

// Función auxiliar para generar el system prompt basado en el tipo de pregunta
fn get_system_prompt_for_question_type(
    question_type: &str,
    num_questions: i32,
    topic: &str,
    rag_context: &str,
) -> String {
    match question_type {
        "true-false" => {
            format!(
                r#"You are an English Teacher creating quiz questions.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} preguntas ORIGINALES de verdadero-falso sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con esta estructura EXACTA:
[
    {{
        "question_text": "The capital of France is Paris.",
        "question_type": "true-false",
        "correct_answer": true,
        "explanation": "Paris is indeed the capital of France.",
        "points": 1
    }}
]

Reglas:
- Cada pregunta debe ser una afirmación clara
- correct_answer debe ser true o false
- Las explicaciones deben ser concisas"#,
                rag_context, num_questions, topic
            )
        }
        "short-answer" => {
            format!(
                r#"You are an English Teacher creating quiz questions.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} preguntas ORIGINALES de respuesta corta sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con esta estructura EXACTA:
[
    {{
        "question_text": "What is the past tense of 'go'?",
        "question_type": "short-answer",
        "correct_answer": "went",
        "keywords": ["went", "go's past tense"],
        "explanation": "The irregular verb 'go' becomes 'went' in the past tense.",
        "points": 1
    }}
]

Reglas:
- correct_answer debe ser la respuesta esperada
- el array de palabras clave (keywords) contiene variaciones aceptables o conceptos clave para verificar
- Las preguntas deben aceptar respuestas breves"#,
                rag_context, num_questions, topic
            )
        }
        "essay" => {
            format!(
                r#"You are an English Teacher creating essay questions.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} preguntas ORIGINALES de ensayo sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con esta estructura EXACTA:
[
    {{
        "question_text": "Explain how setting influences the mood of a short story.",
        "question_type": "essay",
        "correct_answer": "A strong response explains specific setting details and connects them clearly to mood with evidence.",
        "explanation": "This assesses analytical writing and use of textual evidence.",
        "points": 3
    }}
]

Reglas:
- Las preguntas deben requerir respuestas escritas extensas
- correct_answer debe contener una guía de rúbrica o criterios esperados
- No se necesita un array de opciones (options)"#,
                rag_context, num_questions, topic
            )
        }
        "matching" => {
            format!(
                r#"You are an English Teacher creating quiz questions.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} conjuntos de preguntas ORIGINALES de emparejamiento sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con preguntas de emparejamiento. Cada pregunta de emparejamiento debe tener esta estructura EXACTA:
[
    {{
        "question_text": "Empareje cada término de vocabulario con su definición:",
        "question_type": "matching",
        "pairs": [
            {{"left": "Verb", "right": "A word that describes an action"}},
            {{"left": "Noun", "right": "A word that represents a person, place, or thing"}},
            {{"left": "Adjective", "right": "A word that describes or modifies a noun"}}
        ],
        "explanation": "These are the fundamental parts of speech in English.",
        "points": 3
    }}
]

Reglas:
- Crear 3-5 pares de emparejamiento por pregunta
- los elementos izquierda/derecha (left/right) deben ser claros y distintos
- Todos los elementos del array de pares deben seguir la misma estructura
- Una pregunta por elemento del array"#,
                rag_context, num_questions, topic
            )
        }
        "ordering" => {
            format!(
                r#"Eres un profesor de inglés creando preguntas para un cuestionario.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} preguntas ORIGINALES de ordenación sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con esta estructura EXACTA:
[
    {{
        "question_text": "Organice estos pasos del proceso de escritura en el orden correcto:",
        "question_type": "ordering",
        "items": ["Revise", "Draft", "Prewrite", "Publish", "Edit"],
        "correct_order": [2, 1, 3, 4, 0],
        "explanation": "El proceso de escritura comienza con la pre-escritura, luego el borrador, la revisión, la edición y finalmente la publicación.",
        "points": 3
    }}
]

Reglas:
- el array de elementos (items) contiene los elementos a ordenar
- correct_order es un array de índices que muestran la secuencia correcta (basado en 0)
- Debe tener al menos 4 elementos para ordenar
- Las preguntas deben tener una secuencia lógica clara"#,
                rag_context, num_questions, topic
            )
        }
        "fill-in-the-blanks" => {
            format!(
                r#"Eres un profesor de inglés creando preguntas para un cuestionario.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} preguntas ORIGINALES de completar espacios en blanco sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con esta estructura EXACTA:
[
    {{
        "question_text": "El ________ es el personaje principal de una historia, mientras que el ________ se le opone.",
        "question_type": "fill-in-the-blanks",
        "blanks": [
            {{"answer": "protagonist", "keywords": ["protagonist", "hero", "main character"]}},
            {{"answer": "antagonist", "keywords": ["antagonist", "villain", "opponent"]}}
        ],
        "explanation": "Estos son términos literarios clave que describen personajes en las historias.",
        "points": 2
    }}
]

Reglas:
- question_text debe tener ________ para cada espacio en blanco
- el array de espacios (blanks) tiene un objeto por espacio en blanco
- Cada objeto de espacio en blanco debe tener 'answer' y un array 'keywords'
- keywords debe incluir la respuesta principal más variaciones aceptables
- Las preguntas pueden tener de 1 a 3 espacios en blanco"#,
                rag_context, num_questions, topic
            )
        }
        "audio-response" => {
            format!(
                r#"Eres un profesor de inglés creando ejercicios de expresión oral.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} consignas ORIGINALES de respuesta de audio sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con esta estructura EXACTA:
[
    {{
        "question_text": "Describa un viaje memorable utilizando al menos tres verbos en pasado.",
        "question_type": "audio-response",
        "correct_answer": "Utilice formas claras en tiempo pasado y vocabulario de viaje relevante en una respuesta coherente.",
        "explanation": "Esta consigna comprueba la fluidez y el control gramatical en la producción oral.",
        "points": 2
    }}
]

Reglas:
- Las preguntas deben requerir producción oral
- correct_answer debe contener una guía de rúbrica o criterios de respuesta esperados
- No se necesita un array de opciones (options)"#,
                rag_context, num_questions, topic
            )
        }
        _ => {
            // Default to multiple-choice
            format!(
                r#"Eres un profesor de inglés creando preguntas para un cuestionario.

Usa estos ejemplos como inspiración (NO los copies):
{}

Crea {} preguntas ORIGINALES de opción múltiple sobre: {}

IMPORTANTE - Devuelve SOLO un array JSON con esta estructura EXACTA:
[
    {{
        "question_text": "El turista se perdió en el ______ de la ciudad.",
        "question_type": "multiple-choice",
        "options": ["downtown", "countryside", "mountains", "desert"],
        "correct_answer": 0,
        "explanation": "El centro (downtown) es la zona principal de una ciudad que los turistas suelen visitar.",
        "points": 1,
        "skill_assessed": "reading"
    }}
]

Reglas:
- Solo texto de la opción, sin prefijos como A. o 1)
- Las habilidades (skills) deben ser una de: lectura, escucha, habla, escritura"#,
                rag_context, num_questions, topic
            )
        }
    }
}

// Flatten any value into a list of question objects.
// Handles: plain array, {"questions":[...]}, {"key":[...q...]}, single object with question_text or type-specific fields.
fn flatten_into_questions(v: &serde_json::Value) -> Vec<serde_json::Value> {
    if let Some(arr) = v.as_array() {
        // Could be [[q1,q2],[q3]] if LLM wrapped questions in sub-arrays — flatten one level.
        let mut out = Vec::new();
        for item in arr {
            if item.is_object() {
                out.push(item.clone());
            } else if let Some(inner) = item.as_array() {
                for q in inner {
                    if q.is_object() {
                        out.push(q.clone());
                    }
                }
            }
        }
        return out;
    }
    if let Some(wrapped) = v.get("questions") {
        return flatten_into_questions(wrapped);
    }
    if let Some(items) = v.get("items") {
        // Only treat "items" as a wrapper when it contains question objects/arrays.
        // Ordering questions also use "items", but there it is an array of strings.
        let looks_like_question_wrapper = items
            .as_array()
            .map(|arr| arr.iter().all(|item| item.is_object() || item.is_array()))
            .unwrap_or(false);
        if looks_like_question_wrapper {
            return flatten_into_questions(items);
        }
    }
    if v.as_object().is_some() {
        // Check for type-specific fields that indicate this is a single question
        let has_question_text = v.get("question_text").is_some();
        let has_ordering_fields = v.get("items").is_some() || v.get("correct_order").is_some();
        let has_matching_fields = v.get("pairs").is_some();
        let has_blanks_fields = v.get("blanks").is_some();
        let has_options = v.get("options").is_some();
        let has_correct_answer = v.get("correct_answer").is_some() || v.get("correct").is_some();
        
        // If this looks like a single question (has question_text or type-specific fields), return it
        if has_question_text || has_ordering_fields || has_matching_fields || has_blanks_fields || 
           (has_options && (has_correct_answer || v.get("question_type").is_some())) {
            return vec![v.clone()];
        }
        
        // Otherwise, it might be {"question1": [...], "question2": [...]} — flatten all value arrays/objects
        let obj = v.as_object().unwrap();
        let mut out = Vec::new();
        for val in obj.values() {
            if val.is_object() && 
               (val.get("question_text").is_some() || 
                val.get("items").is_some() || 
                val.get("pairs").is_some() || 
                val.get("blanks").is_some() ||
                val.get("options").is_some()) {
                // Single question stored as a key's value
                out.push(val.clone());
            } else if let Some(arr) = val.as_array() {
                for q in arr {
                    if q.is_object() {
                        out.push(q.clone());
                    }
                }
            }
        }
        return out;
    }
    vec![]
}

// Helper function to parse AI response based on question type
fn parse_ai_response_for_question_type(
    questions_data: &serde_json::Value,
    _question_type: &str,
) -> Vec<serde_json::Value> {
    flatten_into_questions(questions_data)
}

/// POST /test-templates/generate-with-rag - Generar preguntas usando RAG del banco de preguntas MySQL importado
/// Usa búsqueda semántica con embeddings de pgvector cuando están disponibles, de lo contrario recurre al filtrado por course_id
pub async fn generate_questions_with_rag(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<RagGenerationPayload>,
) -> Result<Json<Vec<TestTemplateQuestion>>, (StatusCode, String)> {
    use common::ai::{self, generate_embedding};
    use serde_json::json;
    let requested_num_questions = payload.num_questions.unwrap_or(5).clamp(1, 20);

    let mut mysql_questions: Vec<QuestionBankForRAG>;
    
    // If topic is provided, use semantic search; otherwise use course_id filtering
    if let Some(topic) = &payload.topic {
        // Try semantic search with embeddings
        // Create client that accepts invalid certificates (for dev with self-signed certs)
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true)
            .build()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error del cliente HTTP: {}", e)))?;
        
        let ollama_url = ai::get_ollama_url();
        let model = ai::get_embedding_model();
        
        match generate_embedding(&client, &ollama_url, &model, topic).await {
            Ok(response) => {
                let pgvector = ai::embedding_to_pgvector(&response.embedding);
                
                // Semantic search in question_bank
                mysql_questions = sqlx::query_as(
                    r#"
                    SELECT
                        qb.question_text as descripcion,
                        qb.options,
                        COALESCE(
                            (qb.source_metadata->>'idPlanDeEstudios')::integer,
                            0
                        ) as id_plan_de_estudios,
                        COALESCE(
                            qb.source_metadata->>'plan_nombre',
                            ''
                        ) as plan_nombre,
                        COALESCE(
                            (qb.source_metadata->>'nivel_curso')::integer,
                            NULL
                        ) as nivel_curso,
                        (1 - (qb.embedding <=> $1::vector))::float4 AS similarity
                    FROM question_bank qb
                    WHERE qb.organization_id = $2
                                            AND (
                                                qb.source = 'imported-material'
                                                OR (
                                                    qb.source = 'imported-mysql'
                                                    AND (
                                                        $3::integer IS NULL
                                                        OR (qb.source_metadata->>'idCursos')::integer = $3
                                                    )
                                                )
                                            )
                      AND qb.embedding IS NOT NULL
                    ORDER BY qb.embedding <=> $1::vector
                                        LIMIT $4
                    "#
                )
                .bind(&pgvector)
                .bind(org_ctx.id)
                                .bind(payload.course_id)
                                .bind(requested_num_questions * 3) // Get more for diversity
                .fetch_all(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("La búsqueda semántica falló: {}", e)))?;
                
                tracing::info!("La búsqueda semántica encontró {} preguntas similares", mysql_questions.len());

                if mysql_questions.is_empty() {
                    tracing::info!(
                        "Sin coincidencias semánticas para el tema; recurso a búsqueda por palabras clave. topic={} course_id={:?}",
                        topic,
                        payload.course_id
                    );

                    mysql_questions = sqlx::query_as(
                        r#"
                        SELECT
                            qb.question_text as descripcion,
                            qb.options,
                            COALESCE(
                                (qb.source_metadata->>'idPlanDeEstudios')::integer,
                                0
                            ) as id_plan_de_estudios,
                            COALESCE(
                                qb.source_metadata->>'plan_nombre',
                                ''
                            ) as plan_nombre,
                            COALESCE(
                                (qb.source_metadata->>'nivel_curso')::integer,
                                NULL
                            ) as nivel_curso
                        FROM question_bank qb
                        WHERE qb.organization_id = $1
                          AND (
                              qb.source = 'imported-material'
                              OR (
                                  qb.source = 'imported-mysql'
                                  AND (
                                      $2::integer IS NULL
                                      OR (qb.source_metadata->>'idCursos')::integer = $2
                                  )
                              )
                          )
                          AND (
                              qb.question_text ILIKE $3
                              OR COALESCE(qb.options::text, '') ILIKE $3
                          )
                        LIMIT $4
                        "#
                    )
                    .bind(org_ctx.id)
                    .bind(payload.course_id)
                    .bind(&format!("%{}%", topic))
                    .bind(requested_num_questions * 3)
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("El recurso a palabras clave falló: {}", e)))?;

                    if mysql_questions.is_empty() {
                        tracing::info!(
                            "Sin coincidencias por palabras clave; recurso a preguntas importadas por curso. course_id={:?}",
                            payload.course_id
                        );

                        if let Some(course_id) = payload.course_id {
                            mysql_questions = sqlx::query_as(
                                r#"
                                SELECT
                                    qb.question_text as descripcion,
                                    qb.options,
                                    COALESCE(
                                        (qb.source_metadata->>'idPlanDeEstudios')::integer,
                                        0
                                    ) as id_plan_de_estudios,
                                    COALESCE(
                                        qb.source_metadata->>'plan_nombre',
                                        ''
                                    ) as plan_nombre,
                                    COALESCE(
                                        (qb.source_metadata->>'nivel_curso')::integer,
                                        NULL
                                    ) as nivel_curso
                                FROM question_bank qb
                                WHERE qb.organization_id = $1
                                    AND (
                                        qb.source = 'imported-material'
                                        OR (
                                            qb.source = 'imported-mysql'
                                            AND (qb.source_metadata->>'idCursos')::integer = $2
                                        )
                                    )
                                ORDER BY qb.created_at DESC
                                "#
                            )
                            .bind(org_ctx.id)
                            .bind(course_id)
                            .fetch_all(&pool)
                            .await
                            .map_err(|e| {
                                (
                                    StatusCode::INTERNAL_SERVER_ERROR,
                                    format!("El recurso por curso falló: {}", e),
                                )
                            })?;
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("La búsqueda semántica falló, recurriendo a búsqueda por palabras clave: {}", e);
                // Fall back to text search
                mysql_questions = sqlx::query_as(
                    r#"
                    SELECT
                        qb.question_text as descripcion,
                        qb.options,
                        COALESCE(
                            (qb.source_metadata->>'idPlanDeEstudios')::integer,
                            0
                        ) as id_plan_de_estudios,
                        COALESCE(
                            qb.source_metadata->>'plan_nombre',
                            ''
                        ) as plan_nombre,
                        COALESCE(
                            (qb.source_metadata->>'nivel_curso')::integer,
                            NULL
                        ) as nivel_curso
                    FROM question_bank qb
                    WHERE qb.organization_id = $1
                      AND (
                          qb.source = 'imported-material'
                          OR (
                              qb.source = 'imported-mysql'
                              AND (
                                  $2::integer IS NULL
                                  OR (qb.source_metadata->>'idCursos')::integer = $2
                              )
                          )
                      )
                      AND (
                          qb.question_text ILIKE $3
                          OR COALESCE(qb.options::text, '') ILIKE $3
                      )
                    LIMIT $4
                    "#
                )
                .bind(org_ctx.id)
                .bind(payload.course_id)
                .bind(&format!("%{}%", topic))
                .bind(requested_num_questions * 3)
                .fetch_all(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("La búsqueda por palabras clave falló: {}", e)))?;

                if mysql_questions.is_empty() {
                    tracing::info!(
                        "Sin resultados semánticos ni por palabras clave; recurso a preguntas importadas por curso. course_id={:?}",
                        payload.course_id
                    );

                    if let Some(course_id) = payload.course_id {
                        mysql_questions = sqlx::query_as(
                            r#"
                            SELECT
                                qb.question_text as descripcion,
                                qb.options,
                                COALESCE(
                                    (qb.source_metadata->>'idPlanDeEstudios')::integer,
                                    0
                                ) as id_plan_de_estudios,
                                COALESCE(
                                    qb.source_metadata->>'plan_nombre',
                                    ''
                                ) as plan_nombre,
                                COALESCE(
                                    (qb.source_metadata->>'nivel_curso')::integer,
                                    NULL
                                ) as nivel_curso
                            FROM question_bank qb
                            WHERE qb.organization_id = $1
                                AND (
                                    qb.source = 'imported-material'
                                    OR (
                                        qb.source = 'imported-mysql'
                                        AND (qb.source_metadata->>'idCursos')::integer = $2
                                    )
                                )
                            ORDER BY qb.created_at DESC
                            "#
                        )
                        .bind(org_ctx.id)
                        .bind(course_id)
                        .fetch_all(&pool)
                        .await
                        .map_err(|e| {
                            (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                format!("El recurso por curso falló: {}", e),
                            )
                        })?;
                    }
                }
            }
        }
    } else if let Some(course_id) = payload.course_id {
        // Fetch questions from imported MySQL questions in PostgreSQL question_bank
        // Filter by course_id if provided (mysql_course_id from imported metadata)
        // NO LIMIT - fetch all questions for better RAG context
        mysql_questions = sqlx::query_as(
            r#"
            SELECT
                qb.question_text as descripcion,
                qb.options,
                COALESCE(
                    (qb.source_metadata->>'idPlanDeEstudios')::integer,
                    0
                ) as id_plan_de_estudios,
                COALESCE(
                    qb.source_metadata->>'plan_nombre',
                    ''
                ) as plan_nombre,
                COALESCE(
                    (qb.source_metadata->>'nivel_curso')::integer,
                    NULL
                ) as nivel_curso
            FROM question_bank qb
            WHERE qb.organization_id = $1
                AND (
                    qb.source = 'imported-material'
                    OR (
                        qb.source = 'imported-mysql'
                        AND (qb.source_metadata->>'idCursos')::integer = $2
                    )
                )
            ORDER BY qb.created_at DESC
            "#
        )
        .bind(org_ctx.id)
        .bind(course_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al obtener las preguntas: {}", e)))?;
    } else {
        // Fetch all imported MySQL questions for this organization
        // NO LIMIT - fetch all questions for better RAG context
        mysql_questions = sqlx::query_as(
            r#"
            SELECT
                qb.question_text as descripcion,
                qb.options,
                COALESCE(
                    (qb.source_metadata->>'idPlanDeEstudios')::integer,
                    0
                ) as id_plan_de_estudios,
                COALESCE(
                    qb.source_metadata->>'plan_nombre',
                    ''
                ) as plan_nombre,
                COALESCE(
                    (qb.source_metadata->>'nivel_curso')::integer,
                    NULL
                ) as nivel_curso
            FROM question_bank qb
            WHERE qb.organization_id = $1
                AND qb.source IN ('imported-mysql', 'imported-material')
            ORDER BY qb.created_at DESC
            "#
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al obtener las preguntas: {}", e)))?;
    }

    if mysql_questions.is_empty() {
        tracing::warn!(
            "No se encontraron preguntas importadas para org={} course_id={:?} topic={:?}; recurso a preguntas de toda la organización",
            org_ctx.id,
            payload.course_id,
            payload.topic
        );

        mysql_questions = sqlx::query_as(
            r#"
            SELECT
                qb.question_text as descripcion,
                qb.options,
                COALESCE(
                    (qb.source_metadata->>'idPlanDeEstudios')::integer,
                    0
                ) as id_plan_de_estudios,
                COALESCE(
                    qb.source_metadata->>'plan_nombre',
                    ''
                ) as plan_nombre,
                COALESCE(
                    (qb.source_metadata->>'nivel_curso')::integer,
                    NULL
                ) as nivel_curso
            FROM question_bank qb
            WHERE qb.organization_id = $1
                AND qb.source IN ('imported-mysql', 'imported-material')
            ORDER BY qb.created_at DESC
            "#
        )
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al obtener preguntas de recurso de toda la organización: {}", e),
            )
        })?;

        if mysql_questions.is_empty() {
            return Err((
                StatusCode::NOT_FOUND,
                "No se encontraron materiales RAG en la organización. Importa preguntas MySQL o ingiere PDFs/audios para generar con IA.".to_string(),
            ));
        }
    }

    // Determine course_type and level from imported data
    let representative = mysql_questions
        .iter()
        .find(|q| !q.plan_nombre.trim().is_empty())
        .or_else(|| mysql_questions.first());

    let course_type = representative
        .map(|q| get_course_type_from_plan(&q.plan_nombre))
        .unwrap_or(CourseType::Regular);
    
    let level = representative
        .map(|q| get_course_level_from_mysql(q.nivel_curso, &q.plan_nombre, ""))
        .unwrap_or(CourseLevel::Intermediate);

    tracing::info!("Tipo de curso determinado: {:?}, nivel: {:?} a partir de los datos importados", course_type, level);

    // 2. Build RAG context from MySQL questions (lightweight format)
    let rag_context: String = mysql_questions
        .iter()
        .take(8) // Keep context short so Ollama starts responding sooner behind the HTTPS proxy
        .map(|q| format!("* {}", q.descripcion))
        .collect::<Vec<_>>()
        .join("\n");

    tracing::info!("Contexto RAG construido con {} preguntas", mysql_questions.len().min(8));
    
    // 3. Call AI to generate new questions based on RAG context (Ollama only)
    let base_url = std::env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let model = std::env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
    let url = format!("{}/api/chat", base_url);
    
    // Create client with extended timeout for slower Ollama instances
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600)) // 10 minutes timeout for slower machines
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    tracing::info!("Llamando a Ollama en {} con el modelo {}", url, model);

    // Save topic for later use
    let topic = payload.topic.clone().unwrap_or_else(|| "English grammar".to_string());
    let num_questions = requested_num_questions;
    let requested_question_type = match payload.question_type.as_deref() {
        Some("multiple-choice") => "multiple-choice".to_string(),
        Some("true-false") => "true-false".to_string(),
        Some("short-answer") => "short-answer".to_string(),
        Some("essay") => "essay".to_string(),
        Some("matching") => "matching".to_string(),
        Some("ordering") => "ordering".to_string(),
        Some("fill-in-the-blanks") => "fill-in-the-blanks".to_string(),
        Some("audio-response") => "audio-response".to_string(),
        Some("hotspot") | Some("code-lab") => {
            return Err((
                StatusCode::BAD_REQUEST,
                "Los tipos hotspot y code-lab se crean manualmente por el instructor".to_string(),
            ));
        }
        Some(_) | None => "multiple-choice".to_string(),
    };

    // Keep the prompt compact so the upstream Ollama proxy can receive the first bytes quickly.
    let system_prompt = get_system_prompt_for_question_type(
        &requested_question_type,
        num_questions,
        &topic,
        &rag_context,
    );

    tracing::debug!("Longitud del prompt del sistema: {} caracteres", system_prompt.len());
    
    let request = client
        .post(&url)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": "Generate the questions in valid JSON format."
                }
            ],
            "stream": true,
            "format": "json",
            "options": {
                "temperature": 0.3,
                "num_predict": (num_questions * 160).clamp(160, 900)
            }
        }));

    tracing::info!("Enviando solicitud a Ollama (modelo: {}, longitud del prompt: {} caracteres)", model, system_prompt.len());
    
    let response = request.send().await.map_err(|e| {
        tracing::error!("AI request failed after timeout: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Ollama timeout - el equipo t-800 está tardando en responder. Intenta nuevamente: {}", e))
    })?;

    tracing::info!("Estado de la respuesta de Ollama: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::error!("Ollama devolvió un estado de error {}: {}", status, body);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Ollama returned {}. El proxy de IA agotó el tiempo de espera.", status),
        ));
    }

    let response_text = response.text().await.map_err(|e| {
        tracing::error!("Error al leer la respuesta del flujo de la IA: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Respuesta de IA inválida".to_string())
    })?;

    let aggregated_content = response_text
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }

            serde_json::from_str::<serde_json::Value>(trimmed)
                .ok()
                .and_then(|chunk| {
                    chunk.get("message")
                        .and_then(|m| m.get("content"))
                        .and_then(|content| content.as_str())
                        .map(str::to_string)
                })
        })
        .collect::<String>();

    let response_json = json!({
        "message": {
            "content": aggregated_content
        }
    });

    tracing::debug!("Respuesta de Ollama: {:?}", response_json);

    // Parse questions from Ollama response
    let ai_payload = response_json
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|content| content.as_str())
        .and_then(|content| serde_json::from_str::<serde_json::Value>(content).ok())
        .unwrap_or_else(|| json!([]));

    let questions_data = parse_ai_response_for_question_type(&ai_payload, &requested_question_type);

    // Helper function to clean options (remove "A.", "B.", "a)", etc.)
    let clean_option = |opt: &str| -> String {
        let opt = opt.trim();
        // Remove patterns like "A.", "B.", "a)", "b)", "1.", "1)", "A)", "B)"
        let patterns = [
            (r"^[A-Za-z]\.\s*", ""),  // "A. ", "B. "
            (r"^[A-Za-z]\)\s*", ""),  // "A) ", "B) "
            (r"^\d+\.\s*", ""),       // "1. ", "2. "
            (r"^\d+\)\s*", ""),       // "1) ", "2) "
            (r"^Option\s+[A-Za-z]\.?\s*", ""), // "Option A. ", "Option B "
            (r"^Answer\s*[:\.]?\s*", ""),      // "Answer: ", "Answer. "
        ];
        
        let mut cleaned = opt.to_string();
        for (pattern, replacement) in patterns.iter() {
            if let Ok(re) = regex::Regex::new(pattern) {
                cleaned = re.replace(&cleaned, *replacement).to_string();
            }
        }
        cleaned.trim().to_string()
    };

    // Helper function to shuffle options and adjust correct_answer index
    let shuffle_options = |options: Vec<String>, correct_answer: Option<i64>| -> (Vec<String>, Option<i64>) {
        use rand::seq::SliceRandom;
        use rand::thread_rng;
        
        if options.is_empty() || correct_answer.is_none() {
            return (options, correct_answer);
        }
        
        let correct_idx = correct_answer.unwrap() as usize;
        if correct_idx >= options.len() {
            return (options, correct_answer);
        }
        
        // Store the correct answer text
        let correct_answer_text = options[correct_idx].clone();
        
        // Create a vector of indices and shuffle it
        let mut indices: Vec<usize> = (0..options.len()).collect();
        let mut rng = thread_rng();
        indices.shuffle(&mut rng);
        
        // Reorder options according to shuffled indices
        let shuffled_options: Vec<String> = indices.iter().map(|&i| options[i].clone()).collect();
        
        // Find the new position of the correct answer
        let new_correct_idx = shuffled_options
            .iter()
            .position(|opt| opt == &correct_answer_text)
            .map(|idx| idx as i64);
        
        (shuffled_options, new_correct_idx)
    };

    // Convert to TestTemplateQuestion format and skip invalid LLM entries
    let generated_questions: Vec<TestTemplateQuestion> = questions_data
        .iter()
        .enumerate()
        .filter_map(|(idx, q)| {
            let question_type_value = q
                .get("question_type")
                .and_then(|v| v.as_str())
                .unwrap_or(&requested_question_type)
                .to_string();

            let question_text = q
                .get("question_text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();

            if question_text.is_empty() || question_text.eq_ignore_ascii_case("question") {
                tracing::warn!("Omitiendo pregunta generada inválida con texto de marcador vacío: {:?}", q);
                return None;
            }

            // Get original options and correct answer
            let original_options: Vec<String> = q
                .get("options")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| clean_option(s))
                        .collect()
                })
                .unwrap_or_default();

            let original_correct_idx: Option<usize> = q
                .get("correct_answer")
                .or(q.get("correct"))
                .and_then(|v| v.as_i64())
                .map(|idx| idx as usize);

            let (options, correct_answer, options_shuffled) = match question_type_value.as_str() {
                "multiple-choice" => {
                    if original_options.len() < 2 {
                        tracing::warn!("Omitiendo pregunta de opción múltiple inválida sin suficientes opciones: {:?}", q);
                        return None;
                    }
                    if !original_options.is_empty() && original_correct_idx.is_some() {
                        let correct_idx = original_correct_idx.unwrap();
                        if correct_idx < original_options.len() {
                            let (shuffled, new_correct_idx) =
                                shuffle_options(original_options.clone(), Some(correct_idx as i64));
                            (Some(json!(shuffled)), new_correct_idx.map(|idx| json!(idx)), true)
                        } else {
                            (
                                Some(json!(original_options)),
                                q.get("correct_answer").or(q.get("correct")).cloned(),
                                false,
                            )
                        }
                    } else {
                        (
                            Some(json!(original_options)),
                            q.get("correct_answer").or(q.get("correct")).cloned(),
                            false,
                        )
                    }
                }
                "true-false" => {
                    let bool_answer = q
                        .get("correct_answer")
                        .or(q.get("correct"))
                        .and_then(|v| v.as_bool())
                        .map(|v| if v { json!(0) } else { json!(1) });
                    if bool_answer.is_none() {
                        tracing::warn!("Omitiendo pregunta de verdadero-falso inválida sin respuesta correcta booleana: {:?}", q);
                        return None;
                    }
                    (Some(json!(["True", "False"])), bool_answer, false)
                }
                "matching" => {
                    let pairs = q.get("pairs").cloned().or_else(|| q.get("options").cloned());
                    let is_valid = pairs
                        .as_ref()
                        .and_then(|v| v.as_array())
                        .map(|arr| !arr.is_empty())
                        .unwrap_or(false);
                    if !is_valid {
                        tracing::warn!("Omitiendo pregunta de emparejamiento inválida sin pares: {:?}", q);
                        return None;
                    }
                    (pairs.clone(), pairs, false)
                }
                "ordering" => {
                    let items = q.get("items").cloned().or_else(|| q.get("options").cloned());
                    let order = q
                        .get("correct_order")
                        .cloned()
                        .or_else(|| q.get("correct_answer").cloned())
                        .or_else(|| q.get("correct").cloned());
                    let has_items = items
                        .as_ref()
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.len() >= 2)
                        .unwrap_or(false);
                    let has_order = order
                        .as_ref()
                        .and_then(|v| v.as_array())
                        .map(|arr| !arr.is_empty())
                        .unwrap_or(false);
                    if !has_items || !has_order {
                        tracing::warn!("Omitiendo pregunta de ordenación inválida sin elementos/orden: {:?}", q);
                        return None;
                    }
                    (items, order, false)
                }
                "fill-in-the-blanks" => {
                    let blanks = q.get("blanks").cloned();
                    let has_blanks = blanks
                        .as_ref()
                        .and_then(|v| v.as_array())
                        .map(|arr| !arr.is_empty())
                        .unwrap_or(false);
                    if !has_blanks {
                        tracing::warn!("Omitiendo pregunta de completar espacios en blanco inválida sin array de espacios: {:?}", q);
                        return None;
                    }
                    (blanks.clone(), blanks, false)
                }
                _ => (
                    None,
                    q.get("correct_answer").or(q.get("correct")).cloned(),
                    false,
                ),
            };

            Some(TestTemplateQuestion {
                id: Uuid::new_v4(),
                template_id: Uuid::nil(),
                section_id: None,
                question_order: idx as i32,
                question_type: question_type_value,
                question_text,
                options,
                correct_answer,
                explanation: q.get("explanation").and_then(|v| v.as_str()).map(String::from),
                points: q.get("points").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                metadata: Some(json!({
                    "generated_by": "rag-ai",
                    "source": "mysql-bank",
                    "generated_at": chrono::Utc::now().to_rfc3339(),
                    "question_type_requested": requested_question_type.clone(),
                    "options_shuffled": options_shuffled,
                })),
                created_at: chrono::Utc::now(),
            })
        })
        .collect();
    
    if generated_questions.is_empty() {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "La IA no pudo generar las preguntas".to_string()));
    }

    // Save generated questions to question bank
    let mut saved_count = 0;
    for question in &generated_questions {
        let question_type = match question.question_type.as_str() {
            "true-false" => common::models::QuestionBankType::TrueFalse,
            "short-answer" => common::models::QuestionBankType::ShortAnswer,
            "essay" => common::models::QuestionBankType::Essay,
            "matching" => common::models::QuestionBankType::Matching,
            "ordering" => common::models::QuestionBankType::Ordering,
            "fill-in-the-blanks" => common::models::QuestionBankType::FillInTheBlanks,
            "audio-response" => common::models::QuestionBankType::AudioResponse,
            _ => common::models::QuestionBankType::MultipleChoice,
        };

        let (normalized_options, normalized_correct_answer) =
            normalize_question_bank_payload_values(
                question.options.clone(),
                question.correct_answer.clone(),
            );

        let result = sqlx::query(
            r#"
            INSERT INTO question_bank (
                organization_id, created_by, question_text, question_type,
                options, correct_answer, explanation, points, difficulty,
                source, source_metadata, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
            "#
        )
        .bind(org_ctx.id)
        .bind(claims.sub)
        .bind(&question.question_text)
        .bind(&question_type)
        .bind(&normalized_options)
        .bind(&normalized_correct_answer)
        .bind(&question.explanation)
        .bind(question.points)
        .bind("medium")
        .bind("rag-ai")
        .bind(&json!({
            "generated_by": "rag-ai",
            "source": "mysql-bank",
            "topic": topic,
            "question_type": requested_question_type.clone(),
            "generated_at": chrono::Utc::now().to_rfc3339(),
        }))
        .execute(&pool)
        .await;

        if result.is_ok() {
            saved_count += 1;
        }
    }

    tracing::info!(
        "Generadas {} preguntas usando RAG del banco MySQL, guardadas {} al banco de preguntas",
        generated_questions.len(),
        saved_count
    );

    Ok(Json(generated_questions))
}

#[derive(Debug, Deserialize)]
pub struct RagGenerationPayload {
    pub course_id: Option<i32>, // MySQL course ID from imported metadata
    pub topic: Option<String>,
    pub num_questions: Option<i32>,
    pub question_type: Option<String>, // Type of question to generate: multiple-choice, true-false, short-answer, matching, ordering, fill-in-the-blanks
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct QuestionBankForRAG {
    descripcion: String,
    options: Option<serde_json::Value>,
    id_plan_de_estudios: i32,
    plan_nombre: String,
    nivel_curso: Option<i32>,
    #[sqlx(default)]
    similarity: Option<f32>,
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct MySqlQuestion {
    descripcion: String,
    id_tipo_pregunta: i32,
    nombre_curso: String,
    plan_nombre: String,
    nivel_curso: Option<i32>,
    id_plan_de_estudios: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct MySqlTemplateCourseMetadata {
    id_cursos: i32,
    nombre_curso: String,
    nivel_curso: Option<i32>,
    id_plan_de_estudios: i32,
    nombre_plan: String,
    duracion: Option<f64>,
}

async fn ensure_mysql_course_metadata(
    pool: &PgPool,
    org_id: Uuid,
    mysql_course_id: i32,
) -> Result<(), (StatusCode, String)> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mysql_courses WHERE organization_id = $1 AND mysql_id = $2)"
    )
    .bind(org_id)
    .bind(mysql_course_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to check MySQL course metadata: {}", e),
        )
    })?;

    if exists {
        return Ok(());
    }

    let mysql_url = std::env::var("MYSQL_DATABASE_URL").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "MYSQL_DATABASE_URL no configurada".to_string(),
        )
    })?;

    let mysql_pool = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(2)
        .min_connections(0)
        .acquire_timeout(Duration::from_secs(15))
        .idle_timeout(Duration::from_secs(30))
        .max_lifetime(Duration::from_secs(300))
        .connect(&mysql_url)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al conectar con MySQL externo: {}", e),
            )
        })?;

    let course: MySqlTemplateCourseMetadata = sqlx::query_as(
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
        WHERE c.idCursos = ?
          AND c.Activo = 1
          AND pe.Activo = 1
        "#
    )
    .bind(mysql_course_id)
    .fetch_one(&mysql_pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (
            StatusCode::BAD_REQUEST,
            format!("Curso MySQL {} no existe o no está activo", mysql_course_id),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch course metadata from MySQL: {}", e),
        ),
    })?;

    let plan_course_type = calculate_course_type_from_plan_name(&course.nombre_plan);

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
    .bind(course.id_plan_de_estudios)
    .bind(org_id)
    .bind(&course.nombre_plan)
    .bind(&plan_course_type)
    .execute(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al actualizar/insertar los metadatos del plan de estudios MySQL: {}", e),
        )
    })?;

    let study_plan_id: i32 = sqlx::query_scalar(
        "SELECT id FROM mysql_study_plans WHERE mysql_id = $1 AND organization_id = $2"
    )
    .bind(course.id_plan_de_estudios)
    .bind(org_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al resolver los metadatos del plan de estudios MySQL: {}", e),
        )
    })?;

    let course_type = calculate_course_type_from_duration(course.duracion);
    let level_calculated = calculate_course_level_for_storage(course.nivel_curso);
    let duracion = course.duracion.map(|value| value.round() as i32);

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
    .bind(duracion)
    .bind(&course_type)
    .bind(&level_calculated)
    .execute(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al actualizar/insertar los metadatos del curso MySQL: {}", e),
        )
    })?;

    mysql_pool.close().await;
    Ok(())
}

fn calculate_course_type_from_plan_name(plan_name: &str) -> String {
    let plan_lower = plan_name.to_lowercase();
    if plan_lower.contains("intensive") || plan_lower.contains("intensivo") {
        "intensive".to_string()
    } else {
        "regular".to_string()
    }
}

fn calculate_course_type_from_duration(duracion: Option<f64>) -> String {
    match duracion {
        Some(value) if value >= 70.0 => "intensive".to_string(),
        _ => "regular".to_string(),
    }
}

fn calculate_course_level_for_storage(nivel: Option<i32>) -> String {
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

/// Helper function to determine course type from plan name
fn get_course_type_from_plan(plan_name: &str) -> CourseType {
    let plan_lower = plan_name.to_lowercase();
    if plan_lower.contains("intensive") || plan_lower.contains("intensivo") {
        CourseType::Intensive
    } else {
        CourseType::Regular
    }
}

/// Helper function to determine course level from MySQL data
fn get_course_level_from_mysql(nivel_curso: Option<i32>, plan_nombre: &str, _nombre_curso: &str) -> CourseLevel {
    // Try to determine level from nivel_curso field first
    if let Some(nivel) = nivel_curso {
        return match nivel {
            1..=2 => CourseLevel::Beginner,
            3..=4 => CourseLevel::Beginner_1,
            5..=6 => CourseLevel::Beginner_2,
            7..=8 => CourseLevel::Intermediate,
            9..=10 => CourseLevel::Intermediate_1,
            11..=12 => CourseLevel::Intermediate_2,
            _ => CourseLevel::Advanced,
        };
    }
    
    // Fallback: try to extract level from plan name
    let plan_lower = plan_nombre.to_lowercase();
    if plan_lower.contains("basic") || plan_lower.contains("beginner") {
        CourseLevel::Beginner
    } else if plan_lower.contains("intermediate") || plan_lower.contains("intermedio") {
        CourseLevel::Intermediate
    } else {
        CourseLevel::Advanced
    }
}
