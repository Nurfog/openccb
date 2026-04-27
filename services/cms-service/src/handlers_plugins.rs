use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::middleware::Org;
use common::auth::Claims;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct OrgPlugin {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub description: String,
    pub component_url: String,
    pub icon_url: Option<String>,
    pub config: serde_json::Value,
    pub enabled: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePluginPayload {
    pub name: String,
    pub description: Option<String>,
    pub component_url: String,
    pub icon_url: Option<String>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePluginPayload {
    pub name: Option<String>,
    pub description: Option<String>,
    pub component_url: Option<String>,
    pub icon_url: Option<String>,
    pub config: Option<serde_json::Value>,
    pub enabled: Option<bool>,
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /plugins — listar plugins de la org
// ─────────────────────────────────────────────────────────────────────────────

pub async fn list_plugins(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<OrgPlugin>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT id, organization_id, name, description, component_url, icon_url, config, enabled, created_at, updated_at
         FROM org_plugins
         WHERE organization_id = $1
         ORDER BY created_at ASC",
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let plugins = rows
        .into_iter()
        .map(|r| OrgPlugin {
            id: r.get("id"),
            organization_id: r.get("organization_id"),
            name: r.get("name"),
            description: r.get("description"),
            component_url: r.get("component_url"),
            icon_url: r.get("icon_url"),
            config: r.get("config"),
            enabled: r.get("enabled"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect();

    Ok(Json(plugins))
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /plugins/enabled — solo plugins activos (usado por Experience)
// ─────────────────────────────────────────────────────────────────────────────

pub async fn list_enabled_plugins(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<OrgPlugin>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT id, organization_id, name, description, component_url, icon_url, config, enabled, created_at, updated_at
         FROM org_plugins
         WHERE organization_id = $1 AND enabled = TRUE
         ORDER BY created_at ASC",
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let plugins = rows
        .into_iter()
        .map(|r| OrgPlugin {
            id: r.get("id"),
            organization_id: r.get("organization_id"),
            name: r.get("name"),
            description: r.get("description"),
            component_url: r.get("component_url"),
            icon_url: r.get("icon_url"),
            config: r.get("config"),
            enabled: r.get("enabled"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect();

    Ok(Json(plugins))
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /plugins — crear plugin
// ─────────────────────────────────────────────────────────────────────────────

pub async fn create_plugin(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePluginPayload>,
) -> Result<(StatusCode, Json<OrgPlugin>), (StatusCode, String)> {
    // Validación básica de URL (solo https permitido para componentes externos)
    if !payload.component_url.starts_with("https://") {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            "component_url debe usar HTTPS".to_string(),
        ));
    }

    let row = sqlx::query(
        r#"
        INSERT INTO org_plugins (organization_id, name, description, component_url, icon_url, config)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, organization_id, name, description, component_url, icon_url, config, enabled, created_at, updated_at
        "#,
    )
    .bind(org_ctx.id)
    .bind(&payload.name)
    .bind(payload.description.as_deref().unwrap_or(""))
    .bind(&payload.component_url)
    .bind(&payload.icon_url)
    .bind(payload.config.unwrap_or(serde_json::json!({})))
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(OrgPlugin {
        id: row.get("id"),
        organization_id: row.get("organization_id"),
        name: row.get("name"),
        description: row.get("description"),
        component_url: row.get("component_url"),
        icon_url: row.get("icon_url"),
        config: row.get("config"),
        enabled: row.get("enabled"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /plugins/{id} — actualizar plugin
// ─────────────────────────────────────────────────────────────────────────────

pub async fn update_plugin(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(plugin_id): Path<Uuid>,
    Json(payload): Json<UpdatePluginPayload>,
) -> Result<Json<OrgPlugin>, (StatusCode, String)> {
    // Verificar que pertenece a esta org
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM org_plugins WHERE id = $1 AND organization_id = $2)",
    )
    .bind(plugin_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Plugin no encontrado".to_string()));
    }

    // Validar URL si se actualiza
    if let Some(url) = &payload.component_url {
        if !url.starts_with("https://") {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                "component_url debe usar HTTPS".to_string(),
            ));
        }
    }

    let row = sqlx::query(
        r#"
        UPDATE org_plugins SET
            name          = COALESCE($3, name),
            description   = COALESCE($4, description),
            component_url = COALESCE($5, component_url),
            icon_url      = COALESCE($6, icon_url),
            config        = COALESCE($7, config),
            enabled       = COALESCE($8, enabled)
        WHERE id = $1 AND organization_id = $2
        RETURNING id, organization_id, name, description, component_url, icon_url, config, enabled, created_at, updated_at
        "#,
    )
    .bind(plugin_id)
    .bind(org_ctx.id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.component_url)
    .bind(&payload.icon_url)
    .bind(&payload.config)
    .bind(payload.enabled)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(OrgPlugin {
        id: row.get("id"),
        organization_id: row.get("organization_id"),
        name: row.get("name"),
        description: row.get("description"),
        component_url: row.get("component_url"),
        icon_url: row.get("icon_url"),
        config: row.get("config"),
        enabled: row.get("enabled"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /plugins/{id} — eliminar plugin
// ─────────────────────────────────────────────────────────────────────────────

pub async fn delete_plugin(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(plugin_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        "DELETE FROM org_plugins WHERE id = $1 AND organization_id = $2",
    )
    .bind(plugin_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Plugin no encontrado".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
