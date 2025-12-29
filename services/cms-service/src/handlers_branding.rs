// Organization Branding Handlers

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::models::Organization;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::handlers::log_action;

#[derive(Deserialize, Serialize)]
pub struct BrandingPayload {
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
}

#[derive(Serialize)]
pub struct BrandingResponse {
    pub logo_url: Option<String>,
    pub primary_color: String,
    pub secondary_color: String,
}

// Upload organization logo
pub async fn upload_organization_logo(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(org_id): Path<Uuid>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Only admins can upload logos
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".into()));
    }

    // Verify organization exists and user has access
    let _ = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Organization not found".into()))?;

    // Process multipart form
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Multipart error: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let filename = field
                .file_name()
                .ok_or((StatusCode::BAD_REQUEST, "Missing filename".into()))?
                .to_string();

            // Validate file extension
            let ext = filename.split('.').last().unwrap_or("");
            if !["png", "jpg", "jpeg", "svg"].contains(&ext.to_lowercase().as_str()) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Invalid file type. Only PNG, JPG, and SVG allowed".into(),
                ));
            }

            let data = field.bytes().await.map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to read file: {}", e),
                )
            })?;

            // Validate file size (max 2MB)
            if data.len() > 2 * 1024 * 1024 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "File too large. Maximum 2MB allowed".into(),
                ));
            }

            // Create uploads directory if it doesn't exist
            std::fs::create_dir_all("uploads/org-logos").map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to create directory: {}", e),
                )
            })?;

            // Generate unique filename
            let unique_filename = format!("{}_{}.{}", org_id, uuid::Uuid::new_v4(), ext);
            let filepath = format!("uploads/org-logos/{}", unique_filename);

            // Save file
            std::fs::write(&filepath, &data).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to save file: {}", e),
                )
            })?;

            // Update organization in database
            let logo_url = format!("/{}", filepath);
            sqlx::query("UPDATE organizations SET logo_url = $1 WHERE id = $2")
                .bind(&logo_url)
                .bind(org_id)
                .execute(&pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Database error: {}", e),
                    )
                })?;

            log_action(
                &pool,
                claims.sub,
                "UPDATE_LOGO",
                "Organization",
                org_id,
                json!({"logo_url": &logo_url}),
            )
            .await;

            return Ok(Json(json!({
                "logo_url": logo_url,
                "message": "Logo uploaded successfully"
            })));
        }
    }

    Err((StatusCode::BAD_REQUEST, "No file provided".into()))
}

// Update organization branding colors
pub async fn update_organization_branding(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(org_id): Path<Uuid>,
    Json(payload): Json<BrandingPayload>,
) -> Result<Json<Organization>, (StatusCode, String)> {
    // Only admins can update branding
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".into()));
    }

    // Validate hex color format
    let validate_color = |color: &str| -> bool {
        color.len() == 7
            && color.starts_with('#')
            && color[1..].chars().all(|c| c.is_ascii_hexdigit())
    };

    if let Some(ref primary) = payload.primary_color {
        if !validate_color(primary) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Invalid primary_color format. Use #RRGGBB".into(),
            ));
        }
    }

    if let Some(ref secondary) = payload.secondary_color {
        if !validate_color(secondary) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Invalid secondary_color format. Use #RRGGBB".into(),
            ));
        }
    }

    // Update organization
    let org = sqlx::query_as::<_, Organization>(
        "UPDATE organizations 
         SET primary_color = COALESCE($1, primary_color),
             secondary_color = COALESCE($2, secondary_color),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *",
    )
    .bind(&payload.primary_color)
    .bind(&payload.secondary_color)
    .bind(org_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    log_action(
        &pool,
        claims.sub,
        "UPDATE_BRANDING",
        "Organization",
        org_id,
        json!(payload),
    )
    .await;

    Ok(Json(org))
}

// Get organization branding (public endpoint)
pub async fn get_organization_branding(
    State(pool): State<PgPool>,
    Path(org_id): Path<Uuid>,
) -> Result<Json<BrandingResponse>, StatusCode> {
    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(BrandingResponse {
        logo_url: org.logo_url,
        primary_color: org.primary_color.unwrap_or_else(|| "#3B82F6".to_string()),
        secondary_color: org.secondary_color.unwrap_or_else(|| "#8B5CF6".to_string()),
    }))
}
