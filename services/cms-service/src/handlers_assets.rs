use axum::{
    Json,
    extract::{Path, Query, State, Multipart},
    http::{StatusCode, HeaderMap, header},
    response::IntoResponse,
};
use aws_config::BehaviorVersion;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::{
    Client as S3Client,
    config::{Credentials, Region},
};
use common::models::{Asset};
use common::ai::{self, generate_embedding};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;
use std::collections::HashMap;
use std::env;
use std::path::Path as StdPath;
use std::sync::Arc;
use tokio::process::Command;
use tokio::io::AsyncWriteExt;
use tokio::task::JoinSet;

const DEFAULT_ZIP_IMPORT_MAX_UPLOAD_BYTES: u64 = 512 * 1024 * 1024; // 512 MiB
const DEFAULT_ZIP_IMPORT_MAX_ENTRY_BYTES: u64 = 64 * 1024 * 1024; // 64 MiB por archivo
const DEFAULT_ZIP_IMPORT_MAX_TOTAL_BYTES: u64 = 1024 * 1024 * 1024; // 1 GiB descomprimido

fn read_env_u64_with_bounds(name: &str, default: u64, min: u64, max: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|v| v.trim().parse::<u64>().ok())
        .map(|v| v.clamp(min, max))
        .unwrap_or(default)
}

fn read_env_usize_with_bounds(name: &str, default: usize, min: usize, max: usize) -> usize {
    env::var(name)
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .map(|v| v.clamp(min, max))
        .unwrap_or(default)
}

#[derive(Debug, Serialize)]
pub struct AssetUploadResponse {
    pub id: Uuid,
    pub filename: String,
    pub url: String,
    pub mimetype: String,
    pub size_bytes: i64,
}

#[derive(Debug, Serialize)]
pub struct AssetRagIngestResponse {
    pub asset_id: Uuid,
    pub source: String,
    pub chunks_ingested: usize,
    pub chars_ingested: usize,
}

#[derive(Debug, Serialize)]
pub struct AssetZipImportResponse {
    pub imported_assets: usize,
    pub rag_ingested_assets: usize,
    pub rag_chunks_ingested: usize,
    pub failed_entries: Vec<String>,
    pub rag_background_started: bool,
    pub rag_background_items: usize,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AssetImportHistoryItem {
    pub zip_batch_id: Uuid,
    pub source_zip_name: String,
    pub english_level: Option<String>,
    pub sam_plan_id: Option<i32>,
    pub sam_course_id: Option<i32>,
    pub asset_count: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AssetFilters {
    pub mimetype: Option<String>,
    pub course_id: Option<Uuid>,
    pub english_level: Option<String>,
    pub sam_plan_id: Option<i32>,
    pub sam_course_id: Option<i32>,
    pub search: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone)]
struct S3Settings {
    bucket: String,
    region: String,
    endpoint: Option<String>,
    public_base_url: Option<String>,
    force_path_style: bool,
}

fn load_s3_settings_from_env(prefix: &str) -> Option<S3Settings> {
    let bucket_key = format!("{}S3_BUCKET", prefix);
    let region_key = format!("{}S3_REGION", prefix);
    let endpoint_key = format!("{}S3_ENDPOINT", prefix);
    let public_base_key = format!("{}S3_PUBLIC_BASE_URL", prefix);
    let force_path_key = format!("{}S3_FORCE_PATH_STYLE", prefix);

    let bucket = env::var(&bucket_key).ok()?;
    let region = env::var(&region_key).unwrap_or_else(|_| "us-east-2".to_string());
    let endpoint = env::var(&endpoint_key).ok().filter(|v| !v.trim().is_empty());
    let public_base_url = env::var(&public_base_key)
        .ok()
        .filter(|v| !v.trim().is_empty());
    let force_path_style = env::var(&force_path_key)
        .map(|v| {
            let lower = v.to_lowercase();
            lower == "1" || lower == "true" || lower == "yes"
        })
        .unwrap_or(false);

    Some(S3Settings {
        bucket,
        region,
        endpoint,
        public_base_url,
        force_path_style,
    })
}

fn get_s3_settings() -> Option<S3Settings> {
    let enabled = env::var("ASSETS_STORAGE")
        .unwrap_or_else(|_| "local".to_string())
        .to_lowercase();

    if enabled != "s3" {
        return None;
    }

    load_s3_settings_from_env("")
}

fn get_dev_s3_settings() -> Option<S3Settings> {
    load_s3_settings_from_env("DEV_")
}

fn get_s3_settings_for_bucket(bucket: &str) -> Option<S3Settings> {
    if let Some(default) = get_s3_settings() {
        if default.bucket == bucket {
            return Some(default);
        }
    }

    if let Some(dev) = get_dev_s3_settings() {
        if dev.bucket == bucket {
            return Some(dev);
        }
    }

    None
}

async fn build_s3_client(settings: &S3Settings) -> Result<S3Client, (StatusCode, String)> {
    let region_provider = RegionProviderChain::first_try(Some(Region::new(settings.region.clone())))
        .or_default_provider();

    let mut loader = aws_config::defaults(BehaviorVersion::latest()).region(region_provider);

    let access_key = env::var("AWS_ACCESS_KEY_ID").ok();
    let secret_key = env::var("AWS_SECRET_ACCESS_KEY").ok();
    if let (Some(ak), Some(sk)) = (access_key, secret_key) {
        let creds = Credentials::new(ak, sk, None, None, "env");
        loader = loader.credentials_provider(creds);
    }

    let shared_config = loader.load().await;
    let mut s3_builder = aws_sdk_s3::config::Builder::from(&shared_config);
    if let Some(endpoint) = &settings.endpoint {
        s3_builder = s3_builder.endpoint_url(endpoint);
    }
    if settings.force_path_style {
        s3_builder = s3_builder.force_path_style(true);
    }

    Ok(S3Client::from_conf(s3_builder.build()))
}

fn build_s3_object_key(org_id: Uuid, course_id: Option<Uuid>, storage_filename: &str) -> String {
    match course_id {
        Some(cid) => format!("org/{}/course/{}/assets/{}", org_id, cid, storage_filename),
        None => format!("org/{}/shared/assets/{}", org_id, storage_filename),
    }
}

fn build_ready_for_rag_path(org_id: Uuid, asset_id: Uuid, filename: &str) -> String {
    let ext = StdPath::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    if ext.is_empty() {
        format!("uploads/ready-for-rag/{}/{}", org_id, asset_id)
    } else {
        format!("uploads/ready-for-rag/{}/{}.{}", org_id, asset_id, ext)
    }
}

fn build_s3_public_url(settings: &S3Settings, key: &str) -> String {
    if let Some(base) = &settings.public_base_url {
        return format!("{}/{}", base.trim_end_matches('/'), key);
    }

    format!(
        "https://{}.s3.{}.amazonaws.com/{}",
        settings.bucket, settings.region, key
    )
}

async fn maybe_push_local_file_to_s3(
    local_path: &str,
    storage_filename: &str,
    mimetype: &str,
    org_id: Uuid,
    course_id: Option<Uuid>,
) -> Result<Option<(String, String)>, (StatusCode, String)> {
    let settings = match get_s3_settings() {
        Some(s) => s,
        None => return Ok(None),
    };

    let bytes = tokio::fs::read(local_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al leer el archivo local: {}", e)))?;

    let client = build_s3_client(&settings).await?;
    let key = build_s3_object_key(org_id, course_id, storage_filename);

    let (storage_path, public_url) = push_bytes_to_s3(
        &client,
        &settings,
        &key,
        mimetype,
        bytes,
    )
    .await?;
    Ok(Some((storage_path, public_url)))
}

async fn push_bytes_to_s3(
    client: &S3Client,
    settings: &S3Settings,
    key: &str,
    mimetype: &str,
    bytes: Vec<u8>,
) -> Result<(String, String), (StatusCode, String)> {
    client
        .put_object()
        .bucket(&settings.bucket)
        .key(key)
        .content_type(mimetype)
        .body(bytes.into())
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Error al subir a S3: {}", e)))?;

    let storage_path = format!("s3://{}/{}", settings.bucket, key);
    let public_url = build_s3_public_url(settings, key);
    Ok((storage_path, public_url))
}

async fn delete_storage_path(storage_path: &str) -> Result<(), (StatusCode, String)> {
    if let Some((bucket, key)) = parse_s3_storage_path(storage_path) {
        let settings = get_s3_settings_for_bucket(bucket).ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Se encontró una ruta de almacenamiento S3 pero S3 no está configurado".to_string(),
        ))?;
        let client = build_s3_client(&settings).await?;
        client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Error al eliminar de S3: {}", e)))?;
        return Ok(());
    }

    let _ = tokio::fs::remove_file(storage_path).await;
    Ok(())
}

