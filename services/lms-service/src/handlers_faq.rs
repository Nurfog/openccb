use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

fn ensure_reviewer_role(claims: &Claims) -> Result<(), (StatusCode, String)> {
    if claims.role != "admin" && claims.role != "instructor" {
        return Err((StatusCode::FORBIDDEN, "No autorizado".to_string()));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ImportCandidatesPayload {
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ImportCandidatesResponse {
    pub imported: i64,
    pub skipped: i64,
}

#[derive(Debug, Deserialize)]
pub struct ReviewQueueFilters {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FaqReviewItem {
    pub id: Uuid,
    pub source_ai_usage_log_id: Option<Uuid>,
    pub user_id: Uuid,
    pub student_name: Option<String>,
    pub student_email: Option<String>,
    pub lesson_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub question_text: String,
    pub ai_response: Option<String>,
    pub rag_context_found: bool,
    pub status: String,
    pub reviewer_id: Option<Uuid>,
    pub reviewer_name: Option<String>,
    pub reviewer_note: Option<String>,
    pub human_answer: Option<String>,
    pub faq_entry_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct FaqReviewQueueResponse {
    pub items: Vec<FaqReviewItem>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Deserialize)]
pub struct AnswerReviewPayload {
    pub human_answer: String,
    pub reviewer_note: Option<String>,
    pub publish_to_faq: Option<bool>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct DismissReviewPayload {
    pub reviewer_note: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FaqEntry {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub question: String,
    pub answer: String,
    pub tags: Option<Vec<String>>,
    pub source: String,
    pub created_by: Option<Uuid>,
    pub is_published: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct FaqEntriesFilters {
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// POST /faq/review/import-candidates
/// Importa preguntas de chats de alumnos donde RAG no encontró contexto suficiente.
pub async fn import_faq_candidates(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ImportCandidatesPayload>,
) -> Result<Json<ImportCandidatesResponse>, (StatusCode, String)> {
    ensure_reviewer_role(&claims)?;

    let limit = payload.limit.unwrap_or(50).clamp(1, 200);

    let row = sqlx::query(
        r#"
        WITH candidates AS (
            SELECT
                a.id AS source_ai_usage_log_id,
                a.organization_id,
                a.user_id,
                CASE
                    WHEN COALESCE(a.request_metadata->>'lesson_id', '') ~* '^[0-9a-fA-F-]{36}$'
                    THEN (a.request_metadata->>'lesson_id')::uuid
                    ELSE NULL
                END AS lesson_id,
                CASE
                    WHEN COALESCE(a.request_metadata->>'session_id', '') ~* '^[0-9a-fA-F-]{36}$'
                    THEN (a.request_metadata->>'session_id')::uuid
                    ELSE NULL
                END AS session_id,
                COALESCE(
                    (
                        SELECT cm.content
                        FROM chat_messages cm
                        WHERE cm.session_id = (
                            CASE
                                WHEN COALESCE(a.request_metadata->>'session_id', '') ~* '^[0-9a-fA-F-]{36}$'
                                THEN (a.request_metadata->>'session_id')::uuid
                                ELSE NULL
                            END
                        )
                        AND cm.role = 'user'
                        ORDER BY cm.created_at DESC
                        LIMIT 1
                    ),
                    ''
                ) AS question_text,
                a.response AS ai_response,
                COALESCE((a.request_metadata->>'has_rag')::boolean, FALSE) AS rag_context_found
            FROM ai_usage_logs a
            WHERE a.organization_id = $1
              AND a.request_type = 'chat'
              AND COALESCE((a.request_metadata->>'has_rag')::boolean, FALSE) = FALSE
              AND a.request_metadata ? 'session_id'
              AND NOT EXISTS (
                    SELECT 1
                    FROM faq_review_queue q
                    WHERE q.source_ai_usage_log_id = a.id
              )
            ORDER BY a.created_at DESC
            LIMIT $2
        ),
        inserted AS (
            INSERT INTO faq_review_queue (
                organization_id,
                source_ai_usage_log_id,
                user_id,
                lesson_id,
                session_id,
                question_text,
                ai_response,
                rag_context_found,
                status
            )
            SELECT
                c.organization_id,
                c.source_ai_usage_log_id,
                c.user_id,
                c.lesson_id,
                c.session_id,
                c.question_text,
                c.ai_response,
                c.rag_context_found,
                'pending'
            FROM candidates c
            WHERE c.question_text <> ''
            RETURNING 1
        )
        SELECT
            (SELECT COUNT(*)::bigint FROM inserted) AS imported,
            ((SELECT COUNT(*)::bigint FROM candidates) - (SELECT COUNT(*)::bigint FROM inserted)) AS skipped
        "#,
    )
    .bind(org_ctx.id)
    .bind(limit)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let imported: i64 = row.get("imported");
    let skipped: i64 = row.get("skipped");

    Ok(Json(ImportCandidatesResponse { imported, skipped }))
}

/// GET /faq/review-queue
pub async fn list_faq_review_queue(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<ReviewQueueFilters>,
) -> Result<Json<FaqReviewQueueResponse>, (StatusCode, String)> {
    ensure_reviewer_role(&claims)?;

    let limit = filters.limit.unwrap_or(50).clamp(1, 200);
    let offset = filters.offset.unwrap_or(0).max(0);

    let items = sqlx::query_as::<_, FaqReviewItem>(
        r#"
        SELECT
            q.id,
            q.source_ai_usage_log_id,
            q.user_id,
            u.full_name AS student_name,
            u.email AS student_email,
            q.lesson_id,
            q.session_id,
            q.question_text,
            q.ai_response,
            q.rag_context_found,
            q.status,
            q.reviewer_id,
            r.full_name AS reviewer_name,
            q.reviewer_note,
            q.human_answer,
            q.faq_entry_id,
            q.created_at,
            q.reviewed_at
        FROM faq_review_queue q
        LEFT JOIN users u ON u.id = q.user_id
        LEFT JOIN users r ON r.id = q.reviewer_id
        WHERE q.organization_id = $1
          AND ($2::text IS NULL OR q.status = $2::text)
        ORDER BY q.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(org_ctx.id)
    .bind(filters.status.clone())
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM faq_review_queue
        WHERE organization_id = $1
          AND ($2::text IS NULL OR status = $2::text)
        "#,
    )
    .bind(org_ctx.id)
    .bind(filters.status.clone())
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(FaqReviewQueueResponse {
        items,
        total,
        limit,
        offset,
    }))
}

/// POST /faq/review-queue/:id/answer
pub async fn answer_faq_review_item(
    Org(org_ctx): Org,
    claims: Claims,
    Path(item_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<AnswerReviewPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    ensure_reviewer_role(&claims)?;

    let answer = payload.human_answer.trim();
    if answer.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "La respuesta humana no puede estar vacía".to_string()));
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let queue_item: (String, String) = sqlx::query_as(
        "SELECT status, question_text FROM faq_review_queue WHERE id = $1 AND organization_id = $2"
    )
    .bind(item_id)
    .bind(org_ctx.id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Item de revisión no encontrado".to_string()))?;

    if queue_item.0 == "dismissed" {
        return Err((StatusCode::BAD_REQUEST, "El item está descartado y no puede responderse".to_string()));
    }

    let publish = payload.publish_to_faq.unwrap_or(false);

    if publish {
        let tags = payload.tags.unwrap_or_default();

        let faq_entry_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO faq_entries (
                organization_id,
                question,
                answer,
                tags,
                source,
                created_by,
                is_published
            )
            VALUES ($1, $2, $3, $4, 'human-reviewed', $5, TRUE)
            RETURNING id
            "#,
        )
        .bind(org_ctx.id)
        .bind(queue_item.1)
        .bind(answer)
        .bind(tags)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

        sqlx::query(
            r#"
            UPDATE faq_review_queue
            SET
                status = 'published',
                reviewer_id = $1,
                reviewer_note = $2,
                human_answer = $3,
                faq_entry_id = $4,
                reviewed_at = NOW()
            WHERE id = $5 AND organization_id = $6
            "#,
        )
        .bind(claims.sub)
        .bind(payload.reviewer_note)
        .bind(answer)
        .bind(faq_entry_id)
        .bind(item_id)
        .bind(org_ctx.id)
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    } else {
        sqlx::query(
            r#"
            UPDATE faq_review_queue
            SET
                status = 'answered',
                reviewer_id = $1,
                reviewer_note = $2,
                human_answer = $3,
                reviewed_at = NOW()
            WHERE id = $4 AND organization_id = $5
            "#,
        )
        .bind(claims.sub)
        .bind(payload.reviewer_note)
        .bind(answer)
        .bind(item_id)
        .bind(org_ctx.id)
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(StatusCode::OK)
}

/// POST /faq/review-queue/:id/dismiss
pub async fn dismiss_faq_review_item(
    Org(org_ctx): Org,
    claims: Claims,
    Path(item_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<DismissReviewPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    ensure_reviewer_role(&claims)?;

    let result = sqlx::query(
        r#"
        UPDATE faq_review_queue
        SET
            status = 'dismissed',
            reviewer_id = $1,
            reviewer_note = $2,
            reviewed_at = NOW()
        WHERE id = $3 AND organization_id = $4
        "#,
    )
    .bind(claims.sub)
    .bind(payload.reviewer_note)
    .bind(item_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Item de revisión no encontrado".to_string()));
    }

    Ok(StatusCode::OK)
}

/// GET /faq/entries
pub async fn list_faq_entries(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<FaqEntriesFilters>,
) -> Result<Json<Vec<FaqEntry>>, (StatusCode, String)> {
    ensure_reviewer_role(&claims)?;

    let limit = filters.limit.unwrap_or(100).clamp(1, 300);
    let offset = filters.offset.unwrap_or(0).max(0);

    let query_term = filters.search.clone().unwrap_or_default();
    let maybe_search = if query_term.trim().is_empty() {
        None
    } else {
        Some(query_term)
    };

    let rows = sqlx::query_as::<_, FaqEntry>(
        r#"
        SELECT
            id,
            organization_id,
            question,
            answer,
            tags,
            source,
            created_by,
            is_published,
            created_at,
            updated_at
        FROM faq_entries
        WHERE organization_id = $1
          AND is_published = TRUE
          AND (
              $2::text IS NULL
              OR question ILIKE ('%' || $2 || '%')
              OR answer ILIKE ('%' || $2 || '%')
          )
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(org_ctx.id)
    .bind(maybe_search)
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(rows))
}
