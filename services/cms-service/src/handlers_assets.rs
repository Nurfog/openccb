use axum::{
    Json,
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
};
use common::models::{Asset};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use std::path::Path as StdPath;

#[derive(Debug, Serialize)]
pub struct AssetUploadResponse {
    pub id: Uuid,
    pub filename: String,
    pub url: String,
    pub mimetype: String,
    pub size_bytes: i64,
}

#[derive(Debug, Deserialize)]
pub struct AssetFilters {
    pub mimetype: Option<String>,
    pub course_id: Option<Uuid>,
    pub search: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

/// POST /api/assets/upload - Subir un archivo a la biblioteca global
pub async fn upload_asset(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    mut multipart: Multipart,
) -> Result<Json<AssetUploadResponse>, (StatusCode, String)> {
    let mut filename = String::new();
    let mut data = Vec::new();
    let mut mimetype = String::new();
    let mut course_id: Option<Uuid> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            filename = field.file_name().unwrap_or("unnamed").to_string();
            mimetype = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_string();
            data = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
                .to_vec();
        } else if name == "course_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = Uuid::parse_str(&txt) {
                    course_id = Some(id);
                }
            }
        }
    }

    if data.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No file uploaded".to_string()));
    }

    let asset_id = Uuid::new_v4();
    let extension = StdPath::new(&filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let storage_filename = format!("{}.{}", asset_id, extension);
    let storage_path = format!("uploads/{}", storage_filename);

    // Ensure uploads directory exists
    tokio::fs::create_dir_all("uploads")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Write file
    tokio::fs::write(&storage_path, data)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let size_bytes = tokio::fs::metadata(&storage_path)
        .await
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    // Record in DB
    sqlx::query!(
        r#"
        INSERT INTO assets (id, organization_id, uploaded_by, course_id, filename, storage_path, mimetype, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        asset_id,
        org_ctx.id,
        claims.sub,
        course_id,
        filename,
        storage_path,
        mimetype,
        size_bytes
    )
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AssetUploadResponse {
        id: asset_id,
        filename,
        url: format!("/assets/{}", storage_filename),
        mimetype,
        size_bytes,
    }))
}

/// GET /api/assets - Listar activos de la organización
pub async fn list_assets(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<AssetFilters>,
) -> Result<Json<Vec<Asset>>, (StatusCode, String)> {
    let limit = filters.limit.unwrap_or(50) as i64;
    let offset = ((filters.page.unwrap_or(1).max(1) - 1) * filters.limit.unwrap_or(50)) as i64;

    let mut query = String::from("SELECT * FROM assets WHERE organization_id = $1");
    let mut param_index = 2;

    if filters.mimetype.is_some() {
        query.push_str(&format!(" AND mimetype ILIKE ${}", param_index));
        param_index += 1;
    }

    if filters.course_id.is_some() {
        query.push_str(&format!(" AND course_id = ${}", param_index));
        param_index += 1;
    }

    if filters.search.is_some() {
        query.push_str(&format!(" AND filename ILIKE ${}", param_index));
        param_index += 1;
    }

    query.push_str(&format!(" ORDER BY created_at DESC LIMIT ${} OFFSET ${}", param_index, param_index + 1));

    let mut sql_query = sqlx::query_as::<_, Asset>(&query).bind(org_ctx.id);

    if let Some(mt) = &filters.mimetype {
        sql_query = sql_query.bind(format!("%{}%", mt));
    }

    if let Some(cid) = filters.course_id {
        sql_query = sql_query.bind(cid);
    }

    if let Some(search) = &filters.search {
        sql_query = sql_query.bind(format!("%{}%", search));
    }

    let assets = sql_query
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(assets))
}

/// DELETE /api/assets/:id - Eliminar un activo y su archivo físico
pub async fn delete_asset(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 1. Get asset metadata to find file path
    let asset = sqlx::query_as!(
        Asset,
        "SELECT * FROM assets WHERE id = $1 AND organization_id = $2",
        id,
        org_ctx.id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    // 2. Delete from DB
    sqlx::query!("DELETE FROM assets WHERE id = $1", id)
        .execute(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Delete physical file (async)
    let _ = tokio::fs::remove_file(&asset.storage_path).await;

    Ok(StatusCode::NO_CONTENT)
}