async fn cleanup_local_temp_file(storage_path: &str) {
    if !storage_path.starts_with("s3://") {
        let _ = tokio::fs::remove_file(storage_path).await;
    }
}

fn parse_s3_storage_path(path: &str) -> Option<(&str, &str)> {
    let without_prefix = path.strip_prefix("s3://")?;
    let (bucket, key) = without_prefix.split_once('/')?;
    if bucket.is_empty() || key.is_empty() {
        return None;
    }
    Some((bucket, key))
}

/// GET /api/assets/s3-proxy/{bucket}/{*key}
/// Realiza un proxy de objetos privados de S3 a través del CMS para que las URLs del frontend no dependan de ACLs de lectura pública.
pub async fn public_s3_proxy(
    Path(params): Path<HashMap<String, String>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let bucket = params
        .get("bucket")
        .cloned()
        .ok_or((StatusCode::BAD_REQUEST, "Falta el cubo (bucket)".to_string()))?;
    let key = params
        .get("key")
        .cloned()
        .ok_or((StatusCode::BAD_REQUEST, "Falta la clave (key)".to_string()))?;

    let settings = get_s3_settings_for_bucket(&bucket).ok_or((
        StatusCode::NOT_FOUND,
        "El almacenamiento S3 no está configurado".to_string(),
    ))?;

    if bucket != settings.bucket {
        return Err((StatusCode::FORBIDDEN, "Cubo (bucket) no permitido".to_string()));
    }

    let storage_path = format!("s3://{}/{}", bucket, key);
    let bytes = read_storage_bytes(&storage_path).await?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        "application/octet-stream"
            .parse()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Cabecera inválida: {}", e)))?,
    );
    headers.insert(
        header::CACHE_CONTROL,
        "public, max-age=3600"
            .parse()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Cabecera inválida: {}", e)))?,
    );

    Ok((headers, bytes))
}

