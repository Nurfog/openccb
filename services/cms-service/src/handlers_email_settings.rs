use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::auth::Claims;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

use super::handlers::{Org, log_action};

#[derive(Debug, Clone, sqlx::FromRow)]
struct OrganizationEmailServiceRow {
    id: Uuid,
    organization_id: Uuid,
    service_type: String,
    provider_key: String,
    display_name: String,
    is_enabled: bool,
    is_default: bool,
    smtp_host: Option<String>,
    smtp_port: i32,
    smtp_from: Option<String>,
    smtp_username: Option<String>,
    smtp_password: Option<String>,
    smtp_starttls: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrganizationEmailServiceResponse {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub service_type: String,
    pub provider_key: String,
    pub display_name: String,
    pub is_enabled: bool,
    pub is_default: bool,
    pub smtp_host: Option<String>,
    pub smtp_port: i32,
    pub smtp_from: Option<String>,
    pub smtp_username: Option<String>,
    pub smtp_starttls: bool,
    pub has_password: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpsertOrganizationEmailServicePayload {
    pub service_type: String,
    pub provider_key: String,
    pub display_name: String,
    pub is_enabled: bool,
    pub is_default: bool,
    pub smtp_host: Option<String>,
    pub smtp_port: i32,
    pub smtp_from: Option<String>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub smtp_starttls: bool,
}

fn parse_bool(value: &str) -> bool {
    let normalized = value.trim().to_lowercase();
    normalized == "1" || normalized == "true" || normalized == "yes"
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn validate_payload(payload: &UpsertOrganizationEmailServicePayload) -> Result<(), (StatusCode, String)> {
    if payload.smtp_port <= 0 || payload.smtp_port > 65535 {
        return Err((
            StatusCode::BAD_REQUEST,
            "smtp_port debe estar entre 1 y 65535".to_string(),
        ));
    }

    if payload.service_type.trim().to_lowercase() != "smtp" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Por ahora solo se soporta service_type='smtp'".to_string(),
        ));
    }

    if payload.is_enabled {
        let host_ok = payload
            .smtp_host
            .as_ref()
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);
        let from_ok = payload
            .smtp_from
            .as_ref()
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);

        if !host_ok {
            return Err((
                StatusCode::BAD_REQUEST,
                "smtp_host es requerido cuando el servicio está habilitado".to_string(),
            ));
        }

        if !from_ok {
            return Err((
                StatusCode::BAD_REQUEST,
                "smtp_from es requerido cuando el servicio está habilitado".to_string(),
            ));
        }
    }

    Ok(())
}

fn to_response(row: OrganizationEmailServiceRow) -> OrganizationEmailServiceResponse {
    OrganizationEmailServiceResponse {
        id: row.id,
        organization_id: row.organization_id,
        service_type: row.service_type,
        provider_key: row.provider_key,
        display_name: row.display_name,
        is_enabled: row.is_enabled,
        is_default: row.is_default,
        smtp_host: row.smtp_host,
        smtp_port: row.smtp_port,
        smtp_from: row.smtp_from,
        smtp_username: row.smtp_username,
        smtp_starttls: row.smtp_starttls,
        has_password: row
            .smtp_password
            .as_ref()
            .map(|p| !p.trim().is_empty())
            .unwrap_or(false),
    }
}

async fn ensure_bootstrap_service(pool: &PgPool, organization_id: Uuid) -> Result<(), (StatusCode, String)> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organization_email_services WHERE organization_id = $1",
    )
    .bind(organization_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al verificar servicios de email: {}", e),
        )
    })?;

    if count > 0 {
        return Ok(());
    }

    let enabled = env::var("SMTP_ENABLED")
        .map(|v| parse_bool(&v))
        .unwrap_or(false);
    let host = normalize_optional(env::var("SMTP_HOST").ok());
    let port = env::var("SMTP_PORT")
        .ok()
        .and_then(|v| v.parse::<i32>().ok())
        .filter(|v| *v > 0 && *v <= 65535)
        .unwrap_or(587);
    let from = normalize_optional(env::var("SMTP_FROM").ok());
    let username = normalize_optional(env::var("SMTP_USERNAME").ok());
    let password = normalize_optional(env::var("SMTP_PASSWORD").ok());
    let starttls = env::var("SMTP_STARTTLS")
        .map(|v| parse_bool(&v))
        .unwrap_or(true);
    let provider_key = env::var("EMAIL_PROVIDER")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| "custom".to_string());
    let display_name = env::var("EMAIL_SERVICE_NAME")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| format!("SMTP {}", provider_key.to_uppercase()));

    sqlx::query(
        r#"
        INSERT INTO organization_email_services (
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls,
            updated_at
        )
        VALUES ($1, 'smtp', $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10, NOW())
        "#,
    )
    .bind(organization_id)
    .bind(provider_key)
    .bind(display_name)
    .bind(enabled)
    .bind(host)
    .bind(port)
    .bind(from)
    .bind(username)
    .bind(password)
    .bind(starttls)
    .execute(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al bootstrapear servicio SMTP desde entorno: {}", e),
        )
    })?;

    Ok(())
}

