use crate::handlers::run_transcription_task;
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct BackgroundTask {
    pub id: Uuid,
    pub title: String,
    pub course_title: Option<String>,
    pub task_type: String, // 'transcription'
    pub status: String,
    pub progress: i32,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_background_tasks(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<BackgroundTask>>, (StatusCode, String)> {
    let query = r#"
        SELECT id, title, course_title, task_type, status, progress, updated_at
        FROM (
            SELECT
                l.id,
                l.title,
                c.title as course_title,
                'lesson_transcription' as task_type,
                l.transcription_status as status,
                0 as progress,
                l.updated_at
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            JOIN courses c ON m.course_id = c.id
            WHERE l.transcription_status IN ('queued', 'processing', 'failed')

            UNION ALL

            SELECT
                t.id,
                t.title,
                t.course_title,
                t.task_type,
                t.status,
                t.progress,
                t.updated_at
            FROM background_tasks t
            WHERE t.task_type = 'zip_rag_import'
              AND t.status IN ('queued', 'processing', 'failed', 'completed')
        ) merged
        ORDER BY updated_at DESC
        LIMIT 200
    "#;

    let tasks = sqlx::query_as::<_, BackgroundTask>(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch tasks: {}", e),
            )
        })?;

    Ok(Json(tasks))
}

#[derive(sqlx::FromRow)]
struct LessonStatusRow {
    transcription_status: Option<String>,
}

pub async fn retry_task(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    
    // Check lessons for transcription failures
    let lesson = sqlx::query_as::<_, LessonStatusRow>("SELECT transcription_status FROM lessons WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(l) = lesson {
        let pool_clone = pool.clone();
        if l.transcription_status.as_deref() == Some("failed") {
            tokio::spawn(async move {
                let _ = sqlx::query("UPDATE lessons SET transcription_status = 'queued' WHERE id = $1").bind(id).execute(&pool_clone).await;
                let _ = run_transcription_task(pool_clone, id).await;
            });
            return Ok(StatusCode::ACCEPTED);
        }
    }

    Ok(StatusCode::NOT_FOUND)
}

pub async fn cancel_task(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Only cancel transcription in lessons
    let _ = sqlx::query(
        "UPDATE lessons SET transcription_status = 'idle' WHERE id = $1"
    )
    .bind(id)
    .execute(&pool)
    .await;

    Ok(StatusCode::NO_CONTENT)
}