async fn read_storage_bytes(storage_path: &str) -> Result<Vec<u8>, (StatusCode, String)> {
    if let Some((bucket, key)) = parse_s3_storage_path(storage_path) {
        let settings = get_s3_settings_for_bucket(bucket).ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "S3 storage path found but S3 is not configured".to_string(),
        ))?;
        let client = build_s3_client(&settings).await?;
        let output = client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Error al leer de S3: {}", e)))?;
        let data = output
            .body
            .collect()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Error al leer el flujo de S3: {}", e)))?;
        return Ok(data.into_bytes().to_vec());
    }

    tokio::fs::read(storage_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error de lectura: {}", e)))
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
    let mut english_level: Option<String> = None;
    let mut sam_plan_id: Option<i32> = None;
    let mut sam_course_id: Option<i32> = None;

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
        } else if name == "english_level" {
            if let Ok(txt) = field.text().await {
                let value = txt.trim();
                if !value.is_empty() {
                    english_level = Some(value.to_string());
                }
            }
        } else if name == "sam_plan_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = txt.trim().parse::<i32>() {
                    sam_plan_id = Some(id);
                }
            }
        } else if name == "sam_course_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = txt.trim().parse::<i32>() {
                    sam_course_id = Some(id);
                }
            }
        }
    }

    if data.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No se subió ningún archivo".to_string()));
    }

    let asset_id = Uuid::new_v4();

    // Asegurar que el directorio de subidas existe
    tokio::fs::create_dir_all("uploads")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (storage_filename, storage_path, stored_filename, stored_mimetype) =
        if is_flv_media(&filename, &mimetype) {
            let temp_storage_filename = format!("{}.flv", asset_id);
            let temp_storage_path = format!("uploads/{}", temp_storage_filename);
            tokio::fs::write(&temp_storage_path, data)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let final_storage_filename = format!("{}.mp4", asset_id);
            let final_storage_path = format!("uploads/{}", final_storage_filename);
            transcode_flv_to_mp4(&temp_storage_path, &final_storage_path).await?;
            let _ = tokio::fs::remove_file(&temp_storage_path).await;

            (
                final_storage_filename,
                final_storage_path,
                replace_extension(&filename, "mp4"),
                "video/mp4".to_string(),
            )
        } else {
            let extension = StdPath::new(&filename)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            let storage_filename = if extension.is_empty() {
                asset_id.to_string()
            } else {
                format!("{}.{}", asset_id, extension)
            };
            let storage_path = format!("uploads/{}", storage_filename);

            tokio::fs::write(&storage_path, data)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            (storage_filename, storage_path, filename.clone(), mimetype.clone())
        };

    let size_bytes = tokio::fs::metadata(&storage_path)
        .await
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    let (db_storage_path, asset_url) = if let Some((s3_path, public_url)) = maybe_push_local_file_to_s3(
        &storage_path,
        &storage_filename,
        &stored_mimetype,
        org_ctx.id,
        course_id,
    )
    .await?
    {
        let _ = tokio::fs::remove_file(&storage_path).await;
        (s3_path, public_url)
    } else {
        (storage_path.clone(), format!("/assets/{}", storage_filename))
    };

    // Record in DB
    sqlx::query(
        r#"
        INSERT INTO assets (id, organization_id, uploaded_by, course_id, english_level, sam_plan_id, sam_course_id, filename, storage_path, mimetype, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(asset_id)
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(course_id)
    .bind(&english_level)
    .bind(sam_plan_id)
    .bind(sam_course_id)
    .bind(&stored_filename)
    .bind(&db_storage_path)
    .bind(&stored_mimetype)
    .bind(size_bytes)
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AssetUploadResponse {
        id: asset_id,
        filename: stored_filename,
        url: asset_url,
        mimetype: stored_mimetype,
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

    if filters.english_level.is_some() {
        query.push_str(&format!(" AND english_level = ${}", param_index));
        param_index += 1;
    }

    if filters.sam_plan_id.is_some() {
        query.push_str(&format!(" AND sam_plan_id = ${}", param_index));
        param_index += 1;
    }

    if filters.sam_course_id.is_some() {
        query.push_str(&format!(" AND sam_course_id = ${}", param_index));
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

    if let Some(level) = &filters.english_level {
        sql_query = sql_query.bind(level);
    }

    if let Some(plan_id) = filters.sam_plan_id {
        sql_query = sql_query.bind(plan_id);
    }

    if let Some(course_id) = filters.sam_course_id {
        sql_query = sql_query.bind(course_id);
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

pub async fn list_asset_import_history(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<AssetImportHistoryItem>>, (StatusCode, String)> {
    let items = sqlx::query_as::<_, AssetImportHistoryItem>(
        r#"
        SELECT
            zip_batch_id,
            source_zip_name,
            english_level,
            sam_plan_id,
            sam_course_id,
            COUNT(*)::bigint AS asset_count,
            MAX(created_at) AS created_at
        FROM assets
        WHERE organization_id = $1
          AND zip_batch_id IS NOT NULL
          AND source_zip_name IS NOT NULL
        GROUP BY zip_batch_id, source_zip_name, english_level, sam_plan_id, sam_course_id
        ORDER BY MAX(created_at) DESC
        LIMIT 100
        "#,
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(items))
}

/// DELETE /api/assets/:id - Eliminar un activo y su archivo físico
pub async fn delete_asset(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 1. Obtener metadatos del activo para encontrar la ruta del archivo
    let asset: Asset = sqlx::query_as(
        "SELECT * FROM assets WHERE id = $1 AND organization_id = $2"
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Activo no encontrado".to_string()))?;

    // 2. Eliminar de la base de datos
    sqlx::query("DELETE FROM assets WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Eliminar archivo físico u objeto de S3
    let _ = delete_storage_path(&asset.storage_path).await;

    Ok(StatusCode::NO_CONTENT)
}

/// Lógica interna de ingesta RAG reutilizable (también usada en retry de tareas).
pub async fn ingest_asset_for_rag_core(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    asset_id: Uuid,
) -> Result<(usize, usize), String> {
    let asset: Asset = sqlx::query_as("SELECT * FROM assets WHERE id = $1 AND organization_id = $2")
        .bind(asset_id)
        .bind(org_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Activo no encontrado".to_string())?;

    let extracted = extract_asset_text(&asset)
        .await
        .map_err(|(_, msg)| msg)?;
    let content = extracted.trim().to_string();

    if content.len() < 80 {
        return Err("No se encontró suficiente texto utilizable en el archivo".to_string());
    }

    let chunks = chunk_text(&content, 900);
    if chunks.is_empty() {
        return Err("No se pudo generar contenido para RAG".to_string());
    }

    sqlx::query(
        r#"
        DELETE FROM question_bank
        WHERE organization_id = $1
          AND source = 'imported-material'
          AND source_metadata->>'asset_id' = $2
        "#,
    )
    .bind(org_id)
    .bind(asset.id.to_string())
    .execute(pool)
    .await
    .map_err(|e| format!("Cleanup failed: {}", e))?;

    let source_kind = if asset.mimetype.starts_with("audio/") || asset.mimetype.starts_with("video/") {
        "audio-transcription"
    } else if asset.mimetype.contains("pdf") {
        "pdf"
    } else {
        "text"
    };

    let skill = if asset.mimetype.starts_with("audio/") || asset.mimetype.starts_with("video/") {
        Some("listening")
    } else {
        Some("reading")
    };

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();

    ingest_chunks_to_question_bank(
        pool,
        org_id,
        user_id,
        &asset,
        source_kind,
        skill,
        &chunks,
        &client,
        &ollama_url,
        &model,
        None,
        None,
        asset.unit_number,
    )
    .await
    .map_err(|(_, msg)| msg)?;

    Ok((chunks.len(), content.len()))
}

/// POST /api/assets/:id/ingest-rag - Ingesta un asset (PDF/audio/video/texto) en chunks para RAG
pub async fn ingest_asset_for_rag(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<AssetRagIngestResponse>, (StatusCode, String)> {
    let (chunks_ingested, chars_ingested) = ingest_asset_for_rag_core(&pool, org_ctx.id, claims.sub, id)
        .await
        .map_err(|e| {
            if e.contains("Activo no encontrado") {
                (StatusCode::NOT_FOUND, e)
            } else if e.contains("suficiente texto") || e.contains("generar contenido") {
                (StatusCode::BAD_REQUEST, e)
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, e)
            }
        })?;

    let asset: Asset = sqlx::query_as("SELECT * FROM assets WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let source_kind = if asset.mimetype.starts_with("audio/") || asset.mimetype.starts_with("video/") {
        "audio-transcription"
    } else if asset.mimetype.contains("pdf") {
        "pdf"
    } else {
        "text"
    };

    Ok(Json(AssetRagIngestResponse {
        asset_id: asset.id,
        source: source_kind.to_string(),
        chunks_ingested,
        chars_ingested,
    }))
}

/// POST /api/assets/import-zip - Importa todos los archivos de un ZIP a la biblioteca.
/// Campos multipart:
/// - file: ZIP requerido
/// - course_id: UUID opcional
/// - ingest_rag: true/false opcional (default false)
/// Extrae un número de unidad de la ruta de una entrada ZIP usando el nombre de la carpeta de nivel superior.
/// Supports: "Unit 1/...", "Unidad 1/...", "unit-01/...", "01/...", "1/..."
fn extract_unit_number(entry_name: &str) -> Option<i32> {
    let parts: Vec<&str> = entry_name.splitn(2, '/').collect();
    if parts.len() < 2 {
        return None; // file at ZIP root — no unit folder
    }
    let folder = parts[0].trim();
    if folder.is_empty() {
        return None;
    }
    let lower = folder.to_lowercase();
    // Eliminar prefijos textuales comunes, luego analizar los dígitos iniciales
    let stripped = lower
        .trim_start_matches("unidad")
        .trim_start_matches("unit")
        .trim_start_matches('u')
        .trim_start_matches(|c: char| !c.is_ascii_digit());
    let digits: String = stripped.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok()
}

struct ZipEntryData {
    entry_name: String,
    safe_filename: String,
    content: Vec<u8>,
    unit_number: Option<i32>,
    guessed_mimetype: String,
    is_audio_video: bool,
    is_flv: bool,
}

struct PendingZipRagItem {
    entry_name: String,
    asset: Asset,
    is_audio_video: bool,
    unit_number: Option<i32>,
}

async fn create_zip_rag_background_task(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    course_id: Option<Uuid>,
    zip_batch_id: Uuid,
    total_items: usize,
) -> Result<Uuid, sqlx::Error> {
    let task_id = Uuid::new_v4();
    let course_title = if let Some(cid) = course_id {
        sqlx::query_scalar::<_, String>("SELECT title FROM courses WHERE id = $1")
            .bind(cid)
            .fetch_optional(pool)
            .await?
    } else {
        None
    };

    sqlx::query(
        r#"
        INSERT INTO background_tasks (
            id,
            organization_id,
            created_by,
            title,
            course_title,
            task_type,
            status,
            progress,
            total_items,
            processed_items,
            failed_items,
            metadata,
            created_at,
            updated_at
        )
        VALUES (
            $1, $2, $3,
            'ZIP import RAG processing',
            $4,
            'zip_rag_import',
            'queued',
            0,
            $5,
            0,
            0,
            jsonb_build_object('zip_batch_id', $6::text),
            NOW(),
            NOW()
        )
        "#,
    )
    .bind(task_id)
    .bind(org_id)
    .bind(user_id)
    .bind(course_title)
    .bind(total_items as i32)
    .bind(zip_batch_id.to_string())
    .execute(pool)
    .await?;

    Ok(task_id)
}

pub async fn set_zip_rag_task_status(
    pool: &PgPool,
    task_id: Uuid,
    status: &str,
    progress: i32,
    processed_items: usize,
    failed_items: usize,
    error_message: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE background_tasks
        SET status = $2,
            progress = $3,
            processed_items = $4,
            failed_items = $5,
            error_message = $6,
            updated_at = NOW()
        WHERE id = $1
          AND task_type = 'zip_rag_import'
        "#,
    )
    .bind(task_id)
    .bind(status)
    .bind(progress)
    .bind(processed_items as i32)
    .bind(failed_items as i32)
    .bind(error_message)
    .execute(pool)
    .await?;

    Ok(())
}

async fn process_zip_entry_without_rag(
    entry: ZipEntryData,
    org_id: Uuid,
    user_id: Uuid,
    pool: PgPool,
    zip_batch_id: Uuid,
    source_zip_name: String,
    course_id: Option<Uuid>,
    english_level: Option<String>,
    sam_plan_id: Option<i32>,
    sam_course_id: Option<i32>,
    split_midpoint: Option<i32>,
    sam_course_id_r1: Option<i32>,
    sam_course_id_r2: Option<i32>,
    s3_settings: Option<S3Settings>,
    s3_client: Option<S3Client>,
    use_dev_processing: bool,
    ingest_rag: bool,
) -> Result<(), String> {
    let ZipEntryData {
        entry_name,
        safe_filename,
        content,
        unit_number,
        guessed_mimetype,
        is_flv,
        ..
    } = entry;

    let effective_sam_course_id = match (split_midpoint, unit_number) {
        (Some(mid), Some(u)) => {
            if u <= mid { sam_course_id_r1 } else { sam_course_id_r2 }
        }
        _ => sam_course_id,
    };

    let asset_id = Uuid::new_v4();

    let (storage_path, stored_filename, mimetype) = if is_flv {
        if use_dev_processing && ingest_rag {
            let temp_storage_filename = format!("{}.flv", asset_id);
            let temp_storage_path = format!("uploads/tmp/{}", temp_storage_filename);
            tokio::fs::create_dir_all("uploads/tmp")
                .await
                .map_err(|e| format!("{}: Error creating temp dir ({})", entry_name, e))?;
            tokio::fs::write(&temp_storage_path, &content)
                .await
                .map_err(|e| format!("{}: Error en la escritura local ({})", entry_name, e))?;

            let storage_path = build_ready_for_rag_path(org_id, asset_id, &format!("{}.mp4", asset_id));
            tokio::fs::create_dir_all(StdPath::new(&storage_path).parent().unwrap_or(StdPath::new(".")))
                .await
                .map_err(|e| format!("{}: Error creating ready-for-rag dir ({})", entry_name, e))?;

            if let Err((_, msg)) = transcode_flv_to_mp4(&temp_storage_path, &storage_path).await {
                let _ = tokio::fs::remove_file(&temp_storage_path).await;
                return Err(format!("{}: la transcodificación de flv falló ({})", entry_name, msg));
            }
            let _ = tokio::fs::remove_file(&temp_storage_path).await;
            (
                storage_path,
                replace_extension(&safe_filename, "mp4"),
                "video/mp4".to_string(),
            )
        } else if use_dev_processing {
            let temp_storage_filename = format!("{}.flv", asset_id);
            let temp_storage_path = format!("uploads/tmp/{}", temp_storage_filename);
            tokio::fs::create_dir_all("uploads/tmp")
                .await
                .map_err(|e| format!("{}: Error creating temp dir ({})", entry_name, e))?;
            tokio::fs::write(&temp_storage_path, &content)
                .await
                .map_err(|e| format!("{}: Error en la escritura local ({})", entry_name, e))?;

            let final_storage_filename = format!("{}.mp4", asset_id);
            let final_storage_path = format!("uploads/{}", final_storage_filename);
            if let Err((_, msg)) = transcode_flv_to_mp4(&temp_storage_path, &final_storage_path).await {
                let _ = tokio::fs::remove_file(&temp_storage_path).await;
                return Err(format!("{}: la transcodificación de flv falló ({})", entry_name, msg));
            }
            let _ = tokio::fs::remove_file(&temp_storage_path).await;
            (
                final_storage_path,
                replace_extension(&safe_filename, "mp4"),
                "video/mp4".to_string(),
            )
        } else {
            let temp_storage_filename = format!("{}.flv", asset_id);
            let temp_storage_path = format!("uploads/{}", temp_storage_filename);
            tokio::fs::write(&temp_storage_path, &content)
                .await
                .map_err(|e| format!("{}: Error en la escritura local ({})", entry_name, e))?;

            let final_storage_filename = format!("{}.mp4", asset_id);
            let final_storage_path = format!("uploads/{}", final_storage_filename);
            if let Err((_, msg)) = transcode_flv_to_mp4(&temp_storage_path, &final_storage_path).await {
                let _ = tokio::fs::remove_file(&temp_storage_path).await;
                return Err(format!("{}: la transcodificación de flv falló ({})", entry_name, msg));
            }
            let _ = tokio::fs::remove_file(&temp_storage_path).await;

            (
                final_storage_path,
                replace_extension(&safe_filename, "mp4"),
                "video/mp4".to_string(),
            )
        }
    } else {
        if use_dev_processing && ingest_rag {
            let storage_path = build_ready_for_rag_path(org_id, asset_id, &safe_filename);
            tokio::fs::create_dir_all(StdPath::new(&storage_path).parent().unwrap_or(StdPath::new(".")))
                .await
                .map_err(|e| format!("{}: Error creating ready-for-rag dir ({})", entry_name, e))?;
            tokio::fs::write(&storage_path, &content)
                .await
                .map_err(|e| format!("{}: Error en la escritura local ({})", entry_name, e))?;
            (storage_path, safe_filename.clone(), guessed_mimetype)
        } else {
            let extension = StdPath::new(&safe_filename)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            let storage_filename = if extension.is_empty() {
                asset_id.to_string()
            } else {
                format!("{}.{}", asset_id, extension)
            };
            let storage_path = format!("uploads/{}", storage_filename);

            (storage_path, safe_filename.clone(), guessed_mimetype)
        }
    };

    let storage_filename_for_s3 = StdPath::new(&storage_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let (db_storage_path, persisted_size, _asset_public_url) = if !storage_filename_for_s3.is_empty() {
        if let (Some(settings), Some(client)) = (s3_settings.as_ref(), s3_client.as_ref()) {
            let key = build_s3_object_key(org_id, course_id, &storage_filename_for_s3);
            let upload_bytes = if is_flv {
                tokio::fs::read(&storage_path)
                    .await
                    .map_err(|e| format!("{}: local read failed ({})", entry_name, e))?
            } else {
                content
            };
            let uploaded_len = upload_bytes.len() as i64;
            let (s3_path, public_url) = push_bytes_to_s3(client, settings, &key, &mimetype, upload_bytes)
                .await
                .map_err(|(_, msg)| format!("{}: s3 upload failed ({})", entry_name, msg))?;

            cleanup_local_temp_file(&storage_path).await;

            (s3_path, uploaded_len, public_url)
        } else {
            if !is_flv {
                tokio::fs::write(&storage_path, &content)
                    .await
                    .map_err(|e| format!("{}: local write failed ({})", entry_name, e))?;
            }

            let size = tokio::fs::metadata(&storage_path)
                .await
                .map(|m| m.len() as i64)
                .unwrap_or(content.len() as i64);

            (
                storage_path.clone(),
                size,
                format!("/assets/{}", storage_filename_for_s3),
            )
        }
    } else {
        (storage_path.clone(), content.len() as i64, storage_path.clone())
    };

    sqlx::query(
        r#"
        INSERT INTO assets (id, organization_id, uploaded_by, zip_batch_id, source_zip_name, course_id, english_level, sam_plan_id, sam_course_id, unit_number, filename, storage_path, mimetype, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        "#,
    )
    .bind(asset_id)
    .bind(org_id)
    .bind(user_id)
    .bind(zip_batch_id)
    .bind(source_zip_name)
    .bind(course_id)
    .bind(&english_level)
    .bind(sam_plan_id)
    .bind(effective_sam_course_id)
    .bind(unit_number)
    .bind(&stored_filename)
    .bind(&db_storage_path)
    .bind(&mimetype)
    .bind(persisted_size)
    .execute(&pool)
    .await
    .map_err(|e| format!("{}: db insert failed ({})", entry_name, e))?;

    Ok(())
}

pub async fn import_assets_zip(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    mut multipart: Multipart,
) -> Result<Json<AssetZipImportResponse>, (StatusCode, String)> {
    let max_upload_bytes = read_env_u64_with_bounds(
        "ZIP_IMPORT_MAX_UPLOAD_BYTES",
        DEFAULT_ZIP_IMPORT_MAX_UPLOAD_BYTES,
        1,
        10 * 1024 * 1024 * 1024,
    );
    let max_entry_bytes = read_env_u64_with_bounds(
        "ZIP_IMPORT_MAX_ENTRY_BYTES",
        DEFAULT_ZIP_IMPORT_MAX_ENTRY_BYTES,
        1,
        2 * 1024 * 1024 * 1024,
    );
    let max_total_uncompressed_bytes = read_env_u64_with_bounds(
        "ZIP_IMPORT_MAX_TOTAL_BYTES",
        DEFAULT_ZIP_IMPORT_MAX_TOTAL_BYTES,
        1,
        20 * 1024 * 1024 * 1024,
    );

    let mut zip_temp_path: Option<String> = None;
    let mut zip_original_name: Option<String> = None;
    let mut course_id: Option<Uuid> = None;
    let mut english_level: Option<String> = None;
    let mut sam_plan_id: Option<i32> = None;
    let mut sam_course_id: Option<i32> = None;
    let mut ingest_rag = false;
    let mut split_to_regular = false;
    let mut sam_course_id_r1: Option<i32> = None;
    let mut sam_course_id_r2: Option<i32> = None;
    let mut use_dev_processing = false;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();

        if name == "file" {
            if let Some(file_name) = field.file_name() {
                zip_original_name = Some(
                    StdPath::new(file_name)
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or(file_name)
                        .to_string(),
                );
            }
            let temp_name = format!("uploads/tmp/import-{}.zip", Uuid::new_v4());
            tokio::fs::create_dir_all("uploads/tmp")
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create temp dir: {}", e)))?;

            let mut temp_file = tokio::fs::File::create(&temp_name)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create temp zip file: {}", e)))?;
            let mut received_bytes: u64 = 0;

            while let Some(chunk) = field
                .chunk()
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read upload chunk: {}", e)))?
            {
                received_bytes = received_bytes.saturating_add(chunk.len() as u64);
                if received_bytes > max_upload_bytes {
                    let _ = tokio::fs::remove_file(&temp_name).await;
                    return Err((
                        StatusCode::PAYLOAD_TOO_LARGE,
                        format!(
                            "ZIP demasiado grande (>{} bytes). Ajusta ZIP_IMPORT_MAX_UPLOAD_BYTES si necesitas permitir más tamaño.",
                            max_upload_bytes
                        ),
                    ));
                }

                temp_file
                    .write_all(&chunk)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write temp zip file: {}", e)))?;
            }

            temp_file
                .flush()
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to flush temp zip file: {}", e)))?;

            zip_temp_path = Some(temp_name);
        } else if name == "course_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = Uuid::parse_str(txt.trim()) {
                    course_id = Some(id);
                }
            }
        } else if name == "ingest_rag" {
            if let Ok(txt) = field.text().await {
                let v = txt.trim().to_lowercase();
                ingest_rag = v == "1" || v == "true" || v == "yes";
            }
        } else if name == "english_level" {
            if let Ok(txt) = field.text().await {
                let value = txt.trim();
                if !value.is_empty() {
                    english_level = Some(value.to_string());
                }
            }
        } else if name == "sam_plan_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = txt.trim().parse::<i32>() {
                    sam_plan_id = Some(id);
                }
            }
        } else if name == "sam_course_id" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = txt.trim().parse::<i32>() {
                    sam_course_id = Some(id);
                }
            }
        } else if name == "split_to_regular" {
            if let Ok(txt) = field.text().await {
                let v = txt.trim().to_lowercase();
                split_to_regular = v == "1" || v == "true" || v == "yes";
            }
        } else if name == "sam_course_id_r1" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = txt.trim().parse::<i32>() {
                    sam_course_id_r1 = Some(id);
                }
            }
        } else if name == "sam_course_id_r2" {
            if let Ok(txt) = field.text().await {
                if let Ok(id) = txt.trim().parse::<i32>() {
                    sam_course_id_r2 = Some(id);
                }
            }
        } else if name == "use_dev_processing" {
            if let Ok(txt) = field.text().await {
                let v = txt.trim().to_lowercase();
                use_dev_processing = v == "1" || v == "true" || v == "yes";
            }
        }
    }

    let zip_path = match zip_temp_path {
        Some(path) => path,
        None => {
            return Err((StatusCode::BAD_REQUEST, "No ZIP file uploaded".to_string()));
        }
    };
    let zip_batch_id = Uuid::new_v4();
    let source_zip_name = zip_original_name.unwrap_or_else(|| "import.zip".to_string());

    let zip_file = std::fs::File::open(&zip_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to open temp zip file: {}", e)))?;

    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ZIP file".to_string()))?;

    if archive.is_empty() {
        let _ = std::fs::remove_file(&zip_path);
        return Err((StatusCode::BAD_REQUEST, "No ZIP file uploaded".to_string()));
    }

    // ── Phase 1: collect all ZIP entries into memory ──────────────────────────
    let mut all_entries: Vec<ZipEntryData> = Vec::new();
    let mut unit_set: std::collections::BTreeSet<i32> = Default::default();
    let mut total_uncompressed_bytes: u64 = 0;

    let len = archive.len();
    for i in 0..len {
        let mut file = archive
            .by_index(i)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP read error: {}", e)))?;

        if !file.is_file() {
            continue;
        }
        let entry_name = file.name().to_string();
        if entry_name.starts_with("__MACOSX/") || entry_name.ends_with(".DS_Store") {
            continue;
        }

        let declared_entry_size = file.size();
        if declared_entry_size > max_entry_bytes {
            let _ = std::fs::remove_file(&zip_path);
            return Err((
                StatusCode::PAYLOAD_TOO_LARGE,
                format!(
                    "Entrada ZIP demasiado grande: {} ({} bytes). Límite actual por archivo: {} bytes (ZIP_IMPORT_MAX_ENTRY_BYTES).",
                    entry_name,
                    declared_entry_size,
                    max_entry_bytes
                ),
            ));
        }
        total_uncompressed_bytes = total_uncompressed_bytes.saturating_add(declared_entry_size);
        if total_uncompressed_bytes > max_total_uncompressed_bytes {
            let _ = std::fs::remove_file(&zip_path);
            return Err((
                StatusCode::PAYLOAD_TOO_LARGE,
                format!(
                    "El ZIP excede el límite descomprimido total ({} bytes). Ajusta ZIP_IMPORT_MAX_TOTAL_BYTES para permitir más.",
                    max_total_uncompressed_bytes
                ),
            ));
        }

        let safe_filename = StdPath::new(&entry_name)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("unnamed")
            .to_string();

        let mut content = Vec::new();
        std::io::Read::read_to_end(&mut file, &mut content)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP entry read failed: {}", e)))?;

        let guessed_mimetype = mime_guess::from_path(&safe_filename)
            .first_or_octet_stream()
            .to_string();
        let is_flv = is_flv_media(&safe_filename, &guessed_mimetype);
        let is_audio_video = is_flv
            || guessed_mimetype.starts_with("audio/")
            || guessed_mimetype.starts_with("video/");

        let unit_number = extract_unit_number(&entry_name);
        if let Some(u) = unit_number {
            unit_set.insert(u);
        }

        all_entries.push(ZipEntryData {
            entry_name,
            safe_filename,
            content,
            unit_number,
            guessed_mimetype,
            is_audio_video,
            is_flv,
        });
    }

    // ZipArchive usa tipos no-Send; se libera antes de cualquier await posterior.
    drop(archive);

    // ── Phase 1b: calculate split midpoint (intensive → 2 regular courses) ───
    // For 8-10 units: first half → regular 1, second half → regular 2.
    // Mid is the last unit number that goes to regular 1 (ceiling of N/2).
    let split_midpoint: Option<i32> = if split_to_regular
        && sam_course_id_r1.is_some()
        && sam_course_id_r2.is_some()
        && !unit_set.is_empty()
    {
        let units: Vec<i32> = unit_set.iter().cloned().collect();
        let mid_idx = (units.len() + 1) / 2; // ceiling: 8 → 4, 9 → 5, 10 → 5
        Some(units[mid_idx - 1])
    } else {
        None
    };

    // Sort: audio/video first so their asset IDs are known when text is ingested
    all_entries.sort_by_key(|e| if e.is_audio_video { 0usize } else { 1 });

    // El modo DEV solo cambia endpoints de IA/procesamiento.
    // El almacenamiento de assets del ZIP siempre usa el S3 del proyecto.
    let s3_settings = get_s3_settings();
    let s3_client = if let Some(settings) = &s3_settings {
        Some(build_s3_client(settings).await?)
    } else {
        None
    };

    tokio::fs::create_dir_all("uploads")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // ── Phase 2: process entries ───────────────────────────────────────────────
    let mut imported_assets = 0usize;
    let mut rag_ingested_assets = 0usize;
    let mut rag_chunks_ingested = 0usize;
    let mut failed_entries: Vec<String> = Vec::new();
    let mut pending_rag_items: Vec<PendingZipRagItem> = Vec::new();

    // unit_number → (asset_id, public_url): populated from audio/video assets
    let mut unit_audio_map: HashMap<i32, (Uuid, String)> = HashMap::new();

    let ollama_url = if use_dev_processing {
        std::env::var("ZIP_DEV_OLLAMA_URL")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .or_else(|| std::env::var("DEV_OLLAMA_URL").ok().filter(|v| !v.trim().is_empty()))
            .unwrap_or_else(ai::get_ollama_url)
    } else {
        ai::get_ollama_url()
    };
    let whisper_url_override = if use_dev_processing {
        std::env::var("ZIP_DEV_WHISPER_URL")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .or_else(|| std::env::var("DEV_WHISPER_URL").ok().filter(|v| !v.trim().is_empty()))
    } else {
        None
    };
    let model = ai::get_embedding_model();

    if !ingest_rag {
        let org_id = org_ctx.id;
        let user_id = claims.sub;
        let concurrency = env::var("ZIP_IMPORT_CONCURRENCY")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .map(|v| v.clamp(1, 16))
            .unwrap_or(4);

        let mut join_set: JoinSet<Result<(), String>> = JoinSet::new();

        for entry in all_entries {
            while join_set.len() >= concurrency {
                match join_set.join_next().await {
                    Some(Ok(Ok(()))) => imported_assets += 1,
                    Some(Ok(Err(msg))) => failed_entries.push(msg),
                    Some(Err(e)) => failed_entries.push(format!("zip worker failed: {}", e)),
                    None => break,
                }
            }

            let pool_cl = pool.clone();
            let english_level_cl = english_level.clone();
            let s3_settings_cl = s3_settings.clone();
            let s3_client_cl = s3_client.clone();
            let source_zip_name_cl = source_zip_name.clone();

            join_set.spawn(async move {
                process_zip_entry_without_rag(
                    entry,
                    org_id,
                    user_id,
                    pool_cl,
                    zip_batch_id,
                    source_zip_name_cl,
                    course_id,
                    english_level_cl,
                    sam_plan_id,
                    sam_course_id,
                    split_midpoint,
                    sam_course_id_r1,
                    sam_course_id_r2,
                    s3_settings_cl,
                    s3_client_cl,
                    use_dev_processing,
                    false,
                )
                .await
            });
        }

        while let Some(result) = join_set.join_next().await {
            match result {
                Ok(Ok(())) => imported_assets += 1,
                Ok(Err(msg)) => failed_entries.push(msg),
                Err(e) => failed_entries.push(format!("zip worker failed: {}", e)),
            }
        }

        let _ = tokio::fs::remove_file(&zip_path).await;

        return Ok(Json(AssetZipImportResponse {
            imported_assets,
            rag_ingested_assets: 0,
            rag_chunks_ingested: 0,
            failed_entries,
            rag_background_started: false,
            rag_background_items: 0,
        }));
    }

    for entry in all_entries {
        let ZipEntryData {
            entry_name,
            safe_filename,
            content,
            unit_number,
            guessed_mimetype,
            is_audio_video,
            is_flv,
        } = entry;

        // Determine effective sam_course_id based on split midpoint
        let effective_sam_course_id = match (split_midpoint, unit_number) {
            (Some(mid), Some(u)) => {
                if u <= mid { sam_course_id_r1 } else { sam_course_id_r2 }
            }
            _ => sam_course_id,
        };

        let asset_id = Uuid::new_v4();

        let (storage_path, stored_filename, mimetype) = if is_flv {
            if use_dev_processing {
                let temp_storage_filename = format!("{}.flv", asset_id);
                let temp_storage_path = format!("uploads/tmp/{}", temp_storage_filename);
                tokio::fs::create_dir_all("uploads/tmp")
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error creating temp dir: {}", e)))?;
                if let Err(e) = tokio::fs::write(&temp_storage_path, &content).await {
                    failed_entries.push(format!("{}: local write failed ({})", entry_name, e));
                    continue;
                }

                let storage_path = build_ready_for_rag_path(org_ctx.id, asset_id, &format!("{}.mp4", asset_id));
                tokio::fs::create_dir_all(StdPath::new(&storage_path).parent().unwrap_or(StdPath::new(".")))
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error creating ready-for-rag dir: {}", e)))?;

                if let Err((_, msg)) = transcode_flv_to_mp4(&temp_storage_path, &storage_path).await {
                    let _ = tokio::fs::remove_file(&temp_storage_path).await;
                    failed_entries.push(format!("{}: flv transcode failed ({})", entry_name, msg));
                    continue;
                }
                let _ = tokio::fs::remove_file(&temp_storage_path).await;
                (
                    storage_path,
                    replace_extension(&safe_filename, "mp4"),
                    "video/mp4".to_string(),
                )
            } else {
                let temp_storage_filename = format!("{}.flv", asset_id);
                let temp_storage_path = format!("uploads/{}", temp_storage_filename);
                tokio::fs::write(&temp_storage_path, &content)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                let final_storage_filename = format!("{}.mp4", asset_id);
                let final_storage_path = format!("uploads/{}", final_storage_filename);
                if let Err((_, msg)) = transcode_flv_to_mp4(&temp_storage_path, &final_storage_path).await {
                    let _ = tokio::fs::remove_file(&temp_storage_path).await;
                    failed_entries.push(format!("{}: flv transcode failed ({})", entry_name, msg));
                    continue;
                }
                let _ = tokio::fs::remove_file(&temp_storage_path).await;

                (final_storage_path, replace_extension(&safe_filename, "mp4"), "video/mp4".to_string())
            }
        } else {
            if use_dev_processing {
                let storage_path = build_ready_for_rag_path(org_ctx.id, asset_id, &safe_filename);
                tokio::fs::create_dir_all(StdPath::new(&storage_path).parent().unwrap_or(StdPath::new(".")))
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error creating ready-for-rag dir: {}", e)))?;
                if let Err(e) = tokio::fs::write(&storage_path, &content).await {
                    failed_entries.push(format!("{}: local write failed ({})", entry_name, e));
                    continue;
                }
                (storage_path, safe_filename.clone(), guessed_mimetype)
            } else {
                let extension = StdPath::new(&safe_filename)
                    .extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("");

                let storage_filename = if extension.is_empty() {
                    asset_id.to_string()
                } else {
                    format!("{}.{}", asset_id, extension)
                };
                let storage_path = format!("uploads/{}", storage_filename);

                (storage_path, safe_filename.clone(), guessed_mimetype)
            }
        };

        let storage_filename_for_s3 = StdPath::new(&storage_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        let (db_storage_path, asset_public_url) = if !storage_filename_for_s3.is_empty() {
            if let (Some(settings), Some(client)) = (s3_settings.as_ref(), s3_client.as_ref()) {
                let key = build_s3_object_key(org_ctx.id, course_id, &storage_filename_for_s3);
                let upload_bytes = if is_flv {
                    match tokio::fs::read(&storage_path).await {
                        Ok(bytes) => bytes,
                        Err(e) => {
                            failed_entries.push(format!("{}: local read failed ({})", entry_name, e));
                            let _ = tokio::fs::remove_file(&storage_path).await;
                            continue;
                        }
                    }
                } else {
                    content.clone()
                };

                match push_bytes_to_s3(client, settings, &key, &mimetype, upload_bytes).await {
                    Ok((s3_path, public_url)) => {
                        cleanup_local_temp_file(&storage_path).await;
                        (s3_path, public_url)
                    }
                    Err((_, msg)) => {
                        cleanup_local_temp_file(&storage_path).await;
                        failed_entries.push(format!("{}: s3 upload failed ({})", entry_name, msg));
                        continue;
                    }
                }
            } else {
                if !is_flv {
                    if let Err(e) = tokio::fs::write(&storage_path, &content).await {
                        failed_entries.push(format!("{}: local write failed ({})", entry_name, e));
                        continue;
                    }
                }

                (
                    storage_path.clone(),
                    format!("/assets/{}", storage_filename_for_s3),
                )
            }
        } else {
            (storage_path.clone(), storage_path.clone())
        };

        let persisted_size = if db_storage_path == storage_path {
            tokio::fs::metadata(&storage_path)
                .await
                .map(|m| m.len() as i64)
                .unwrap_or(content.len() as i64)
        } else {
            content.len() as i64
        };

        let insert_result = sqlx::query(
            r#"
            INSERT INTO assets (id, organization_id, uploaded_by, zip_batch_id, source_zip_name, course_id, english_level, sam_plan_id, sam_course_id, unit_number, filename, storage_path, mimetype, size_bytes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            "#,
        )
        .bind(asset_id)
        .bind(org_ctx.id)
        .bind(claims.sub)
        .bind(zip_batch_id)
        .bind(&source_zip_name)
        .bind(course_id)
        .bind(&english_level)
        .bind(sam_plan_id)
        .bind(effective_sam_course_id)
        .bind(unit_number)
        .bind(&stored_filename)
        .bind(&db_storage_path)
        .bind(&mimetype)
        .bind(persisted_size)
        .execute(&pool)
        .await;

        if let Err(e) = insert_result {
            failed_entries.push(format!("{}: db insert failed ({})", entry_name, e));
            continue;
        }

        imported_assets += 1;

        // Track audio/video asset per unit for cross-linking with text RAG chunks
        if is_audio_video {
            if let Some(u) = unit_number {
                unit_audio_map.entry(u).or_insert((asset_id, asset_public_url.clone()));
            }
        }

        if ingest_rag {
            let asset = Asset {
                id: asset_id,
                organization_id: org_ctx.id,
                uploaded_by: Some(claims.sub),
                course_id,
                english_level: english_level.clone(),
                sam_plan_id,
                sam_course_id: effective_sam_course_id,
                unit_number,
                zip_batch_id: Some(zip_batch_id),
                source_zip_name: Some(source_zip_name.clone()),
                filename: stored_filename.clone(),
                storage_path: db_storage_path.clone(),
                mimetype: mimetype.clone(),
                size_bytes: persisted_size,
                created_at: chrono::Utc::now(),
            };

            pending_rag_items.push(PendingZipRagItem {
                entry_name,
                asset,
                is_audio_video,
                unit_number,
            });
        }
    }

    let mut rag_background_started = false;
    let mut rag_background_items = 0usize;

    if ingest_rag && !pending_rag_items.is_empty() {
        let pool_bg = pool.clone();
        let org_id_bg = org_ctx.id;
        let user_id_bg = claims.sub;
        let ollama_url_bg = ollama_url.clone();
        let whisper_url_bg = whisper_url_override.clone();
        let model_bg = model.clone();
        let unit_audio_map_bg = unit_audio_map.clone();
        let queued_count = pending_rag_items.len();
        let task_id = match create_zip_rag_background_task(
            &pool,
            org_ctx.id,
            claims.sub,
            course_id,
            zip_batch_id,
            queued_count,
        )
        .await
        {
            Ok(id) => Some(id),
            Err(e) => {
                tracing::warn!("ZIP async RAG: no se pudo crear background task ({})", e);
                None
            }
        };
        let rag_concurrency = env::var("ZIP_RAG_CONCURRENCY")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .map(|v| v.clamp(1, 12))
            .unwrap_or(5);
        rag_background_started = true;
        rag_background_items = queued_count;

        tokio::spawn(async move {
            if let Some(tid) = task_id {
                let _ = set_zip_rag_task_status(&pool_bg, tid, "processing", 0, 0, 0, None).await;
            }

            let client = match reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .danger_accept_invalid_hostnames(true)
                .build()
            {
                Ok(c) => c,
                Err(e) => {
                    tracing::error!("ZIP async RAG: no se pudo crear cliente HTTP: {}", e);
                    return;
                }
            };

            let mut ingested_assets = 0usize;
            let mut ingested_chunks = 0usize;
            let mut processed_items = 0usize;
            let mut failed_items = 0usize;

            let mut pending_rag_items = pending_rag_items;
            let mut unit_audio_map_bg = unit_audio_map_bg;

            for item in pending_rag_items.iter_mut() {
                if !is_flv_media(&item.asset.filename, &item.asset.mimetype) {
                    continue;
                }

                match normalize_flv_asset_for_rag(&pool_bg, &mut item.asset).await {
                    Ok(()) => {
                        if item.is_audio_video {
                            if let Some(u) = item.unit_number {
                                unit_audio_map_bg.insert(
                                    u,
                                    (item.asset.id, build_public_url_from_storage_path(&item.asset.storage_path)),
                                );
                            }
                        }
                    }
                    Err((_, msg)) => {
                        tracing::warn!(
                            "ZIP async RAG: no se pudo normalizar FLV {} ({})",
                            item.entry_name,
                            msg
                        );
                    }
                }
            }

            let unit_audio_map_bg = Arc::new(unit_audio_map_bg);

            let mut join_set: JoinSet<(usize, usize, bool)> = JoinSet::new();

            for item in pending_rag_items {
                while join_set.len() >= rag_concurrency {
                    match join_set.join_next().await {
                        Some(Ok((assets_ok, chunks_ok, failed))) => {
                            ingested_assets += assets_ok;
                            ingested_chunks += chunks_ok;
                            processed_items += 1;
                            if failed {
                                failed_items += 1;
                            }
                            if let Some(tid) = task_id {
                                let progress = ((processed_items * 100) / queued_count.max(1)) as i32;
                                let _ = set_zip_rag_task_status(
                                    &pool_bg,
                                    tid,
                                    "processing",
                                    progress,
                                    processed_items,
                                    failed_items,
                                    None,
                                )
                                .await;
                            }
                        }
                        Some(Err(e)) => {
                            processed_items += 1;
                            failed_items += 1;
                            tracing::warn!("ZIP async RAG: worker fallo ({})", e);
                            if let Some(tid) = task_id {
                                let progress = ((processed_items * 100) / queued_count.max(1)) as i32;
                                let _ = set_zip_rag_task_status(
                                    &pool_bg,
                                    tid,
                                    "processing",
                                    progress,
                                    processed_items,
                                    failed_items,
                                    None,
                                )
                                .await;
                            }
                        }
                        None => break,
                    }
                }

                let pool_w = pool_bg.clone();
                let client_w = client.clone();
                let ollama_url_w = ollama_url_bg.clone();
                let whisper_url_w = whisper_url_bg.clone();
                let model_w = model_bg.clone();
                let audio_map_w = unit_audio_map_bg.clone();

                join_set.spawn(async move {
                    let source_kind = if item.is_audio_video {
                        "audio-transcription"
                    } else if item.asset.mimetype.contains("pdf") {
                        "pdf"
                    } else {
                        "text"
                    };

                    let skill = if item.is_audio_video {
                        Some("listening")
                    } else {
                        Some("reading")
                    };

                    let (linked_audio_id, linked_audio_url) = if !item.is_audio_video {
                        match item.unit_number.and_then(|u| audio_map_w.get(&u)) {
                            Some((aid, aurl)) => (Some(*aid), Some(aurl.clone())),
                            None => (None, None),
                        }
                    } else {
                        (None, None)
                    };

                    match extract_asset_text_with_endpoints(&item.asset, whisper_url_w.as_deref()).await {
                        Ok(extracted) => {
                            let trimmed = extracted.trim();
                            if trimmed.len() < 80 {
                                tracing::warn!(
                                    "ZIP async RAG: {} contenido insuficiente para RAG",
                                    item.entry_name
                                );
                                return (0, 0, true);
                            }

                            let chunks = chunk_text(trimmed, 900);
                            if chunks.is_empty() {
                                tracing::warn!(
                                    "ZIP async RAG: {} no genero chunks",
                                    item.entry_name
                                );
                                return (0, 0, true);
                            }

                            match ingest_chunks_to_question_bank(
                                &pool_w,
                                org_id_bg,
                                user_id_bg,
                                &item.asset,
                                source_kind,
                                skill,
                                &chunks,
                                &client_w,
                                &ollama_url_w,
                                &model_w,
                                linked_audio_id,
                                linked_audio_url,
                                item.unit_number,
                            )
                            .await
                            {
                                Ok(()) => (1, chunks.len(), false),
                                Err((_, msg)) => {
                                    tracing::warn!(
                                        "ZIP async RAG: {} ingest fallo ({})",
                                        item.entry_name,
                                        msg
                                    );
                                    (0, 0, true)
                                }
                            }
                        }
                        Err((_, msg)) => {
                            tracing::warn!(
                                "ZIP async RAG: {} extract fallo ({})",
                                item.entry_name,
                                msg
                            );
                            (0, 0, true)
                        }
                    }
                });
            }

            while let Some(result) = join_set.join_next().await {
                match result {
                    Ok((assets_ok, chunks_ok, failed)) => {
                        ingested_assets += assets_ok;
                        ingested_chunks += chunks_ok;
                        processed_items += 1;
                        if failed {
                            failed_items += 1;
                        }
                        if let Some(tid) = task_id {
                            let progress = ((processed_items * 100) / queued_count.max(1)) as i32;
                            let _ = set_zip_rag_task_status(
                                &pool_bg,
                                tid,
                                "processing",
                                progress,
                                processed_items,
                                failed_items,
                                None,
                            )
                            .await;
                        }
                    }
                    Err(e) => {
                        processed_items += 1;
                        failed_items += 1;
                        tracing::warn!("ZIP async RAG: worker fallo ({})", e);
                        if let Some(tid) = task_id {
                            let progress = ((processed_items * 100) / queued_count.max(1)) as i32;
                            let _ = set_zip_rag_task_status(
                                &pool_bg,
                                tid,
                                "processing",
                                progress,
                                processed_items,
                                failed_items,
                                None,
                            )
                            .await;
                        }
                    }
                }
            }

            if let Some(tid) = task_id {
                let final_status = if failed_items > 0 { "failed" } else { "completed" };
                let final_message = if failed_items > 0 {
                    Some("Uno o más archivos fallaron durante la extracción o la ingesta RAG")
                } else {
                    None
                };
                let _ = set_zip_rag_task_status(
                    &pool_bg,
                    tid,
                    final_status,
                    100,
                    queued_count,
                    failed_items,
                    final_message,
                )
                .await;
            }

            tracing::info!(
                "ZIP async RAG finalizado: {} assets, {} chunks (concurrency={})",
                ingested_assets,
                ingested_chunks,
                rag_concurrency
            );
        });

        failed_entries.push(format!(
            "Ingestion RAG iniciada en segundo plano para {} archivos. Puedes continuar usando el sistema mientras finaliza.",
            queued_count
        ));
        rag_ingested_assets = 0;
        rag_chunks_ingested = 0;
    }

    let _ = tokio::fs::remove_file(&zip_path).await;

    Ok(Json(AssetZipImportResponse {
        imported_assets,
        rag_ingested_assets,
        rag_chunks_ingested,
        failed_entries,
        rag_background_started,
        rag_background_items,
    }))
}

fn is_flv_media(filename: &str, mimetype: &str) -> bool {
    let lower_name = filename.to_lowercase();
    let lower_mt = mimetype.to_lowercase();
    lower_name.ends_with(".flv")
        || lower_mt == "video/x-flv"
        || lower_mt == "video/flv"
        || lower_mt.ends_with("/x-flv")
}

fn replace_extension(filename: &str, new_ext: &str) -> String {
    let base = StdPath::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    format!("{}.{}", base, new_ext)
}

fn replace_last_path_extension(path: &str, new_ext: &str) -> String {
    if let Some((prefix, last)) = path.rsplit_once('/') {
        return format!("{}/{}", prefix, replace_extension(last, new_ext));
    }
    replace_extension(path, new_ext)
}

fn build_public_url_from_storage_path(storage_path: &str) -> String {
    if let Some((bucket, key)) = parse_s3_storage_path(storage_path) {
        if let Some(settings) = get_s3_settings_for_bucket(bucket) {
            return build_s3_public_url(&settings, key);
        }
        return storage_path.to_string();
    }

    let storage_filename = StdPath::new(storage_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    format!("/assets/{}", storage_filename)
}

async fn normalize_flv_asset_for_rag(
    pool: &PgPool,
    asset: &mut Asset,
) -> Result<(), (StatusCode, String)> {
    if !is_flv_media(&asset.filename, &asset.mimetype) {
        return Ok(());
    }

    tokio::fs::create_dir_all("uploads/tmp")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error creating temp dir: {}", e)))?;

    let input_path = format!("uploads/tmp/flv-normalize-in-{}.flv", asset.id);
    let output_path = format!("uploads/tmp/flv-normalize-out-{}.mp4", asset.id);

    let source_bytes = read_storage_bytes(&asset.storage_path).await?;
    tokio::fs::write(&input_path, source_bytes)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error writing temp FLV: {}", e)))?;

    if let Err(e) = transcode_flv_to_mp4(&input_path, &output_path).await {
        let _ = tokio::fs::remove_file(&input_path).await;
        let _ = tokio::fs::remove_file(&output_path).await;
        return Err(e);
    }

    let _ = tokio::fs::remove_file(&input_path).await;

    let output_bytes = tokio::fs::read(&output_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error reading temp MP4: {}", e)))?;
    let _ = tokio::fs::remove_file(&output_path).await;

    let next_storage_path = replace_last_path_extension(&asset.storage_path, "mp4");
    if let Some((bucket, key)) = parse_s3_storage_path(&next_storage_path) {
        let settings = get_s3_settings_for_bucket(bucket).ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "S3 path detected but storage is not configured".to_string(),
        ))?;
        let client = build_s3_client(&settings).await?;
        let old_storage_path = asset.storage_path.clone();

        client
            .put_object()
            .bucket(bucket)
            .key(key)
            .content_type("video/mp4")
            .body(output_bytes.clone().into())
            .send()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Error uploading normalized MP4 to S3: {}", e)))?;

        if old_storage_path != next_storage_path {
            let _ = delete_storage_path(&old_storage_path).await;
        }
    } else {
        tokio::fs::write(&next_storage_path, &output_bytes)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error writing normalized MP4: {}", e)))?;

        if asset.storage_path != next_storage_path {
            let _ = tokio::fs::remove_file(&asset.storage_path).await;
        }
    }

    let next_filename = replace_extension(&asset.filename, "mp4");
    let next_size = output_bytes.len() as i64;

    sqlx::query(
        r#"
        UPDATE assets
        SET filename = $1,
            storage_path = $2,
            mimetype = $3,
            size_bytes = $4
        WHERE id = $5
        "#,
    )
    .bind(&next_filename)
    .bind(&next_storage_path)
    .bind("video/mp4")
    .bind(next_size)
    .bind(asset.id)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error updating normalized asset: {}", e)))?;

    asset.filename = next_filename;
    asset.storage_path = next_storage_path;
    asset.mimetype = "video/mp4".to_string();
    asset.size_bytes = next_size;

    Ok(())
}

async fn transcode_flv_to_mp4(input_path: &str, output_path: &str) -> Result<(), (StatusCode, String)> {
    let ffmpeg_threads = read_env_usize_with_bounds("ZIP_FFMPEG_THREADS", 1, 1, 8);

    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-threads")
        .arg(ffmpeg_threads.to_string())
        .arg("-i")
        .arg(input_path)
        .arg("-c:v")
        .arg("libx264")
        .arg("-c:a")
        .arg("aac")
        .arg("-movflags")
        .arg("+faststart")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("No se pudo convertir FLV a MP4 (ffmpeg no disponible): {}", e),
            )
        })?;

    if !output.status.success() {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Error convirtiendo FLV a MP4: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        ));
    }

    Ok(())
}