async fn select_default_service(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    organization_id: Uuid,
    service_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organization_email_services SET is_default = FALSE WHERE organization_id = $1",
    )
    .bind(organization_id)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE organization_email_services SET is_default = TRUE, updated_at = NOW() WHERE id = $1 AND organization_id = $2",
    )
    .bind(service_id)
    .bind(organization_id)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

pub async fn list_organization_email_services(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<OrganizationEmailServiceResponse>>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    ensure_bootstrap_service(&pool, org_ctx.id).await?;

    let rows = sqlx::query_as::<_, OrganizationEmailServiceRow>(
        r#"
        SELECT
            id,
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls
        FROM organization_email_services
        WHERE organization_id = $1
        ORDER BY is_default DESC, created_at ASC
        "#,
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al cargar servicios de email: {}", e),
        )
    })?;

    Ok(Json(rows.into_iter().map(to_response).collect()))
}

pub async fn create_organization_email_service(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Json(payload): Json<UpsertOrganizationEmailServicePayload>,
) -> Result<Json<OrganizationEmailServiceResponse>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    validate_payload(&payload)?;

    let service_type = payload.service_type.trim().to_lowercase();
    let provider_key = payload.provider_key.trim().to_lowercase();
    let display_name = payload.display_name.trim().to_string();
    let smtp_host = normalize_optional(payload.smtp_host);
    let smtp_from = normalize_optional(payload.smtp_from);
    let smtp_username = normalize_optional(payload.smtp_username);
    let smtp_password = normalize_optional(payload.smtp_password);

    let mut tx = pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al abrir transacción: {}", e),
        )
    })?;

    let existing_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organization_email_services WHERE organization_id = $1",
    )
    .bind(org_ctx.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al contar servicios de email: {}", e),
        )
    })?;

    let make_default = payload.is_default || existing_count == 0;

    let row = sqlx::query_as::<_, OrganizationEmailServiceRow>(
        r#"
        INSERT INTO organization_email_services (
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING
            id,
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls
        "#,
    )
    .bind(org_ctx.id)
    .bind(service_type)
    .bind(provider_key)
    .bind(display_name)
    .bind(payload.is_enabled)
    .bind(smtp_host)
    .bind(payload.smtp_port)
    .bind(smtp_from)
    .bind(smtp_username)
    .bind(smtp_password)
    .bind(payload.smtp_starttls)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al crear servicio de email: {}", e),
        )
    })?;

    if make_default {
        select_default_service(&mut tx, org_ctx.id, row.id)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al establecer servicio por defecto: {}", e),
                )
            })?;
    }

    let row = sqlx::query_as::<_, OrganizationEmailServiceRow>(
        r#"
        SELECT
            id,
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls
        FROM organization_email_services
        WHERE id = $1 AND organization_id = $2
        "#,
    )
    .bind(row.id)
    .bind(org_ctx.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al recargar servicio de email: {}", e),
        )
    })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al confirmar transacción: {}", e),
        )
    })?;

    log_action(
        &pool,
        claims.org,
        claims.sub,
        "CREATE_EMAIL_SERVICE",
        "Organization",
        org_ctx.id,
        json!({
            "service_id": row.id,
            "service_type": row.service_type,
            "provider_key": row.provider_key,
            "display_name": row.display_name,
            "is_enabled": row.is_enabled,
            "is_default": row.is_default,
        }),
    )
    .await;

    Ok(Json(to_response(row)))
}

