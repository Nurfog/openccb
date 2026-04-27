use axum::{
    Json,
    extract::{Path, State},
    http::{StatusCode, HeaderMap},
};
use common::models::Course;
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

async fn validate_api_key(headers: &HeaderMap, pool: &PgPool) -> Result<Uuid, StatusCode> {
    let api_key = headers
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let org_id: Uuid = sqlx::query_scalar("SELECT id FROM organizations WHERE api_key = $1")
        .bind(Uuid::parse_str(api_key).map_err(|_| StatusCode::UNAUTHORIZED)?)
        .fetch_one(pool)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(org_id)
}

pub async fn create_course_external(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<ExternalCreateCoursePayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let org_id = validate_api_key(&headers, &pool).await?;
    
    // Reutilizamos la lógica interna pero con el org_id de la clave API
    // Necesitamos proporcionar un reclamo ficticio (mock claims) para handlers::create_course o refactorizarlo.
    // Simplificando por ahora: llamada directa a la BD o llamando a manejadores con contexto construido.
    
    let title = payload.title.trim();
    if title.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let description = payload.description.as_deref();
    
    let course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (organization_id, external_sam_id, title, description, instructor_id, pacing_mode) 
         VALUES ($1, $2, $3, $4, '00000000-0000-0000-0000-000000000001', $5) RETURNING *"
    )
    .bind(org_id)
    .bind(payload.external_sam_id)
    .bind(title)
    .bind(description)
    .bind(payload.pacing_mode.as_deref().unwrap_or("self_paced"))
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("La creación del curso externo falló: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let selected_template_id = resolve_template_id(
        &pool,
        org_id,
        payload.template_id,
        payload.template_level.as_deref(),
        payload.template_course_type.as_deref(),
        payload.template_test_type.as_deref(),
    )
    .await?;

    let mut lesson_id: Option<Uuid> = None;
    if let Some(template_id) = selected_template_id {
        lesson_id = Some(
            create_course_lesson_and_apply_template(
                &pool,
                org_id,
                course.id,
                template_id,
                payload.module_title.as_deref().unwrap_or("Evaluaciones"),
                payload.lesson_title.as_deref().unwrap_or("Evaluación inicial"),
            )
            .await?,
        );
    }

    Ok(Json(json!({
        "course": course,
        "template_applied": selected_template_id.is_some(),
        "template_id": selected_template_id,
        "lesson_id": lesson_id,
    })))
}

#[derive(Debug, Deserialize)]
pub struct ExternalCreateCoursePayload {
    pub title: String,
    pub description: Option<String>,
    pub pacing_mode: Option<String>,
    #[serde(alias = "idcursoabierto", alias = "id_curso_abierto")]
    pub external_sam_id: Option<i64>,
    // Selección directa de plantilla opcional
    pub template_id: Option<Uuid>,
    // Selección de respaldo (fallback) opcional por nivel/tipo de curso/tipo de test
    pub template_level: Option<String>,
    pub template_course_type: Option<String>,
    pub template_test_type: Option<String>,
    pub module_title: Option<String>,
    pub lesson_title: Option<String>,
}

async fn resolve_template_id(
    pool: &PgPool,
    org_id: Uuid,
    direct_template_id: Option<Uuid>,
    level: Option<&str>,
    course_type: Option<&str>,
    test_type: Option<&str>,
) -> Result<Option<Uuid>, StatusCode> {
    if let Some(template_id) = direct_template_id {
        let exists: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM test_templates WHERE id = $1 AND organization_id = $2 AND is_active = true"
        )
        .bind(template_id)
        .bind(org_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        if exists.is_none() {
            return Err(StatusCode::BAD_REQUEST);
        }
        return Ok(Some(template_id));
    }

    if level.is_none() && course_type.is_none() && test_type.is_none() {
        return Ok(None);
    }

    let selected: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT id
        FROM test_templates
        WHERE organization_id = $1
          AND is_active = true
          AND ($2::course_level IS NULL OR level = $2::course_level)
          AND ($3::course_type IS NULL OR course_type = $3::course_type)
          AND ($4::test_type IS NULL OR test_type = $4::test_type)
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(org_id)
    .bind(level)
    .bind(course_type)
    .bind(test_type)
    .fetch_optional(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(selected)
}

async fn create_course_lesson_and_apply_template(
    pool: &PgPool,
    org_id: Uuid,
    course_id: Uuid,
    template_id: Uuid,
    module_title: &str,
    lesson_title: &str,
) -> Result<Uuid, StatusCode> {
    let module_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO modules (course_id, organization_id, title, position)
        VALUES ($1, $2, $3, 1)
        RETURNING id
        "#,
    )
    .bind(course_id)
    .bind(org_id)
    .bind(module_title)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let lesson_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO lessons (module_id, organization_id, title, content_type, position, is_graded, max_attempts, allow_retry)
        VALUES ($1, $2, $3, 'quiz', 1, true, 1, false)
        RETURNING id
        "#,
    )
    .bind(module_id)
    .bind(org_id)
    .bind(lesson_title)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let template: (Uuid, String, String, i32, i32, i32, Option<String>) = sqlx::query_as(
        r#"
        SELECT id, name, test_type::text, duration_minutes, passing_score, total_points, instructions
        FROM test_templates
        WHERE id = $1 AND organization_id = $2
        "#,
    )
    .bind(template_id)
    .bind(org_id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::BAD_REQUEST)?;

    let template_questions: Vec<(Uuid, String, String, Option<serde_json::Value>, Option<serde_json::Value>, Option<String>, i32)> = sqlx::query_as(
        r#"
        SELECT id, question_type, question_text, options, correct_answer, explanation, points
        FROM test_template_questions
        WHERE template_id = $1
        ORDER BY section_id, question_order
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let questions_json: Vec<serde_json::Value> = template_questions
        .iter()
        .map(|q| {
            json!({
                "id": q.0.to_string(),
                "type": q.1,
                "question": q.2,
                "options": q.3,
                "correct": q.4,
                "explanation": q.5,
                "points": q.6,
            })
        })
        .collect();

    let quiz_data = json!({
        "questions": questions_json,
        "template_id": template.0.to_string(),
        "template_name": template.1,
        "test_type": template.2,
        "duration_minutes": template.3,
        "passing_score": template.4,
        "total_points": template.5,
        "instructions": template.6,
        "max_attempts": 1,
        "show_feedback": true,
        "permanent_history": true,
    });

    sqlx::query(
        r#"
        UPDATE lessons
        SET content_type = 'quiz',
            metadata = $1,
            is_graded = true,
            max_attempts = 1,
            allow_retry = false,
            updated_at = NOW()
        WHERE id = $2 AND organization_id = $3
        "#,
    )
    .bind(&quiz_data)
    .bind(lesson_id)
    .bind(org_id)
    .execute(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = sqlx::query("SELECT increment_template_usage($1)")
        .bind(template_id)
        .execute(pool)
        .await;

    Ok(lesson_id)
}

pub async fn get_course_external(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let org_id = validate_api_key(&headers, &pool).await?;
    
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(json!({ "course": course })))
}

pub async fn trigger_transcription_external(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let org_id = validate_api_key(&headers, &pool).await?;
    
    // Verificar que la lección pertenece a la organización
    let _ = sqlx::query("SELECT 1 FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // Encolar transcripción
    sqlx::query("UPDATE lessons SET transcription_status = 'queued' WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::ACCEPTED)
}