async fn ingest_chunks_to_question_bank(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    asset: &Asset,
    source_kind: &str,
    skill: Option<&str>,
    chunks: &[String],
    client: &reqwest::Client,
    ollama_url: &str,
    model: &str,
    source_asset_id: Option<Uuid>,
    audio_url: Option<String>,
    unit_number: Option<i32>,
) -> Result<(), (StatusCode, String)> {
    for (idx, chunk) in chunks.iter().enumerate() {
        let metadata = json!({
            "asset_id": asset.id,
            "asset_filename": asset.filename,
            "mimetype": asset.mimetype,
            "course_id": asset.course_id,
            "source_kind": source_kind,
            "chunk_index": idx + 1,
            "chunk_total": chunks.len(),
            "unit_number": unit_number,
        });

        let inserted_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO question_bank (
                organization_id,
                created_by,
                question_text,
                question_type,
                explanation,
                difficulty,
                skill_assessed,
                source,
                source_metadata,
                source_asset_id,
                audio_url,
                unit_number,
                is_active,
                is_archived
            )
            VALUES ($1, $2, $3, 'short-answer', $4, 'medium', $5, 'imported-material', $6, $7, $8, $9, true, false)
            RETURNING id
            "#,
        )
        .bind(org_id)
        .bind(user_id)
        .bind(chunk)
        .bind("RAG material chunk from uploaded asset")
        .bind(skill)
        .bind(&metadata)
        .bind(source_asset_id)
        .bind(&audio_url)
        .bind(unit_number)
        .fetch_one(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Insert failed: {}", e)))?;

        if let Ok(embedding_res) = generate_embedding(client, ollama_url, model, chunk).await {
            let pgvector = ai::embedding_to_pgvector(&embedding_res.embedding);
            let _ = sqlx::query(
                r#"
                UPDATE question_bank
                SET embedding = $1::vector,
                    embedding_updated_at = NOW()
                WHERE id = $2
                "#,
            )
            .bind(&pgvector)
            .bind(inserted_id)
            .execute(pool)
            .await;
        }
    }

    Ok(())
}

