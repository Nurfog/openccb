use crate::handlers::run_transcription_task;
use crate::handlers_assets::{ingest_asset_for_rag_core, set_zip_rag_task_status};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use tokio::time::Duration;
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

#[derive(sqlx::FromRow)]
struct ZipRetryTaskRow {
    id: Uuid,
    organization_id: Uuid,
    created_by: Uuid,
    metadata: serde_json::Value,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow)]
struct AssetIdRow {
    id: Uuid,
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

    let zip_task = sqlx::query_as::<_, ZipRetryTaskRow>(
        r#"
                SELECT id, organization_id, created_by, metadata, created_at
        FROM background_tasks
        WHERE id = $1
          AND task_type = 'zip_rag_import'
          AND status = 'failed'
        "#,
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(task) = zip_task {
        let zip_batch_id_from_metadata = task
            .metadata
            .get("zip_batch_id")
            .and_then(|v| v.as_str())
            .map(|raw| {
                Uuid::parse_str(raw).map_err(|_| {
                    (
                        StatusCode::BAD_REQUEST,
                        "zip_batch_id inválido en metadata de la tarea".to_string(),
                    )
                })
            })
            .transpose()?;

        let zip_batch_id = if let Some(id) = zip_batch_id_from_metadata {
            id
        } else {
            #[derive(sqlx::FromRow)]
            struct ZipBatchIdRow {
                zip_batch_id: Uuid,
            }

            let candidates = sqlx::query_as::<_, ZipBatchIdRow>(
                r#"
                SELECT zip_batch_id
                FROM assets
                WHERE organization_id = $1
                  AND uploaded_by = $2
                  AND zip_batch_id IS NOT NULL
                  AND created_at BETWEEN ($3 - INTERVAL '30 minutes') AND ($3 + INTERVAL '30 minutes')
                GROUP BY zip_batch_id
                ORDER BY COUNT(*) DESC, MAX(created_at) DESC
                "#,
            )
            .bind(task.organization_id)
            .bind(task.created_by)
            .bind(task.created_at)
            .fetch_all(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            if candidates.len() == 1 {
                candidates[0].zip_batch_id
            } else if candidates.is_empty() {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "La tarea no tiene zip_batch_id y no se pudo inferir un lote asociado. Vuelve a cargar el ZIP para reingestar.".to_string(),
                ));
            } else {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "La tarea no tiene zip_batch_id y hay múltiples lotes candidatos; vuelve a cargar el ZIP para evitar ambigüedad.".to_string(),
                ));
            }
        };

        let assets = sqlx::query_as::<_, AssetIdRow>(
            "SELECT id FROM assets WHERE organization_id = $1 AND zip_batch_id = $2 ORDER BY created_at ASC",
        )
        .bind(task.organization_id)
        .bind(zip_batch_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if assets.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                "No se encontraron assets para ese zip_batch_id".to_string(),
            ));
        }

        let pool_clone = pool.clone();
        tokio::spawn(async move {
            let total = assets.len();
            let mut processed = 0usize;
            let mut failed = 0usize;

            let _ = set_zip_rag_task_status(&pool_clone, task.id, "processing", 0, 0, 0, None).await;

            for row in assets {
                let ingest_result = tokio::time::timeout(
                    Duration::from_secs(120),
                    ingest_asset_for_rag_core(&pool_clone, task.organization_id, task.created_by, row.id),
                )
                .await;

                match ingest_result {
                    Ok(Ok(_)) => {
                        processed += 1;
                    }
                    Ok(Err(msg)) => {
                        failed += 1;
                        tracing::warn!(
                            "Retry ZIP RAG: fallo ingesta asset {} en task {}: {}",
                            row.id,
                            task.id,
                            msg
                        );
                    }
                    Err(_elapsed) => {
                        failed += 1;
                        tracing::warn!(
                            "Retry ZIP RAG: timeout (120s) en asset {} en task {}",
                            row.id,
                            task.id
                        );
                    }
                }

                let progress = (((processed + failed) as f32 / total as f32) * 100.0)
                    .round()
                    .clamp(0.0, 100.0) as i32;

                let _ = set_zip_rag_task_status(
                    &pool_clone,
                    task.id,
                    "processing",
                    progress,
                    processed,
                    failed,
                    None,
                )
                .await;
            }

            let final_status = if failed > 0 { "failed" } else { "completed" };
            let final_msg = if failed > 0 {
                Some("Reintento RAG completado con errores parciales")
            } else {
                None
            };
            if let Err(e) = set_zip_rag_task_status(
                &pool_clone,
                task.id,
                final_status,
                100,
                processed,
                failed,
                final_msg,
            )
            .await
            {
                tracing::error!(
                    "Retry ZIP RAG: no se pudo actualizar estado final de task {} a '{}': {:?}",
                    task.id,
                    final_status,
                    e
                );
            }
        });

        return Ok(StatusCode::ACCEPTED);
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
