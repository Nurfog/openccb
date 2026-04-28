#![allow(dead_code)]

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use chrono::{DateTime, Utc};
use uuid::Uuid;

// ==================== Seguimiento del Uso de Tokens ====================

/// GET /api/admin/token-usage - Obtener estadísticas de uso de tokens para todos los usuarios
pub async fn get_token_usage(
    _org_ctx: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<TokenUsageResponse>, (StatusCode, String)> {
    // Obtener el uso de tokens de usuario de la base de datos
    let usage: Vec<TokenUsageRecord> = sqlx::query_as(
        r#"
        SELECT
            u.id as user_id,
            u.email,
            u.full_name,
            u.role,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COUNT(au.id) as ai_requests,
            MAX(au.created_at) as last_used
        FROM users u
        LEFT JOIN ai_usage_logs au ON u.id = au.user_id
        GROUP BY u.id, u.email, u.full_name, u.role
        ORDER BY total_tokens DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Calcular estadísticas
    let total_tokens: i64 = usage.iter().map(|u| u.total_tokens).sum();
    let total_input: i64 = usage.iter().map(|u| u.input_tokens).sum();
    let total_output: i64 = usage.iter().map(|u| u.output_tokens).sum();
    let total_requests: i64 = usage.iter().map(|u| u.ai_requests).sum();
    let top_user_tokens = usage.first().map(|u| u.total_tokens).unwrap_or(0);
    let avg_tokens = if !usage.is_empty() { total_tokens / usage.len() as i64 } else { 0 };

    // Estimación de coste (usando precios aproximados de OpenAI: $0.001/1K entrada, $0.003/1K salida)
    let estimated_cost = (total_input as f64 * 0.000001) + (total_output as f64 * 0.000003);

    let stats = TokenUsageStats {
        total_tokens,
        total_input,
        total_output,
        total_requests,
        total_cost_usd: estimated_cost,
        top_user_tokens,
        avg_tokens_per_user: avg_tokens,
    };

    // Convertir al formato de respuesta con estimación en USD por usuario
    let usage_with_cost: Vec<TokenUsage> = usage
        .into_iter()
        .map(|u| {
            let user_cost = (u.input_tokens as f64 * 0.000001) + (u.output_tokens as f64 * 0.000003);
            TokenUsage {
                user_id: u.user_id.to_string(),
                email: u.email,
                full_name: u.full_name,
                role: u.role,
                total_tokens: u.total_tokens,
                input_tokens: u.input_tokens,
                output_tokens: u.output_tokens,
                ai_requests: u.ai_requests,
                last_used: u
                    .last_used
                    .map(|ts| ts.to_rfc3339())
                    .unwrap_or_else(|| "Nunca".to_string()),
                estimated_cost_usd: user_cost,
            }
        })
        .collect();

    Ok(Json(TokenUsageResponse {
        usage: usage_with_cost,
        stats,
    }))
}

/// GET /api/admin/ai-usage-dashboard - Datos exhaustivos del panel de uso de IA
pub async fn get_ai_usage_dashboard(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<DashboardFilters>,
) -> Result<Json<DashboardResponse>, (StatusCode, String)> {
    // Obtener el uso diario para gráficos
    let daily_usage: Vec<DailyUsage> = sqlx::query_as(
        r#"
        SELECT
            DATE(au.created_at) as date,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests
        FROM ai_usage_logs au
        WHERE au.organization_id = $1
            AND ($2::DATE IS NULL OR DATE(au.created_at) >= $2::DATE)
            AND ($3::DATE IS NULL OR DATE(au.created_at) <= $3::DATE)
        GROUP BY DATE(au.created_at)
        ORDER BY date DESC
        LIMIT 30
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener uso por punto de conexión/función
    let by_endpoint: Vec<UsageByEndpoint> = sqlx::query_as(
        r#"
        SELECT
            au.endpoint,
            au.request_type,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests
        FROM ai_usage_logs au
        WHERE au.organization_id = $1
            AND ($2::DATE IS NULL OR DATE(au.created_at) >= $2::DATE)
            AND ($3::DATE IS NULL OR DATE(au.created_at) <= $3::DATE)
        GROUP BY au.endpoint, au.request_type
        ORDER BY total_tokens DESC
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener usuarios principales
    let top_users: Vec<TopUserUsage> = sqlx::query_as(
        r#"
        SELECT
            u.id as user_id,
            u.email,
            u.full_name,
            u.role,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests
        FROM ai_usage_logs au
        JOIN users u ON au.user_id = u.id
        WHERE au.organization_id = $1
            AND ($2::DATE IS NULL OR DATE(au.created_at) >= $2::DATE)
            AND ($3::DATE IS NULL OR DATE(au.created_at) <= $3::DATE)
        GROUP BY u.id, u.email, u.full_name, u.role
        ORDER BY total_tokens DESC
        LIMIT 10
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Calcular estadísticas de resumen
    let total_tokens: i64 = daily_usage.iter().map(|d| d.total_tokens).sum();
    let total_input: i64 = daily_usage.iter().map(|d| d.input_tokens).sum();
    let total_output: i64 = daily_usage.iter().map(|d| d.output_tokens).sum();
    let total_cost: f64 = daily_usage.iter().map(|d| d.cost_usd).sum();
    let total_requests: i64 = daily_usage.iter().map(|d| d.requests).sum();

    // Calcular estimación de ahorros (frente a precios de OpenAI GPT-4)
    // GPT-4: ~$0.03/1K input, ~$0.06/1K output
    // Nuestra IA local: ~$0.001/1K entrada, ~$0.003/1K salida
    let openai_equivalent_cost = (total_input as f64 * 0.00003) + (total_output as f64 * 0.00006);
    let savings_vs_openai = openai_equivalent_cost - total_cost;

    Ok(Json(DashboardResponse {
        summary: DashboardSummary {
            total_tokens,
            total_input,
            total_output,
            total_requests,
            total_cost_usd: total_cost,
            savings_vs_openai_usd: savings_vs_openai,
            openai_equivalent_cost_usd: openai_equivalent_cost,
        },
        daily_usage,
        by_endpoint,
        top_users,
    }))
}

/// GET /api/admin/ai-usage/logs - Obtener logs detallados de uso de IA con paginación
pub async fn get_ai_usage_logs(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<UsageLogFilters>,
) -> Result<Json<UsageLogsResponse>, (StatusCode, String)> {
    let limit = filters.limit.unwrap_or(50).min(200);
    let offset = filters.offset.unwrap_or(0);

    let logs: Vec<UsageLogRecord> = sqlx::query_as(
        r#"
        SELECT
            au.id,
            au.user_id,
            u.email as user_email,
            u.full_name as user_name,
            au.endpoint,
            au.request_type,
            au.model,
            au.tokens_used,
            au.input_tokens,
            au.output_tokens,
            au.estimated_cost_usd,
            au.prompt,
            au.response,
            au.request_metadata,
            au.created_at
        FROM ai_usage_logs au
        JOIN users u ON au.user_id = u.id
        WHERE au.organization_id = $1
            AND ($2::TEXT IS NULL OR au.endpoint = $2)
            AND ($3::TEXT IS NULL OR au.request_type = $3)
            AND ($4::UUID IS NULL OR au.user_id = $4)
        ORDER BY au.created_at DESC
        LIMIT $5 OFFSET $6
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.endpoint.clone())
    .bind(filters.request_type.clone())
    .bind(filters.user_id.clone())
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener el conteo total para la paginación
    let count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM ai_usage_logs
        WHERE organization_id = $1
            AND ($2::TEXT IS NULL OR endpoint = $2)
            AND ($3::TEXT IS NULL OR request_type = $3)
            AND ($4::UUID IS NULL OR user_id = $4)
        "#
    )
    .bind(org_ctx.id)
    .bind(filters.endpoint.clone())
    .bind(filters.request_type.clone())
    .bind(filters.user_id.clone())
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(UsageLogsResponse {
        logs,
        total: count.0,
        limit,
        offset,
    }))
}

#[derive(Debug, Deserialize)]
pub struct DashboardFilters {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UsageLogFilters {
    pub endpoint: Option<String>,
    pub request_type: Option<String>,
    pub user_id: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub total_tokens: i64,
    pub total_input: i64,
    pub total_output: i64,
    pub total_requests: i64,
    pub total_cost_usd: f64,
    pub savings_vs_openai_usd: f64,
    pub openai_equivalent_cost_usd: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DailyUsage {
    pub date: chrono::NaiveDate,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_usd: f64,
    pub requests: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UsageByEndpoint {
    pub endpoint: String,
    pub request_type: String,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_usd: f64,
    pub requests: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TopUserUsage {
    pub user_id: uuid::Uuid,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_usd: f64,
    pub requests: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub summary: DashboardSummary,
    pub daily_usage: Vec<DailyUsage>,
    pub by_endpoint: Vec<UsageByEndpoint>,
    pub top_users: Vec<TopUserUsage>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UsageLogRecord {
    pub id: uuid::Uuid,
    pub user_id: uuid::Uuid,
    pub user_email: String,
    pub user_name: String,
    pub endpoint: String,
    pub request_type: String,
    pub model: String,
    pub tokens_used: i32,
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub estimated_cost_usd: f64,
    pub prompt: Option<String>,
    pub response: Option<String>,
    pub request_metadata: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct UsageLogsResponse {
    pub logs: Vec<UsageLogRecord>,
    pub total: i64,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct TokenUsageFilters {
    pub role: Option<String>,
    pub min_tokens: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct TokenUsage {
    pub user_id: String,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub ai_requests: i64,
    pub last_used: String,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct TokenUsageRecord {
    user_id: uuid::Uuid,
    email: String,
    full_name: String,
    role: String,
    total_tokens: i64,
    input_tokens: i64,
    output_tokens: i64,
    ai_requests: i64,
    last_used: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct TokenUsageStats {
    pub total_tokens: i64,
    pub total_input: i64,
    pub total_output: i64,
    pub total_requests: i64,
    pub total_cost_usd: f64,
    pub top_user_tokens: i64,
    pub avg_tokens_per_user: i64,
}

#[derive(Debug, Serialize)]
pub struct TokenUsageResponse {
    pub usage: Vec<TokenUsage>,
    pub stats: TokenUsageStats,
}

// ==================== Panel de Uso Global de IA (Solo Root) ====================

/// GET /api/admin/ai-usage/global - Panel de uso global de IA para usuarios root
pub async fn get_ai_usage_global(
    _claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<DashboardFilters>,
) -> Result<Json<GlobalAiUsageResponse>, (StatusCode, String)> {
    // Obtener el uso diario para gráficos (todas las organizaciones)
    let daily_usage: Vec<DailyUsage> = sqlx::query_as(
        r#"
        SELECT
            DATE(au.created_at) as date,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests
        FROM ai_usage_logs au
        WHERE ($1::DATE IS NULL OR au.created_at >= $1::DATE)
            AND ($2::DATE IS NULL OR au.created_at <= $2::DATE + INTERVAL '1 day')
        GROUP BY DATE(au.created_at)
        ORDER BY date ASC
        LIMIT 90
        "#
    )
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener uso por punto de conexión/función
    let by_endpoint: Vec<UsageByEndpoint> = sqlx::query_as(
        r#"
        SELECT
            au.endpoint,
            au.request_type,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests
        FROM ai_usage_logs au
        WHERE ($1::DATE IS NULL OR au.created_at >= $1::DATE)
            AND ($2::DATE IS NULL OR au.created_at <= $2::DATE + INTERVAL '1 day')
        GROUP BY au.endpoint, au.request_type
        ORDER BY total_tokens DESC
        "#
    )
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener uso por organización
    let by_organization: Vec<UsageByOrganization> = sqlx::query_as(
        r#"
        SELECT
            o.id as org_id,
            o.name as org_name,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests,
            COUNT(DISTINCT au.user_id) as active_users
        FROM ai_usage_logs au
        JOIN organizations o ON au.organization_id = o.id
        WHERE ($1::DATE IS NULL OR DATE(au.created_at) >= $1::DATE)
            AND ($2::DATE IS NULL OR DATE(au.created_at) <= $2::DATE)
        GROUP BY o.id, o.name
        ORDER BY total_tokens DESC
        "#
    )
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener usuarios principales en todas las organizaciones
    let top_users: Vec<TopUserUsage> = sqlx::query_as(
        r#"
        SELECT
            u.id as user_id,
            u.email,
            u.full_name,
            u.role,
            o.name as org_name,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.input_tokens), 0) as input_tokens,
            COALESCE(SUM(au.output_tokens), 0) as output_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests
        FROM ai_usage_logs au
        JOIN users u ON au.user_id = u.id
        JOIN organizations o ON au.organization_id = o.id
        WHERE ($1::DATE IS NULL OR DATE(au.created_at) >= $1::DATE)
            AND ($2::DATE IS NULL OR DATE(au.created_at) <= $2::DATE)
        GROUP BY u.id, u.email, u.full_name, u.role, o.name
        ORDER BY total_tokens DESC
        LIMIT 20
        "#
    )
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Obtener uso por tipo de solicitud (para gráfico circular)
    let by_request_type: Vec<UsageByRequestType> = sqlx::query_as(
        r#"
        SELECT
            au.request_type,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as requests
        FROM ai_usage_logs au
        WHERE ($1::DATE IS NULL OR DATE(au.created_at) >= $1::DATE)
            AND ($2::DATE IS NULL OR DATE(au.created_at) <= $2::DATE)
        GROUP BY au.request_type
        ORDER BY total_tokens DESC
        "#
    )
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Calcular estadísticas de resumen
    let total_tokens: i64 = daily_usage.iter().map(|d| d.total_tokens).sum();
    let total_input: i64 = daily_usage.iter().map(|d| d.input_tokens).sum();
    let total_output: i64 = daily_usage.iter().map(|d| d.output_tokens).sum();
    let total_cost: f64 = daily_usage.iter().map(|d| d.cost_usd).sum();
    let total_requests: i64 = daily_usage.iter().map(|d| d.requests).sum();

    // Calcular estimación de ahorros (frente a precios de OpenAI GPT-4)
    // GPT-4: ~$0.03/1K input, ~$0.06/1K output
    // Nuestra IA local: ~$0.001/1K entrada, ~$0.003/1K salida
    let openai_equivalent_cost = (total_input as f64 * 0.00003) + (total_output as f64 * 0.00006);
    let savings_vs_openai = openai_equivalent_cost - total_cost;
    let savings_percentage = if openai_equivalent_cost > 0.0 {
        (savings_vs_openai / openai_equivalent_cost) * 100.0
    } else {
        0.0
    };

    // Obtener el conteo total de usuarios activos
    let total_active_users: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT au.user_id)
        FROM ai_usage_logs au
        WHERE ($1::DATE IS NULL OR DATE(au.created_at) >= $1::DATE)
            AND ($2::DATE IS NULL OR DATE(au.created_at) <= $2::DATE)
        "#
    )
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Calcular uso específico por estudiante (interacciones de chat)
    let student_chat_usage: Vec<StudentChatUsage> = sqlx::query_as(
        r#"
        SELECT
            u.id as user_id,
            u.email,
            u.full_name,
            o.name as org_name,
            COALESCE(SUM(au.tokens_used), 0) as total_tokens,
            COALESCE(SUM(au.estimated_cost_usd), 0)::FLOAT8 as cost_usd,
            COUNT(au.id) as chat_requests,
            MAX(au.created_at) as last_chat
        FROM ai_usage_logs au
        JOIN users u ON au.user_id = u.id
        JOIN organizations o ON au.organization_id = o.id
        WHERE au.request_type = 'chat'
            AND u.role = 'student'
            AND ($1::DATE IS NULL OR DATE(au.created_at) >= $1::DATE)
            AND ($2::DATE IS NULL OR DATE(au.created_at) <= $2::DATE)
        GROUP BY u.id, u.email, u.full_name, o.name
        ORDER BY total_tokens DESC
        LIMIT 50
        "#
    )
    .bind(filters.start_date.clone())
    .bind(filters.end_date.clone())
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Calcular totales de chat de estudiantes
    let total_student_chat_tokens: i64 = student_chat_usage.iter().map(|s| s.total_tokens).sum();
    let total_student_chat_cost: f64 = student_chat_usage.iter().map(|s| s.cost_usd).sum();
    let total_student_chat_requests: i64 = student_chat_usage.iter().map(|s| s.chat_requests).sum();

    Ok(Json(GlobalAiUsageResponse {
        summary: GlobalAiSummary {
            total_tokens,
            total_input,
            total_output,
            total_requests,
            total_cost_usd: total_cost,
            savings_vs_openai_usd: savings_vs_openai,
            savings_percentage,
            openai_equivalent_cost_usd: openai_equivalent_cost,
            total_organizations: by_organization.len() as i64,
            total_active_users,
        },
        student_chat_summary: Some(StudentChatSummary {
            total_tokens: total_student_chat_tokens,
            total_requests: total_student_chat_requests,
            total_cost_usd: total_student_chat_cost,
            active_students: student_chat_usage.len() as i64,
        }),
        daily_usage,
        by_endpoint,
        by_organization,
        by_request_type,
        top_users,
        student_chat_usage,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UsageByOrganization {
    pub org_id: uuid::Uuid,
    pub org_name: String,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_usd: f64,
    pub requests: i64,
    pub active_users: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UsageByRequestType {
    pub request_type: String,
    pub total_tokens: i64,
    pub cost_usd: f64,
    pub requests: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StudentChatUsage {
    pub user_id: uuid::Uuid,
    pub email: String,
    pub full_name: String,
    pub org_name: String,
    pub total_tokens: i64,
    pub cost_usd: f64,
    pub chat_requests: i64,
    pub last_chat: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct StudentChatSummary {
    pub total_tokens: i64,
    pub total_requests: i64,
    pub total_cost_usd: f64,
    pub active_students: i64,
}

#[derive(Debug, Serialize)]
pub struct GlobalAiSummary {
    pub total_tokens: i64,
    pub total_input: i64,
    pub total_output: i64,
    pub total_requests: i64,
    pub total_cost_usd: f64,
    pub savings_vs_openai_usd: f64,
    pub savings_percentage: f64,
    pub openai_equivalent_cost_usd: f64,
    pub total_organizations: i64,
    pub total_active_users: i64,
}

#[derive(Debug, Serialize)]
pub struct GlobalAiUsageResponse {
    pub summary: GlobalAiSummary,
    pub student_chat_summary: Option<StudentChatSummary>,
    pub daily_usage: Vec<DailyUsage>,
    pub by_endpoint: Vec<UsageByEndpoint>,
    pub by_organization: Vec<UsageByOrganization>,
    pub by_request_type: Vec<UsageByRequestType>,
    pub top_users: Vec<TopUserUsage>,
    pub student_chat_usage: Vec<StudentChatUsage>,
}

// ==================== Límites de Tokens de Usuario ====================

#[derive(Debug, Deserialize)]
pub struct SetTokenLimitPayload {
    pub monthly_token_limit: i32,
    pub token_limit_reset_day: Option<i32>,
}

/// PUT /admin/users/{user_id}/token-limit - Establecer límite mensual de tokens para el usuario
pub async fn set_user_token_limit(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<SetTokenLimitPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Validar día de reinicio (1-28 para evitar problemas a fin de mes)
    let reset_day = payload.token_limit_reset_day.unwrap_or(1).clamp(1, 28);
    
    sqlx::query(
        r#"
        UPDATE users
        SET monthly_token_limit = $1,
            token_limit_reset_day = $2,
            updated_at = NOW()
        WHERE id = $3
        "#
    )
    .bind(payload.monthly_token_limit)
    .bind(reset_day)
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    Ok(StatusCode::OK)
}

/// GET /admin/users/{user_id}/token-usage - Obtener uso de tokens para un usuario específico
pub async fn get_user_token_usage(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserTokenUsageDetail>, (StatusCode, String)> {
    // Obtener uso del mes actual
    let usage: UserTokenUsageDetail = sqlx::query_as(
        r#"
        SELECT
            u.id as user_id,
            u.email,
            u.full_name,
            u.monthly_token_limit,
            u.token_limit_reset_day,
            COALESCE(SUM(au.tokens_used), 0) as used_tokens,
            COUNT(au.id) as total_requests,
            COALESCE(SUM(au.estimated_cost_usd), 0) as total_cost_usd,
            MAX(au.created_at) as last_used
        FROM users u
        LEFT JOIN ai_usage_logs au ON u.id = au.user_id
            AND au.created_at >= DATE_TRUNC('month', NOW())
        WHERE u.id = $1
        GROUP BY u.id, u.email, u.full_name, u.monthly_token_limit, u.token_limit_reset_day
        "#
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    Ok(Json(usage))
}

/// GET /admin/users/{user_id}/token-limit/check - Comprobar si el usuario tiene tokens disponibles
pub async fn check_user_token_limit(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<TokenLimitCheckResponse>, (StatusCode, String)> {
    let result: TokenLimitCheckResponse = sqlx::query_as(
        "SELECT * FROM check_token_limit($1, 0)"
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    Ok(Json(result))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserTokenUsageDetail {
    pub user_id: Uuid,
    pub email: String,
    pub full_name: String,
    pub monthly_token_limit: i32,
    pub token_limit_reset_day: i32,
    pub used_tokens: i64,
    pub total_requests: i64,
    pub total_cost_usd: f64,
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TokenLimitCheckResponse {
    pub has_available_tokens: bool,
    pub monthly_limit: i32,
    pub used_tokens: i64,
    pub remaining_tokens: i64,
    pub reset_date: DateTime<Utc>,
}