async fn extract_asset_text(asset: &Asset) -> Result<String, (StatusCode, String)> {
    extract_asset_text_with_endpoints(asset, None).await
}

async fn extract_asset_text_with_endpoints(
    asset: &Asset,
    whisper_url_override: Option<&str>,
) -> Result<String, (StatusCode, String)> {
    let lower_name = asset.filename.to_lowercase();
    let mimetype = asset.mimetype.to_lowercase();

    if mimetype.starts_with("audio/") || mimetype.starts_with("video/") {
        let bytes = read_storage_bytes(&asset.storage_path).await?;
        return transcribe_media_bytes_with_override(bytes, &asset.filename, whisper_url_override).await;
    }

    if mimetype.contains("pdf") || lower_name.ends_with(".pdf") {
        let bytes = read_storage_bytes(&asset.storage_path).await?;
        return extract_pdf_text_from_bytes(bytes).await;
    }

    if mimetype.starts_with("text/")
        || lower_name.ends_with(".txt")
        || lower_name.ends_with(".md")
        || lower_name.ends_with(".csv")
        || lower_name.ends_with(".json")
        || lower_name.ends_with(".log")
    {
        let bytes = read_storage_bytes(&asset.storage_path).await?;
        return Ok(String::from_utf8_lossy(&bytes).replace('\0', " "));
    }

    Err((
        StatusCode::BAD_REQUEST,
        "Formato no soportado para ingesta RAG. Usa PDF, TXT/MD/CSV/JSON o audio/video".to_string(),
    ))
}