pub async fn update_organization_email_service(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpsertOrganizationEmailServicePayload>,
) -> Result<Json<OrganizationEmailServiceResponse>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    validate_payload(&payload)?;

    let service_type = payload.service_type.trim().to_lowercase();
    let provider_key = payload.provider_key.trim().to_lowercase();
    let display_name = payload.display_name.trim().to_string();
    let smtp_host = normalize_optional(payload.smtp_host);
    let smtp_from = normalize_optional(payload.smtp_from);
    let smtp_username = normalize_optional(payload.smtp_username);
    let smtp_password = normalize_optional(payload.smtp_password);

    let mut tx = pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al abrir transacción: {}", e),
        )
    })?;

    let row = sqlx::query_as::<_, OrganizationEmailServiceRow>(
        r#"
        UPDATE organization_email_services
        SET
            service_type = $3,
            provider_key = $4,
            display_name = $5,
            is_enabled = $6,
            smtp_host = $7,
            smtp_port = $8,
            smtp_from = $9,
            smtp_username = $10,
            smtp_password = CASE
                WHEN $11 IS NULL OR btrim($11) = '' THEN smtp_password
                ELSE $11
            END,
            smtp_starttls = $12,
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING
            id,
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls
        "#,
    )
    .bind(id)
    .bind(org_ctx.id)
    .bind(service_type)
    .bind(provider_key)
    .bind(display_name)
    .bind(payload.is_enabled)
    .bind(smtp_host)
    .bind(payload.smtp_port)
    .bind(smtp_from)
    .bind(smtp_username)
    .bind(smtp_password)
    .bind(payload.smtp_starttls)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al actualizar servicio de email: {}", e),
        )
    })?
    .ok_or((StatusCode::NOT_FOUND, "Servicio no encontrado".to_string()))?;

    if payload.is_default {
        select_default_service(&mut tx, org_ctx.id, row.id)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al establecer servicio por defecto: {}", e),
                )
            })?;
    }

    let row = sqlx::query_as::<_, OrganizationEmailServiceRow>(
        r#"
        SELECT
            id,
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls
        FROM organization_email_services
        WHERE id = $1 AND organization_id = $2
        "#,
    )
    .bind(row.id)
    .bind(org_ctx.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al recargar servicio de email: {}", e),
        )
    })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al confirmar transacción: {}", e),
        )
    })?;

    log_action(
        &pool,
        claims.org,
        claims.sub,
        "UPDATE_EMAIL_SERVICE",
        "Organization",
        org_ctx.id,
        json!({
            "service_id": row.id,
            "service_type": row.service_type,
            "provider_key": row.provider_key,
            "display_name": row.display_name,
            "is_enabled": row.is_enabled,
            "is_default": row.is_default,
        }),
    )
    .await;

    Ok(Json(to_response(row)))
}

pub async fn delete_organization_email_service(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    let mut tx = pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al abrir transacción: {}", e),
        )
    })?;

    let existing = sqlx::query_as::<_, (Uuid, bool)>(
        "SELECT id, is_default FROM organization_email_services WHERE id = $1 AND organization_id = $2",
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al verificar servicio: {}", e),
        )
    })?
    .ok_or((StatusCode::NOT_FOUND, "Servicio no encontrado".to_string()))?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organization_email_services WHERE organization_id = $1",
    )
    .bind(org_ctx.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al contar servicios: {}", e),
        )
    })?;

    if total <= 1 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Debe existir al menos un servicio de email por organización".to_string(),
        ));
    }

    sqlx::query("DELETE FROM organization_email_services WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al eliminar servicio de email: {}", e),
            )
        })?;

    if existing.1 {
        let replacement_id: Uuid = sqlx::query_scalar(
            "SELECT id FROM organization_email_services WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1",
        )
        .bind(org_ctx.id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al seleccionar reemplazo por defecto: {}", e),
            )
        })?;

        select_default_service(&mut tx, org_ctx.id, replacement_id)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Error al actualizar servicio por defecto: {}", e),
                )
            })?;
    }

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al confirmar transacción: {}", e),
        )
    })?;

    log_action(
        &pool,
        claims.org,
        claims.sub,
        "DELETE_EMAIL_SERVICE",
        "Organization",
        org_ctx.id,
        json!({ "service_id": id }),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn select_organization_email_service(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM organization_email_services WHERE id = $1 AND organization_id = $2)",
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al verificar servicio de email: {}", e),
        )
    })?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Servicio no encontrado".to_string()));
    }

    let mut tx = pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al abrir transacción: {}", e),
        )
    })?;

    select_default_service(&mut tx, org_ctx.id, id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al seleccionar servicio por defecto: {}", e),
            )
        })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al confirmar transacción: {}", e),
        )
    })?;

    log_action(
        &pool,
        claims.org,
        claims.sub,
        "SELECT_EMAIL_SERVICE",
        "Organization",
        org_ctx.id,
        json!({ "service_id": id }),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

// Compatibilidad temporal: mantiene el endpoint anterior pero devuelve el servicio por defecto.
pub async fn get_organization_email_settings(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<OrganizationEmailServiceResponse>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    ensure_bootstrap_service(&pool, org_ctx.id).await?;

    let row = sqlx::query_as::<_, OrganizationEmailServiceRow>(
        r#"
        SELECT
            id,
            organization_id,
            service_type,
            provider_key,
            display_name,
            is_enabled,
            is_default,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls
        FROM organization_email_services
        WHERE organization_id = $1
        ORDER BY is_default DESC, created_at ASC
        LIMIT 1
        "#,
    )
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al obtener servicio SMTP por defecto: {}", e),
        )
    })?;

    Ok(Json(to_response(row)))
}

// Compatibilidad temporal: actualiza el servicio por defecto actual.
pub async fn update_organization_email_settings(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Json(payload): Json<UpsertOrganizationEmailServicePayload>,
) -> Result<Json<OrganizationEmailServiceResponse>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    ensure_bootstrap_service(&pool, org_ctx.id).await?;

    let current_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM organization_email_services WHERE organization_id = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1",
    )
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error al resolver servicio SMTP actual: {}", e),
        )
    })?;

    update_organization_email_service(
        claims,
        Org(org_ctx),
        State(pool),
        Path(current_id),
        Json(payload),
    )
    .await
}
