use axum::{
    Json,
    extract::{Path, State},
    http::{StatusCode, HeaderMap},
};
use common::models::Course;
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
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Course>, StatusCode> {
    let org_id = validate_api_key(&headers, &pool).await?;
    
    // We reuse the internal logic but with the org_id from the API key
    // We need to provide a mock claims for handlers::create_course or refactor it.
    // Simplifying for now: direct DB call or calling handlers with constructed context.
    
    let title = payload.get("title").and_then(|t| t.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let description = payload.get("description").and_then(|d| d.as_str());
    
    let course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (organization_id, title, description, instructor_id, pacing_mode) 
         VALUES ($1, $2, $3, '00000000-0000-0000-0000-000000000001', $4) RETURNING *"
    )
    .bind(org_id)
    .bind(title)
    .bind(description)
    .bind(payload.get("pacing_mode").and_then(|p| p.as_str()).unwrap_or("self_paced"))
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("External course creation failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(course))
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
    
    // Verify lesson belongs to org
    let _ = sqlx::query("SELECT 1 FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // Queue transcription
    sqlx::query("UPDATE lessons SET transcription_status = 'queued' WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::ACCEPTED)
}
