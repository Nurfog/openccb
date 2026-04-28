use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::models::{SaveNotePayload, StudentNote};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn get_note(
    claims: Claims,
    Path(lesson_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Option<StudentNote>>, (StatusCode, String)> {
    let note = sqlx::query_as::<_, StudentNote>(
        "SELECT * FROM student_notes WHERE user_id = $1 AND lesson_id = $2",
    )
    .bind(claims.sub)
    .bind(lesson_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(note))
}

pub async fn save_note(
    claims: Claims,
    Path(lesson_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<SaveNotePayload>,
) -> Result<Json<StudentNote>, (StatusCode, String)> {
    let note = sqlx::query_as::<_, StudentNote>(
        r#"
        INSERT INTO student_notes (user_id, lesson_id, content)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, lesson_id) 
        DO UPDATE SET 
            content = EXCLUDED.content,
            updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(claims.sub)
    .bind(lesson_id)
    .bind(payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(note))
}
