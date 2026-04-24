use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

fn ensure_audit_reviewer_role(claims: &Claims) -> Result<(), (StatusCode, String)> {
    if claims.role != "admin" && claims.role != "instructor" {
        return Err((StatusCode::FORBIDDEN, "No autorizado".to_string()));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct AiAuditFilters {
    pub reviewed: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewAiLogPayload {
    pub reviewed: bool,
    pub reviewer_note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AiAuditItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub student_name: Option<String>,
    pub endpoint: String,
    pub model: String,
    pub output_tokens: i32,
    pub has_rag_context: bool,
    pub risk_score: i32,
    pub risk_signals: Vec<String>,
    pub response_excerpt: String,
    pub reviewed: bool,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_by_name: Option<String>,
    pub reviewer_note: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct AiAuditListResponse {
    pub items: Vec<AiAuditItem>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize)]
pub struct ReviewAiLogResponse {
    pub id: Uuid,
    pub reviewed: bool,
}

fn risk_signals_from_log(response: &str, has_rag_context: bool, output_tokens: i32) -> Vec<String> {
    let mut signals = Vec::new();
    let response_lc = response.to_lowercase();

    if !has_rag_context {
        signals.push("missing_rag_context".to_string());
    }

    if output_tokens >= 900 {
        signals.push("high_output_tokens".to_string());
    }

    if response.chars().count() >= 2200 {
        signals.push("long_response".to_string());
    }

    let absolute_claim_markers = [
        "siempre",
        "nunca",
        "definitivamente",
        "sin duda",
        "100%",
        "completamente seguro",
    ];

    if absolute_claim_markers
        .iter()
        .any(|marker| response_lc.contains(marker))
    {
        signals.push("absolute_claim_language".to_string());
    }

    let citation_like_markers = ["segun el documento", "fuente:", "referencia:", "[1]", "[2]"];
    if !has_rag_context
        && citation_like_markers
            .iter()
            .any(|marker| response_lc.contains(marker))
    {
        signals.push("citation_without_rag".to_string());
    }

    signals
}

fn build_excerpt(text: &str, max_chars: usize) -> String {
    let mut out = String::new();
    for ch in text.chars().take(max_chars) {
        out.push(ch);
    }
    if text.chars().count() > max_chars {
        out.push_str("...");
    }
    out
}

pub async fn list_ai_audit_logs(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<AiAuditFilters>,
) -> Result<Json<AiAuditListResponse>, (StatusCode, String)> {
    ensure_audit_reviewer_role(&claims)?;

    let limit = filters.limit.unwrap_or(50).clamp(1, 200);
    let offset = filters.offset.unwrap_or(0).max(0);

    let rows = sqlx::query(
        r#"
        SELECT
            a.id,
            a.user_id,
            u.full_name AS student_name,
            a.endpoint,
            a.model,
            a.output_tokens,
            a.response,
            a.request_metadata,
            a.created_at,
            COALESCE((a.request_metadata->>'audit_reviewed')::boolean, false) AS reviewed,
            CASE
                WHEN COALESCE(a.request_metadata->>'audit_reviewed_by', '') ~* '^[0-9a-fA-F-]{36}$'
                THEN (a.request_metadata->>'audit_reviewed_by')::uuid
                ELSE NULL
            END AS reviewed_by,
            rv.full_name AS reviewed_by_name,
            a.request_metadata->>'audit_review_note' AS reviewer_note
        FROM ai_usage_logs a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN users rv ON rv.id = (
            CASE
                WHEN COALESCE(a.request_metadata->>'audit_reviewed_by', '') ~* '^[0-9a-fA-F-]{36}$'
                THEN (a.request_metadata->>'audit_reviewed_by')::uuid
                ELSE NULL
            END
        )
        WHERE a.organization_id = $1
          AND a.request_type = 'chat'
          AND ($2::boolean IS NULL OR COALESCE((a.request_metadata->>'audit_reviewed')::boolean, false) = $2::boolean)
        ORDER BY a.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(org_ctx.id)
    .bind(filters.reviewed)
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al listar auditoría de IA: {}", e)))?;

    let mut items = Vec::new();

    for row in rows {
        let metadata: Option<Value> = row.get("request_metadata");
        let has_rag_context = metadata
            .as_ref()
            .and_then(|m| m.get("has_rag"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let response: String = row.get::<Option<String>, _>("response").unwrap_or_default();
        let output_tokens: i32 = row.get("output_tokens");

        let risk_signals = risk_signals_from_log(&response, has_rag_context, output_tokens);
        if risk_signals.is_empty() {
            continue;
        }

        items.push(AiAuditItem {
            id: row.get("id"),
            user_id: row.get("user_id"),
            student_name: row.get("student_name"),
            endpoint: row.get("endpoint"),
            model: row.get("model"),
            output_tokens,
            has_rag_context,
            risk_score: risk_signals.len() as i32,
            risk_signals,
            response_excerpt: build_excerpt(&response, 240),
            reviewed: row.get("reviewed"),
            reviewed_by: row.get("reviewed_by"),
            reviewed_by_name: row.get("reviewed_by_name"),
            reviewer_note: row.get("reviewer_note"),
            created_at: row.get("created_at"),
        });
    }

    Ok(Json(AiAuditListResponse {
        items,
        limit,
        offset,
    }))
}

pub async fn review_ai_audit_log(
    Org(org_ctx): Org,
    claims: Claims,
    Path(log_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<ReviewAiLogPayload>,
) -> Result<Json<ReviewAiLogResponse>, (StatusCode, String)> {
    ensure_audit_reviewer_role(&claims)?;

    let note = payload
        .reviewer_note
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .to_string();

    let note_or_null = if note.is_empty() { None } else { Some(note) };

    let updated = sqlx::query(
        r#"
        UPDATE ai_usage_logs
        SET request_metadata = COALESCE(request_metadata, '{}'::jsonb) || jsonb_strip_nulls(
                jsonb_build_object(
                    'audit_reviewed', $3::boolean,
                    'audit_reviewed_by', $4::text,
                    'audit_reviewed_at', NOW()::text,
                    'audit_review_note', $5::text
                )
            )
        WHERE id = $1
          AND organization_id = $2
          AND request_type = 'chat'
        "#,
    )
    .bind(log_id)
    .bind(org_ctx.id)
    .bind(payload.reviewed)
    .bind(claims.sub.to_string())
    .bind(note_or_null)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al actualizar auditoría IA: {}", e)))?;

    if updated.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Registro de auditoría no encontrado".to_string()));
    }

    Ok(Json(ReviewAiLogResponse {
        id: log_id,
        reviewed: payload.reviewed,
    }))
}