async fn extract_pdf_text_from_bytes(bytes: Vec<u8>) -> Result<String, (StatusCode, String)> {
    let temp_name = format!("uploads/tmp-pdf-{}.pdf", Uuid::new_v4());
    tokio::fs::create_dir_all("uploads")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Create temp dir failed: {}", e)))?;
    tokio::fs::write(&temp_name, bytes)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Write temp pdf failed: {}", e)))?;

    let output = Command::new("pdftotext")
        .arg("-layout")
        .arg(&temp_name)
        .arg("-")
        .output()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!(
                    "No se pudo extraer texto del PDF (pdftotext no disponible o falló): {}",
                    e
                ),
            )
        })?;

    let _ = tokio::fs::remove_file(&temp_name).await;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err((
            StatusCode::BAD_REQUEST,
            format!("pdftotext devolvió error: {}", err),
        ));
    }

    let text = String::from_utf8_lossy(&output.stdout).replace('\0', " ");
    Ok(text)
}

async fn transcribe_media_bytes_with_override(
    file_data: Vec<u8>,
    filename: &str,
    whisper_url_override: Option<&str>,
) -> Result<String, (StatusCode, String)> {
    let mut whisper_urls: Vec<String> = Vec::new();
    if let Some(url) = whisper_url_override {
        let trimmed = url.trim();
        if !trimmed.is_empty() {
            whisper_urls.push(trimmed.trim_end_matches('/').to_string());
        }
    }
    if let Ok(url) = std::env::var("WHISPER_URL") {
        let trimmed = url.trim();
        if !trimmed.is_empty() {
            whisper_urls.push(trimmed.trim_end_matches('/').to_string());
        }
    }

    // Container-friendly fallbacks for common local deployments.
    if whisper_urls.is_empty() {
        whisper_urls.push("http://host.docker.internal:8000".to_string());
        whisper_urls.push("http://localhost:8000".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Whisper HTTP client error: {}", e)))?;

    let mut last_error = String::new();

    for base_url in whisper_urls {
        let form = reqwest::multipart::Form::new()
            .part(
                "file",
                reqwest::multipart::Part::bytes(file_data.clone()).file_name(filename.to_string()),
            )
            .text("model", "whisper-1")
            .text("response_format", "json");

        let endpoint = format!("{}/v1/audio/transcriptions", base_url);
        let response = match client.post(&endpoint).multipart(form).send().await {
            Ok(r) => r,
            Err(e) => {
                last_error = format!("{} ({})", endpoint, e);
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            last_error = format!("{} -> {}: {}", endpoint, status, body);
            continue;
        }

        let transcription: serde_json::Value = response
            .json()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Invalid Whisper response: {}", e)))?;

        let text = transcription
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        if text.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                "Whisper no pudo extraer texto del audio/video".to_string(),
            ));
        }

        return Ok(text);
    }

    Err((
        StatusCode::BAD_GATEWAY,
        format!(
            "Whisper request failed en todos los endpoints configurados. Ultimo error: {}",
            last_error
        ),
    ))
}

fn chunk_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();

    for word in text.split_whitespace() {
        if current.len() + word.len() + 1 > max_chars && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current.clear();
        }

        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
}
