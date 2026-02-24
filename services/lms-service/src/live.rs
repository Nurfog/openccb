use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use common::auth::Claims;
use common::models::Meeting;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateMeetingPayload {
    pub title: String,
    pub description: Option<String>,
    pub start_at: chrono::DateTime<Utc>,
    pub duration_minutes: i32,
}

pub async fn get_course_meetings(
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
    claims: Claims,
) -> Result<Json<Vec<Meeting>>, (StatusCode, String)> {
    let meetings = sqlx::query_as::<sqlx::Postgres, Meeting>(
        "SELECT * FROM meetings WHERE course_id = $1 AND organization_id = $2 ORDER BY start_at ASC"
    )
    .bind(course_id)
    .bind(claims.org)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(meetings))
}

pub async fn create_meeting(
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
    claims: Claims,
    Json(payload): Json<CreateMeetingPayload>,
) -> Result<Json<Meeting>, (StatusCode, String)> {
    if claims.role == "student" {
        return Err((StatusCode::FORBIDDEN, "Only instructors can create meetings".to_string()));
    }

    let meeting_id = format!("openccb-{}", Uuid::new_v4());
    let join_url = format!("https://meet.jit.si/{}", meeting_id);

    let meeting = sqlx::query_as::<sqlx::Postgres, Meeting>(
        r#"
        INSERT INTO meetings (organization_id, course_id, title, description, provider, meeting_id, start_at, duration_minutes, join_url)
        VALUES ($1, $2, $3, $4, 'jitsi', $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(claims.org)
    .bind(course_id)
    .bind(payload.title)
    .bind(payload.description)
    .bind(meeting_id)
    .bind(payload.start_at)
    .bind(payload.duration_minutes)
    .bind(join_url)
    .fetch_one(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(meeting))
}

pub async fn delete_meeting(
    Path((_course_id, meeting_id)): Path<(Uuid, Uuid)>,
    State(pool): State<PgPool>,
    claims: Claims,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role == "student" {
        return Err((StatusCode::FORBIDDEN, "Only instructors can delete meetings".to_string()));
    }

    sqlx::query("DELETE FROM meetings WHERE id = $1 AND organization_id = $2")
        .bind(meeting_id)
        .bind(claims.org)
        .execute(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}
