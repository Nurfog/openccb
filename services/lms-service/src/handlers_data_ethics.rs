use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

const DEFAULT_RETENTION_DAYS: i32 = 180;

#[derive(Debug, Deserialize)]
pub struct DataEthicsFilters {
    pub days: Option<i32>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct DataEthicsEventItem {
    pub id: Uuid,
    pub endpoint: String,
    pub model: String,
    pub request_type: String,
    pub tokens_used: i32,
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub has_rag_context: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct DataEthicsSummary {
    pub days_window: i32,
    pub total_requests: i64,
    pub total_tokens: i64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub average_tokens_per_request: i64,
    pub model_count: i64,
    pub request_type_count: i64,
    pub retention_days: i32,
    pub stored_fields: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct DataEthicsSummaryResponse {
    pub summary: DataEthicsSummary,
    pub events: Vec<DataEthicsEventItem>,
}

fn ensure_data_ethics_viewer_role(claims: &Claims) -> Result<(), (StatusCode, String)> {
    if claims.role != "admin" && claims.role != "instructor" {
        return Err((
            StatusCode::FORBIDDEN,
            "No autorizado para ver transparencia de datos IA".to_string(),
        ));
    }
    Ok(())
}

pub async fn get_data_ethics_summary(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<DataEthicsFilters>,
) -> Result<Json<DataEthicsSummaryResponse>, (StatusCode, String)> {
    ensure_data_ethics_viewer_role(&claims)?;

    let days_window = filters.days.unwrap_or(30).clamp(1, 365);
    let limit = filters.limit.unwrap_or(40).clamp(1, 200);

    let totals = sqlx::query(
        r#"
        SELECT
            COUNT(*)::BIGINT AS total_requests,
            COALESCE(SUM(tokens_used), 0)::BIGINT AS total_tokens,
            COALESCE(SUM(input_tokens), 0)::BIGINT AS total_input_tokens,
            COALESCE(SUM(output_tokens), 0)::BIGINT AS total_output_tokens,
            COUNT(DISTINCT model)::BIGINT AS model_count,
            COUNT(DISTINCT request_type)::BIGINT AS request_type_count
        FROM ai_usage_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - ($2 || ' days')::interval
        "#,
    )
    .bind(org_ctx.id)
    .bind(days_window)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al obtener resumen de ética de datos: {}", e),
        )
    })?;

    let total_requests: i64 = totals.get("total_requests");
    let total_tokens: i64 = totals.get("total_tokens");
    let total_input_tokens: i64 = totals.get("total_input_tokens");
    let total_output_tokens: i64 = totals.get("total_output_tokens");
    let model_count: i64 = totals.get("model_count");
    let request_type_count: i64 = totals.get("request_type_count");
    let average_tokens_per_request = if total_requests > 0 {
        total_tokens / total_requests
    } else {
        0
    };

    let event_rows = sqlx::query(
        r#"
        SELECT
            id,
            endpoint,
            model,
            request_type,
            tokens_used,
            input_tokens,
            output_tokens,
            request_metadata,
            created_at
        FROM ai_usage_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - ($2 || ' days')::interval
        ORDER BY created_at DESC
        LIMIT $3
        "#,
    )
    .bind(org_ctx.id)
    .bind(days_window)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al obtener eventos de ética de datos: {}", e),
        )
    })?;

    let mut events = Vec::with_capacity(event_rows.len());
    for row in event_rows {
        let metadata: Option<Value> = row.get("request_metadata");
        let has_rag_context = metadata
            .as_ref()
            .and_then(|m| m.get("has_rag"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        events.push(DataEthicsEventItem {
            id: row.get("id"),
            endpoint: row.get("endpoint"),
            model: row.get("model"),
            request_type: row.get("request_type"),
            tokens_used: row.get("tokens_used"),
            input_tokens: row.get("input_tokens"),
            output_tokens: row.get("output_tokens"),
            has_rag_context,
            created_at: row.get("created_at"),
        });
    }

    Ok(Json(DataEthicsSummaryResponse {
        summary: DataEthicsSummary {
            days_window,
            total_requests,
            total_tokens,
            total_input_tokens,
            total_output_tokens,
            average_tokens_per_request,
            model_count,
            request_type_count,
            retention_days: DEFAULT_RETENTION_DAYS,
            stored_fields: vec![
                "prompt".to_string(),
                "response".to_string(),
                "tokens_used".to_string(),
                "input_tokens".to_string(),
                "output_tokens".to_string(),
                "model".to_string(),
                "endpoint".to_string(),
                "request_type".to_string(),
                "request_metadata.has_rag".to_string(),
                "request_metadata.lesson_id".to_string(),
                "request_metadata.session_id".to_string(),
                "created_at".to_string(),
            ],
        },
        events,
    }))
}