use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use common::models::{Course, Enrollment};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn enroll_user(
    State(pool): State<PgPool>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Enrollment>, StatusCode> {
    let course_id_str = payload.get("course_id").and_then(|v| v.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let course_id = Uuid::parse_str(course_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let user_id = Uuid::new_v4(); // Placeholder for actual auth

    let enrollment = sqlx::query_as::<_, Enrollment>(
        "INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) RETURNING *"
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(enrollment))
}

pub async fn get_course_catalog(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Course>>, StatusCode> {
    let courses = sqlx::query_as::<_, Course>("SELECT * FROM courses")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(courses))
}
