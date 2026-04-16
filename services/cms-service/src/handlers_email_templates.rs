use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::auth::Claims;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::handlers::log_action;

#[derive(Debug, Clone, sqlx::FromRow)]
struct OrganizationEmailTemplateRow {
    id: Uuid,
    organization_id: Uuid,
    template_key: String,
    display_name: String,
    subject_template: String,
    body_template: String,
    is_html: bool,
    is_enabled: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrganizationEmailTemplateResponse {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub template_key: String,
    pub display_name: String,
    pub subject_template: String,
    pub body_template: String,
    pub is_html: bool,
    pub is_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpsertOrganizationEmailTemplatePayload {
    pub template_key: String,
    pub display_name: String,
    pub subject_template: String,
    pub body_template: String,
    pub is_html: bool,
    pub is_enabled: bool,
}

pub async fn list_organization_email_templates(
    State(pool): State<PgPool>,
    claims: Claims,
) -> Result<Json<Vec<OrganizationEmailTemplateResponse>>, (StatusCode, String)> {
    let org_id = claims.org;

    let rows: Vec<OrganizationEmailTemplateRow> = sqlx::query_as::<_, OrganizationEmailTemplateRow>(
        "SELECT id, organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled, created_at, updated_at FROM organization_email_templates WHERE organization_id = $1 ORDER BY template_key",
    )
    .bind(org_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| {
        eprintln!("Error fetching email templates: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch email templates".to_string(),
        )
    })?;

    let responses = rows
        .into_iter()
        .map(|row| OrganizationEmailTemplateResponse {
            id: row.id,
            organization_id: row.organization_id,
            template_key: row.template_key,
            display_name: row.display_name,
            subject_template: row.subject_template,
            body_template: row.body_template,
            is_html: row.is_html,
            is_enabled: row.is_enabled,
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(responses))
}

pub async fn create_organization_email_template(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(payload): Json<UpsertOrganizationEmailTemplatePayload>,
) -> Result<Json<OrganizationEmailTemplateResponse>, (StatusCode, String)> {
    let org_id = claims.org;

    validate_template_payload(&payload)?;

    let row = sqlx::query_as::<_, OrganizationEmailTemplateRow>(
        "INSERT INTO organization_email_templates (organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled, created_at, updated_at",
    )
    .bind(org_id)
    .bind(&payload.template_key)
    .bind(&payload.display_name)
    .bind(&payload.subject_template)
    .bind(&payload.body_template)
    .bind(payload.is_html)
    .bind(payload.is_enabled)
    .fetch_one(&pool)
    .await
    .map_err(|e: sqlx::Error| {
        eprintln!("Error creating email template: {:?}", e);
        if e.to_string().contains("duplicate key") {
            (
                StatusCode::CONFLICT,
                format!("Template key '{}' already exists", payload.template_key),
            )
        } else {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to create email template".to_string(),
            )
        }
    })?;

    log_action(
        &pool,
        org_id,
        claims.sub,
        "create_email_template",
        "email_template",
        row.id,
        json!({
            "template_key": payload.template_key,
            "display_name": payload.display_name
        }),
    )
    .await;

    let response = OrganizationEmailTemplateResponse {
        id: row.id,
        organization_id: row.organization_id,
        template_key: row.template_key,
        display_name: row.display_name,
        subject_template: row.subject_template,
        body_template: row.body_template,
        is_html: row.is_html,
        is_enabled: row.is_enabled,
        created_at: row.created_at.to_rfc3339(),
        updated_at: row.updated_at.to_rfc3339(),
    };

    Ok(Json(response))
}

pub async fn update_organization_email_template(
    State(pool): State<PgPool>,
    claims: Claims,
    Path(template_id): Path<Uuid>,
    Json(payload): Json<UpsertOrganizationEmailTemplatePayload>,
) -> Result<Json<OrganizationEmailTemplateResponse>, (StatusCode, String)> {
    let org_id = claims.org;

    validate_template_payload(&payload)?;

    let row = sqlx::query_as::<_, OrganizationEmailTemplateRow>(
        "UPDATE organization_email_templates
         SET display_name = $3, subject_template = $4, body_template = $5, is_html = $6, is_enabled = $7, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2
         RETURNING id, organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled, created_at, updated_at",
    )
    .bind(template_id)
    .bind(org_id)
    .bind(&payload.display_name)
    .bind(&payload.subject_template)
    .bind(&payload.body_template)
    .bind(payload.is_html)
    .bind(payload.is_enabled)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| {
        eprintln!("Error updating email template: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update email template".to_string(),
        )
    })?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Email template not found".to_string(),
    ))?;

    log_action(
        &pool,
        org_id,
        claims.sub,
        "update_email_template",
        "email_template",
        template_id,
        json!({
            "template_id": template_id,
            "template_key": payload.template_key,
            "display_name": payload.display_name
        }),
    )
    .await;

    let response = OrganizationEmailTemplateResponse {
        id: row.id,
        organization_id: row.organization_id,
        template_key: row.template_key,
        display_name: row.display_name,
        subject_template: row.subject_template,
        body_template: row.body_template,
        is_html: row.is_html,
        is_enabled: row.is_enabled,
        created_at: row.created_at.to_rfc3339(),
        updated_at: row.updated_at.to_rfc3339(),
    };

    Ok(Json(response))
}

pub async fn delete_organization_email_template(
    State(pool): State<PgPool>,
    claims: Claims,
    Path(template_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let org_id = claims.org;

    let result = sqlx::query(
        "DELETE FROM organization_email_templates WHERE id = $1 AND organization_id = $2",
    )
    .bind(template_id)
    .bind(org_id)
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| {
        eprintln!("Error deleting email template: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to delete email template".to_string(),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Email template not found".to_string(),
        ));
    }

    log_action(
        &pool,
        org_id,
        claims.sub,
        "delete_email_template",
        "email_template",
        template_id,
        json!({"template_id": template_id}),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

fn validate_template_payload(payload: &UpsertOrganizationEmailTemplatePayload) -> Result<(), (StatusCode, String)> {
    if payload.template_key.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "template_key cannot be empty".to_string(),
        ));
    }

    if payload.template_key.len() > 100 {
        return Err((
            StatusCode::BAD_REQUEST,
            "template_key must be 100 characters or less".to_string(),
        ));
    }

    if payload.display_name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "display_name cannot be empty".to_string(),
        ));
    }

    if payload.subject_template.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "subject_template cannot be empty".to_string(),
        ));
    }

    if payload.body_template.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "body_template cannot be empty".to_string(),
        ));
    }

    Ok(())
}