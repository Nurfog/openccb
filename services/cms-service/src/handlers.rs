use crate::exporter;
use crate::handlers_exercise_settings::load_organization_exercise_settings;
use crate::webhooks::WebhookService;
pub mod tasks;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{StatusCode, HeaderValue},
    response::{IntoResponse, Response},
};
use aws_config::BehaviorVersion;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::{
    Client as S3Client,
    config::{Credentials, Region},
};
use bcrypt::{hash, verify};
use chrono::{DateTime, Utc};
pub use common::auth::Claims;
pub use common::middleware::Org;
use common::auth::{create_jwt, create_preview_token, auth_cookie_header};
use common::models::{
    AuthResponse, Course, CourseAnalytics, Lesson, Module, Organization, PublishedCourse,
    PublishedModule, User, UserResponse, CourseInstructor,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use base64::{engine::general_purpose, Engine as _};
use std::env;
use reqwest::header::HeaderMap;
use uuid::Uuid;

use openidconnect::core::{CoreClient, CoreProviderMetadata, CoreResponseType};
use openidconnect::reqwest::async_http_client;
use openidconnect::{
    AuthenticationFlow, AuthorizationCode, ClientId, ClientSecret, CsrfToken, IssuerUrl, Nonce,
    RedirectUrl, Scope, TokenResponse,
};

async fn is_org_exercise_enabled(
    pool: &PgPool,
    organization_id: Uuid,
    feature: &str,
) -> Result<bool, StatusCode> {
    let settings = load_organization_exercise_settings(pool, organization_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to load exercise settings for org {}: {}", organization_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(settings.is_enabled(feature))
}

#[derive(Deserialize)]
pub struct SSOCallbackParams {
    pub code: String,
    pub state: String,
}

#[derive(Deserialize)]
pub struct PublishPayload {
    pub target_organization_id: Option<Uuid>,
}

fn get_ai_url(var_base: &str, default: &str) -> String {
    let env = env::var("ENVIRONMENT").unwrap_or_else(|_| "prod".to_string());
    if env == "dev" {
        env::var(format!("DEV_{}", var_base))
            .or_else(|_| env::var(format!("LOCAL_{}", var_base)))
            .unwrap_or_else(|_| default.to_string())
    } else {
        env::var(format!("PROD_{}", var_base))
            .or_else(|_| env::var(format!("LOCAL_{}", var_base)))
            .unwrap_or_else(|_| default.to_string())
    }
}

/// Contador de tokens simple (aproximado: 1 token ≈ 4 caracteres en inglés)
fn count_tokens(text: &str) -> i32 {
    // Más preciso para inglés: dividir por espacios en blanco y contar palabras * 1.3
    // Para el español y otros idiomas, el conteo basado en caracteres es más fiable
    let char_count = text.len();
    // Estimación de OpenAI: ~4 caracteres por token
    ((char_count as f64) / 4.0).ceil() as i32
}

#[derive(Debug, Clone)]
struct HotspotS3Settings {
    region: String,
    endpoint: Option<String>,
    force_path_style: bool,
}

fn get_hotspot_s3_settings() -> Option<HotspotS3Settings> {
    let enabled = env::var("ASSETS_STORAGE")
        .unwrap_or_else(|_| "local".to_string())
        .to_lowercase();

    if enabled != "s3" {
        return None;
    }

    let region = env::var("S3_REGION").unwrap_or_else(|_| "us-east-2".to_string());
    let endpoint = env::var("S3_ENDPOINT").ok().filter(|v| !v.trim().is_empty());
    let force_path_style = env::var("S3_FORCE_PATH_STYLE")
        .map(|v| {
            let lower = v.to_lowercase();
            lower == "1" || lower == "true" || lower == "yes"
        })
        .unwrap_or(false);

    Some(HotspotS3Settings {
        region,
        endpoint,
        force_path_style,
    })
}

async fn build_hotspot_s3_client(settings: &HotspotS3Settings) -> Result<S3Client, StatusCode> {
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

fn parse_hotspot_s3_proxy_path(path: &str) -> Option<(String, String)> {
    let normalized = path.trim_start_matches('/');
    let remainder = normalized
        .strip_prefix("cms-api/api/assets/s3-proxy/")
        .or_else(|| normalized.strip_prefix("api/assets/s3-proxy/"))?;

    let mut parts = remainder.splitn(2, '/');
    let bucket = parts.next()?.trim();
    let key = parts.next()?.trim();
    if bucket.is_empty() || key.is_empty() {
        return None;
    }

    Some((bucket.to_string(), key.to_string()))
}

fn parse_hotspot_s3_uri(path: &str) -> Option<(String, String)> {
    let remainder = path.strip_prefix("s3://")?;
    let mut parts = remainder.splitn(2, '/');
    let bucket = parts.next()?.trim();
    let key = parts.next()?.trim();
    if bucket.is_empty() || key.is_empty() {
        return None;
    }

    Some((bucket.to_string(), key.to_string()))
}

async fn read_hotspot_s3_proxy_bytes(path: &str) -> Result<Option<(Vec<u8>, String)>, StatusCode> {
    let s3_ref = parse_hotspot_s3_proxy_path(path).or_else(|| parse_hotspot_s3_uri(path));
    let Some((bucket, key)) = s3_ref else {
        return Ok(None);
    };

    let Some(settings) = get_hotspot_s3_settings() else {
        tracing::warn!("Hotspot received S3 proxy path but ASSETS_STORAGE is not configured for S3: {}", path);
        return Err(StatusCode::NOT_FOUND);
    };

    let client = build_hotspot_s3_client(&settings).await?;
    let output = client
        .get_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to read hotspot image from S3 {}/{}: {}", bucket, key, e);
            StatusCode::BAD_GATEWAY
        })?;

    let bytes = output.body.collect().await.map_err(|e| {
        tracing::error!("Failed to collect hotspot image body from S3 {}/{}: {}", bucket, key, e);
        StatusCode::BAD_GATEWAY
    })?;

    let mime = mime_guess::from_path(&key)
        .first_or_octet_stream()
        .to_string();

    Ok(Some((bytes.into_bytes().to_vec(), mime)))
}

pub async fn publish_course(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload_params): Json<PublishPayload>,
) -> Result<StatusCode, StatusCode> {
    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    // 1. Obtener curso (El superadministrador puede publicar cualquier curso, otros solo los de su organización)
    let course = if is_super_admin {
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
    } else {
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
    }
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // Determinar la organización de destino
    let target_org_id = if is_super_admin && payload_params.target_organization_id.is_some() {
        payload_params.target_organization_id.unwrap()
    } else {
        course.organization_id
    };

    // 2. Obtener módulos
    let modules =
        sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
            .bind(id)
            .fetch_all(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut pub_modules = Vec::new();

    // 3. Obtener categorías de calificación
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. Obtener organización de destino
    let organization = sqlx::query_as::<_, common::models::Organization>(
        "SELECT * FROM organizations WHERE id = $1",
    )
    .bind(target_org_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. Obtener lecciones de cada módulo
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>(
            "SELECT * FROM lessons WHERE module_id = $1 ORDER BY position",
        )
        .bind(module.id)
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        pub_modules.push(PublishedModule { module, lessons });
    }

    // Sobrescribir el organization_id del curso en la carga útil si se publica en una organización diferente
    let mut course_for_pub = course.clone();
    course_for_pub.organization_id = target_org_id;

    // 5. Obtener equipo del curso
    let instructors = sqlx::query_as::<_, CourseInstructor>(
        "SELECT ci.*, u.email, u.full_name FROM course_instructors ci 
         JOIN users u ON ci.user_id = u.id 
         WHERE ci.course_id = $1"
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let payload = PublishedCourse {
        course: course_for_pub,
        organization,
        grading_categories,
        modules: pub_modules,
        instructors: Some(instructors),
        dependencies: None,
    };

    // 4. Enviar al LMS
    let lms_url =
        env::var("LMS_INTERNAL_URL").unwrap_or_else(|_| "http://experience:3002".to_string());
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/ingest", lms_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Error al contactar con el servicio LMS: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    if !res.status().is_success() {
        tracing::error!("La ingesta del LMS falló con estado: {}", res.status());
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    log_action(
        &pool,
        org_ctx.id,
        Uuid::new_v4(),
        "PUBLISH",
        "Course",
        id,
        json!({ "target_org": target_org_id }),
    )
    .await;

    // 5. Ejecutar webhook
    let webhook_service = WebhookService::new(pool.clone());
    webhook_service
        .dispatch(
            org_ctx.id,
            "course.published",
            &json!({
                "course_id": id,
                "title": payload.course.title,
                "pacing_mode": payload.course.pacing_mode,
                "target_org": target_org_id,
                "published_at": Utc::now()
            }),
        )
        .await;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct ModuleQuery {
    pub course_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct LessonQuery {
    pub module_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct GradingPayload {
    pub course_id: Uuid,
    pub name: String,
    pub weight: i32,
    pub drop_count: i32,
    pub tipo_nota_id: Option<i32>, // idTipoNota de la tabla tiponota
}

#[derive(Deserialize)]
pub struct QuizAIRequest {
    pub context: Option<String>,
    pub quiz_type: Option<String>,
}

#[derive(Deserialize)]
pub struct ReviewTextRequest {
    pub text: String,
}

pub async fn create_course(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Course>, StatusCode> {
    let title = payload
        .get("title")
        .and_then(|t| t.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let instructor_id = claims.sub;

    let pacing_mode = payload
        .get("pacing_mode")
        .and_then(|v| v.as_str())
        .unwrap_or("self_paced");

    let mut tx = pool.begin().await.map_err(|e| {
        tracing::error!("Error al iniciar la transacción: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Establecer el contexto de la sesión para que el disparador de la BD lo encuentre
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut *tx,
        Some(instructor_id),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|e| {
        tracing::error!("Error al establecer el contexto de la sesión: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
    let target_org_id = if is_super_admin {
        payload
            .get("organization_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or(org_ctx.id)
    } else {
        org_ctx.id
    };

    let price = payload
        .get("price")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    
    let currency = payload
        .get("currency")
        .and_then(|v| v.as_str())
        .unwrap_or("USD");

    let course = sqlx::query_as::<_, Course>("SELECT * FROM fn_create_course($1, $2, $3, $4, $5, $6)")
        .bind(target_org_id)
        .bind(instructor_id)
        .bind(title)
        .bind(pacing_mode)
        .bind(price)
        .bind(currency)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Error al crear el curso: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Error al confirmar la transacción: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(course))
}
pub async fn get_courses(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Course>>, StatusCode> {
    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    // Comprobar si el usuario es un estudiante de SAM
    let is_sam_student: bool = sqlx::query_scalar(
        "SELECT COALESCE(is_sam_student, false) FROM users WHERE id = $1"
    )
    .bind(claims.sub)
    .fetch_one(&pool)
    .await
    .unwrap_or(false);

    let courses: Vec<Course> = if is_super_admin {
        // El superadministrador ve todos los cursos
        sqlx::query_as::<_, Course>("SELECT * FROM courses")
            .fetch_all(&pool)
            .await
    } else if claims.role == "admin" || claims.role == "instructor" {
        // Los administradores e instructores ven todos los cursos de su organización
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE organization_id = $1")
            .bind(org_ctx.id)
            .fetch_all(&pool)
            .await
    } else if is_sam_student {
        // Los estudiantes de SAM solo ven los cursos en los que están matriculados a través de SAM
        sqlx::query_as::<_, Course>(
            "SELECT c.* FROM courses c
             INNER JOIN sam_course_assignments sca ON c.id = sca.course_id
             WHERE sca.sam_student_id = (SELECT sam_student_id FROM users WHERE id = $1)
             AND sca.is_active = TRUE
             AND c.organization_id = $2"
        )
        .bind(claims.sub)
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
    } else {
        // Los estudiantes que no son de SAM no ven NINGÚN curso (lista vacía)
        return Ok(Json(Vec::new()));
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(courses))
}

pub async fn update_course(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Course>, (StatusCode, String)> {
    let existing =
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| (StatusCode::NOT_FOUND, "Curso no encontrado".into()))?;

    if claims.role != "admin" && existing.instructor_id != claims.sub {
        return Err((StatusCode::FORBIDDEN, "No autorizado".into()));
    }

    let title = payload
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or(&existing.title);
    let description = payload
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or(existing.description.as_deref().unwrap_or(""));
    let passing_percentage = payload
        .get("passing_percentage")
        .and_then(|v| v.as_i64())
        .unwrap_or(existing.passing_percentage as i64) as i32;

    let certificate_template = payload
        .get("certificate_template")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or(existing.certificate_template);

    let pacing_mode = payload
        .get("pacing_mode")
        .and_then(|v| v.as_str())
        .unwrap_or(&existing.pacing_mode);

    let start_date = payload
        .get("start_date")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .or(existing.start_date);

    let end_date = payload
        .get("end_date")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .or(existing.end_date);

    let price = payload
        .get("price")
        .and_then(|v| v.as_f64())
        .unwrap_or(existing.price);

    let currency = payload
        .get("currency")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or(existing.currency);

    let marketing_metadata = payload
        .get("marketing_metadata")
        .cloned()
        .or(existing.marketing_metadata);

    let course_image_url = payload
        .get("course_image_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or(existing.course_image_url);

    // BEGIN TRANSACTION
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Establecer contexto de auditoría
    sqlx::query(
        "SELECT set_config('app.current_user_id', $1, true), set_config('app.org_id', $2, true)",
    )
    .bind(claims.sub.to_string())
    .bind(org_ctx.id.to_string())
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let course = sqlx::query_as::<_, Course>(
        "SELECT * FROM fn_update_course($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
    )
    .bind(id)
    .bind(org_ctx.id)
    .bind(title)
    .bind(description)
    .bind(passing_percentage)
    .bind(pacing_mode)
    .bind(start_date)
    .bind(end_date)
    .bind(certificate_template)
    .bind(price)
    .bind(currency)
    .bind(marketing_metadata)
    .bind(course_image_url)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to update course: {}", e),
        )
    })?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(course))
}

pub async fn create_module(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Module>, StatusCode> {
    let title = payload
        .get("title")
        .and_then(|t| t.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let course_id_str = payload
        .get("course_id")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let course_id = Uuid::parse_str(course_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let position = payload
        .get("position")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut *tx,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let module = sqlx::query_as::<_, Module>("SELECT * FROM fn_create_module($1, $2, $3, $4)")
        .bind(org_ctx.id)
        .bind(course_id)
        .bind(title)
        .bind(position)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Error al crear el módulo: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(module))
}

pub async fn create_lesson(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Lesson>, StatusCode> {
    let title = payload
        .get("title")
        .and_then(|t| t.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let module_id_str = payload
        .get("module_id")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let module_id = Uuid::parse_str(module_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let content_type = payload
        .get("content_type")
        .and_then(|t| t.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let content_url = payload.get("content_url").and_then(|v| v.as_str());
    let position = payload
        .get("position")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    let transcription = payload.get("transcription").cloned();
    let metadata = payload.get("metadata").cloned();

    let is_graded = payload
        .get("is_graded")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let grading_category_id = payload
        .get("grading_category_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let max_attempts = payload
        .get("max_attempts")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    let allow_retry = payload
        .get("allow_retry")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let due_date = payload
        .get("due_date")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DateTime<Utc>>().ok());

    let important_date_type = payload.get("important_date_type").and_then(|v| v.as_str());

    let is_previewable = payload
        .get("is_previewable")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut *tx,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let lesson = sqlx::query_as::<_, Lesson>(
        "SELECT * FROM fn_create_lesson($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)"
    )
    .bind(org_ctx.id)
    .bind(module_id)
    .bind(title)
    .bind(content_type)
    .bind(content_url)
    .bind(position)
    .bind(transcription)
    .bind(metadata)
    .bind(is_graded)
    .bind(grading_category_id)
    .bind(max_attempts)
    .bind(allow_retry)
    .bind(due_date)
    .bind(important_date_type)
    .bind(is_previewable)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Error al crear la lección: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Activar la autotranscripción si es una lección de vídeo o audio con una URL
    if (content_type == "video" || content_type == "audio") && content_url.is_some() {
        trigger_transcription(pool, lesson.id).await;
    }

    Ok(Json(lesson))
}

async fn trigger_transcription(pool: PgPool, lesson_id: Uuid) {
    // Establecer estado como en cola
    let _ = sqlx::query("UPDATE lessons SET transcription_status = 'queued' WHERE id = $1")
        .bind(lesson_id)
        .execute(&pool)
        .await;

    // Iniciar tarea en segundo plano
    tokio::spawn(async move {
        if let Err(e) = run_transcription_task(pool, lesson_id).await {
            tracing::error!("La tarea de autotranscripción falló para la lección {}: {}", lesson_id, e);
        }
    });
}

pub async fn process_transcription(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    tracing::info!("Recibida solicitud de transcripción para la lección: {}", id);
    // 1. Obtener lección
    let lesson =
        sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Error al obtener la lección: {}", e);
                StatusCode::NOT_FOUND
            })?;

    if lesson.content_type != "video" && lesson.content_type != "audio" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let url = lesson.content_url.ok_or(StatusCode::BAD_REQUEST)?;

    // 2. Validar que el medio sea accesible (assets locales o URL absoluta)
    if read_lesson_media_bytes(&url).await.is_err() {
        tracing::error!("Medio no accesible para transcripción: {}", url);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 3. Establecer estado como en cola
    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons SET transcription_status = 'queued' WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Error en la actualización de la base de datos (en cola): {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "TRANSCRIPTION_QUEUED",
        "Lesson",
        id,
        json!({ "status": "queued" }),
    )
    .await;

    // 4. Iniciar tarea en segundo plano
    let pool_clone = pool.clone();
    tokio::spawn(async move {
        if let Err(e) = run_transcription_task(pool_clone, id).await {
            tracing::error!("La tarea de transcripción falló para la lección {}: {}", id, e);
        }
    });

    Ok(Json(updated_lesson))
}

async fn translate_text(text: &str, target_lang: &str) -> Result<String, String> {
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url = get_ai_url("OLLAMA_URL", "http://localhost:11434");
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3".to_string());
        (
            format!("{}/v1/chat/completions", base_url),
            "".to_string(),
            model,
        )
    } else {
        let api_key = env::var("OPENAI_API_KEY").map_err(|_| "Missing OPENAI_API_KEY")?;
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", api_key),
            "gpt-4o".to_string(),
        )
    };

    let prompt = format!(
        "Translate the following transcription into {}. Maintain the same tone and context. Only return the translated text, nothing else.\n\nText: {}",
        if target_lang == "es" {
            "Spanish"
        } else {
            target_lang
        },
        text
    );

    let mut request = client.post(&url).json(&json!({
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.3
    }));

    if !auth_header.is_empty() {
        request = request.header("Authorization", auth_header);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Translation request failed: {}", e))?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("Translation API error: {}", err_body));
    }

    let gpt_data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Translation JSON parse failed: {}", e))?;

    let translated = gpt_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(translated)
}

pub async fn run_transcription_task(pool: PgPool, lesson_id: Uuid) -> Result<(), String> {
    // 1. Fetch lesson
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
        .bind(lesson_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Lesson fetch failed: {}", e))?;

    let url = lesson.content_url.ok_or("No content URL")?;

    // 2. Set status to processing ONLY if it's still queued (not cancelled/idle)
    tracing::info!("Starting transcription for lesson {} (media: {})", lesson_id, url);
    let rows_affected = sqlx::query("UPDATE lessons SET transcription_status = 'processing' WHERE id = $1 AND transcription_status = 'queued'")
        .bind(lesson_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Update to processing failed: {}", e))?
        .rows_affected();

    if rows_affected == 0 {
        tracing::info!("Transcription task {} was cancelled or is already processing. Aborting.", lesson_id);
        return Ok(());
    }

    // 3. Read file
    let filename_for_whisper = extract_filename_from_content_url(&url);
    let file_data = read_lesson_media_bytes(&url)
        .await
        .map_err(|e| {
            let err = format!("File read failed ({}): {}", url, e);
            tracing::error!("{}", err);
            err
        })?;
    
    tracing::info!("File read successfully ({} bytes). Sending to Whisper...", file_data.len());

    // 4. Send to Whisper
    let whisper_url = get_ai_url("WHISPER_URL", "http://localhost:8000");
    let client = reqwest::Client::new();
    
    // We assume a standard Whisper API (like faster-whisper-server or openai-compatible)
    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(file_data).file_name(filename_for_whisper))
        .text("model", "whisper-1")
        .text("response_format", "json");

    let response = client.post(format!("{}/v1/audio/transcriptions", whisper_url))
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            let err = format!("Whisper request failed: {}", e);
            tracing::error!("{}", err);
            err
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        let err = format!("Whisper API error: {} - {}", status, err_body);
        tracing::error!("{}", err);
        return Err(err);
    }

    let mut transcription_result: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Whisper response: {}", e))?;

    tracing::info!("Transcription received successfully for lesson {}", lesson_id);

    // 5. Bilingual translation with Ollama
    let text = transcription_result["text"].as_str().unwrap_or("").to_string();
    let detected_lang = transcription_result["language"].as_str().unwrap_or("es").to_string();

    // Ensure the detected language text is stored in its own key
    transcription_result[detected_lang.clone()] = serde_json::json!(text);

    let target_lang = if detected_lang == "es" { "en" } else { "es" };
    tracing::info!("Translating transcription from {} to {} using Ollama...", detected_lang, target_lang);
    
    // Note: Token usage for transcription is logged in the caller context
    // where we have access to user_id and org_id
    
    if !text.is_empty() {
        match translate_text(&text, target_lang).await {
            Ok(translated) => {
                tracing::info!("Translation to {} successful", target_lang);
                transcription_result[target_lang] = serde_json::json!(translated);
            },
            Err(e) => tracing::error!("Translation failed: {}", e),
        }
    }

    // 6. Update lesson with bilinguial transcription - ONLY if not cancelled (idle)
    sqlx::query("UPDATE lessons SET transcription = $1, transcription_status = 'completed' WHERE id = $2 AND transcription_status = 'processing'")
        .bind(&transcription_result)
        .bind(lesson_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update lesson with transcription: {}", e))?;

    // 6. Optional: Trigger Summarization using Ollama
    let full_text = transcription_result["text"].as_str().unwrap_or("");
    if !full_text.is_empty() {
        tracing::info!("Triggering AI summary for lesson {}", lesson_id);
        if let Ok((summary, _input_tokens, _output_tokens)) = generate_summary_with_ollama(full_text, lesson_id, &pool).await {
            tracing::info!("Summary generated successfully for lesson {}", lesson_id);
            let _ = sqlx::query("UPDATE lessons SET summary = $1 WHERE id = $2")
                .bind(summary)
                .bind(lesson_id)
                .execute(&pool)
                .await;
        }
    }

    Ok(())
}

async fn generate_summary_with_ollama(text: &str, lesson_id: Uuid, pool: &PgPool) -> Result<(String, i32, i32), String> {
    let base_url = get_ai_url("OLLAMA_URL", "http://localhost:11434");
    let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
    let client = reqwest::Client::new();

    let prompt = format!(
        "Resume el siguiente texto de forma concisa y estructurada en español:\n\n{}",
        text
    );

    let response = client.post(format!("{}/v1/chat/completions", base_url))
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.5
        }))
        .send()
        .await
        .map_err(|e| {
            let err = format!("Ollama summary request failed: {}", e);
            tracing::error!("{}", err);
            err
        })?;

    if !response.status().is_success() {
        return Err("Ollama summary API error".into());
    }

    let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let summary = result["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    // Calculate token usage
    let input_tokens = count_tokens(&prompt);
    let output_tokens = count_tokens(&summary);

    // Log token usage (use a system user ID for background tasks)
    let total_tokens = input_tokens + output_tokens;
    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(lesson_id)  // Use lesson_id as placeholder for user
        .bind(lesson_id)  // Use lesson_id as placeholder for org
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/lessons/transcribe")
        .bind(&model)
        .bind("summary")
        .bind(&json!({
            "lesson_id": lesson_id,
            "task": "auto-summary-from-transcription",
        }))
        .bind(&prompt)
        .bind(&summary)
        .execute(pool)
        .await;

    Ok((summary, input_tokens, output_tokens))
}

pub async fn get_lesson_vtt(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Query(params): Query<serde_json::Value>,
) -> Result<(axum::http::HeaderMap, String), StatusCode> {
    let lesson =
        sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    let lang = params.get("lang").and_then(|v| v.as_str()).unwrap_or("en");

    let transcription = lesson.transcription.ok_or(StatusCode::NOT_FOUND)?;
    let cues = transcription["cues"]
        .as_array()
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut vtt = String::from("WEBVTT\n\n");

    for (index, cue) in cues.iter().enumerate() {
        let start = cue["start"].as_f64().unwrap_or(0.0);
        let end = cue["end"].as_f64().unwrap_or(0.0);
        let text = if lang == "es" && !transcription["es"].as_str().unwrap_or("").is_empty() {
            // Simplified: in a real scenario we might want translated cues
            // For now, if we have a full translation we could try to split it,
            // but usually Whisper gives us segments.
            // If we only have English segments, we'll use them.
            cue["text"].as_str().unwrap_or("")
        } else {
            cue["text"].as_str().unwrap_or("")
        };

        vtt.push_str(&format!("{}\n", index + 1));
        vtt.push_str(&format!(
            "{} --> {}\n",
            format_vtt_timestamp(start),
            format_vtt_timestamp(end)
        ));
        vtt.push_str(&format!("{}\n\n", text.trim()));
    }

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        "text/vtt".parse().unwrap(),
    );

    Ok((headers, vtt))
}

fn format_vtt_timestamp(seconds: f64) -> String {
    let hours = (seconds / 3600.0).floor() as u32;
    let mins = ((seconds % 3600.0) / 60.0).floor() as u32;
    let secs = (seconds % 60.0).floor() as u32;
    let millis = ((seconds.fract() * 1000.0).round()) as u32;

    format!("{:02}:{:02}:{:02}.{:03}", hours, mins, secs, millis)
}

fn extract_filename_from_content_url(url: &str) -> String {
    url.rsplit('/')
        .next()
        .filter(|v| !v.is_empty())
        .unwrap_or("media.bin")
        .to_string()
}

async fn read_lesson_media_bytes(url: &str) -> Result<Vec<u8>, String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        let response = reqwest::Client::new()
            .get(url)
            .send()
            .await
            .map_err(|e| format!("HTTP read failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP read returned status {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("HTTP bytes read failed: {}", e))?;
        return Ok(bytes.to_vec());
    }

    let filename = url.trim_start_matches("/assets/");
    let file_path = format!("uploads/{}", filename);
    tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("Local read failed ({}): {}", file_path, e))
}

pub async fn summarize_lesson(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    tracing::info!("Received summarization request for lesson: {}", id);
    
    // Check token limit before proceeding (estimate 1500 tokens for summary)
    if let Err(_) = common::token_limits::check_ai_token_limit(&pool, claims.sub, 1500).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    // 1. Fetch lesson
    let lesson =
        sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    // Use lesson summary as content source, fallback to title
    let content_text = lesson
        .summary
        .as_ref()
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or_else(|| format!("Lesson: {}", lesson.title));

    if content_text.is_empty() {
        tracing::warn!("Cannot summarize lesson {}: No content available", id);
        return Err(StatusCode::BAD_REQUEST);
    }

    // 2. Configuration
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url =
            env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3".to_string());
        (
            format!("{}/v1/chat/completions", base_url),
            "".to_string(),
            model,
        )
    } else {
        let api_key = env::var("OPENAI_API_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", api_key),
            "gpt-4o".to_string(),
        )
    };

    let mut request = client
        .post(&url)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert English Teacher. Summarize the following lesson content. Focus on grammar, vocabulary, and key expressions. Provide the summary in English, but if the content is bilingual, ensure the summary reflects both languages. Keep it under 150 words."
                },
                {
                    "role": "user",
                    "content": content_text
                }
            ]
        }));

    if !auth_header.is_empty() {
        request = request.header("Authorization", auth_header);
    }

    let response = request.send().await.map_err(|e| {
        tracing::error!("Summarization request failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("Summarization API error: {}", err_body);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let gpt_data: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Summarization JSON parse failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let summary = gpt_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim();

    // Calculate and log token usage
    let system_prompt = "You are an expert English Teacher. Summarize the following lesson content.";
    let input_tokens = count_tokens(system_prompt) + count_tokens(&content_text);
    let output_tokens = count_tokens(summary);
    let total_tokens = input_tokens + output_tokens;

    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(claims.sub)
        .bind(org_ctx.id)
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/lessons/summarize")
        .bind(&model)
        .bind("summary")
        .bind(&json!({
            "lesson_id": id,
        }))
        .bind(&format!("{} - {}", system_prompt, content_text))  // prompt
        .bind(summary)  // response
        .execute(&pool)
        .await;

    // 3. Update lesson
    let updated_lesson =
        sqlx::query_as::<_, Lesson>("UPDATE lessons SET summary = $1 WHERE id = $2 RETURNING *")
            .bind(summary)
            .bind(id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "SUMMARY_GENERATED",
        "Lesson",
        id,
        json!({}),
    )
    .await;

    Ok(Json(updated_lesson))
}

pub async fn generate_quiz(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(quiz_req): Json<QuizAIRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    tracing::info!("Received quiz generation request for lesson: {}", id);
    
    // Check token limit before proceeding (estimate 2000 tokens for quiz)
    if let Err(_) = common::token_limits::check_ai_token_limit(&pool, claims.sub, 2000).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    // 1. Fetch lesson
    let lesson =
        sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    // Use lesson summary as content source, fallback to title
    let content_text = lesson
        .summary
        .as_ref()
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or_else(|| format!("Lesson: {}", lesson.title));

    if content_text.is_empty() {
        tracing::warn!(
            "Cannot generate quiz for lesson {}: No content available",
            id
        );
        return Err(StatusCode::BAD_REQUEST);
    }

    // 2. Configuration
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url = get_ai_url("OLLAMA_URL", "http://localhost:11434");
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3".to_string());
        (
            format!("{}/v1/chat/completions", base_url),
            "".to_string(),
            model,
        )
    } else {
        let api_key = env::var("OPENAI_API_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", api_key),
            "gpt-4o".to_string(),
        )
    };

    let mut system_prompt = if let Some(qtype) = &quiz_req.quiz_type {
        if qtype == "memory-match" {
            "You are an expert English Teacher. Generate a Memory Match game (Memory match concepts) based on the lesson content. Extract 6 important concepts or vocabulary terms and their corresponding definitions or translations. Return ONLY a JSON object with a field 'blocks' which is an array. The array must contain ONE block with this structure: { \"id\": \"string-uuid\", \"type\": \"memory-match\", \"title\": \"Memory Match: Concept Review\", \"pairs\": [ { \"id\": \"1\", \"left\": \"Concept 1\", \"right\": \"Definition/Match 1\" }, { \"id\": \"2\", \"left\": \"Concept 2\", \"right\": \"Definition/Match 2\" } ] }. Provide 6 pairs in total.".to_string()
        } else {
            "You are an expert English Teacher. Generate 3 questions based on the lesson content to test the student's understanding of English grammar, vocabulary, or comprehension. Instructions can be in Spanish or English. Return ONLY a JSON object with a field 'blocks' which is an array of content blocks. Each block in the array must follow this exact structure: { \"id\": \"string-uuid\", \"type\": \"quiz\", \"title\": \"Quiz: Concept Check\", \"quiz_data\": { \"questions\": [ { \"id\": \"q-string\", \"type\": \"multiple-choice\", \"question\": \"String\", \"options\": [\"Option 1\", \"Option 2\", \"Option 3\", \"Option 4\"], \"correct\": [0], \"explanation\": \"Explain why the answer is correct.\" } ] } }. Important: 'correct' MUST be an array of integers.".to_string()
        }
    } else {
        "You are an expert English Teacher. Generate 3 questions based on the lesson content to test the student's understanding of English grammar, vocabulary, or comprehension. Instructions can be in Spanish or English. Return ONLY a JSON object with a field 'blocks' which is an array of content blocks. Each block in the array must follow this exact structure: { \"id\": \"string-uuid\", \"type\": \"quiz\", \"title\": \"Quiz: Concept Check\", \"quiz_data\": { \"questions\": [ { \"id\": \"q-string\", \"type\": \"multiple-choice\", \"question\": \"String\", \"options\": [\"Option 1\", \"Option 2\", \"Option 3\", \"Option 4\"], \"correct\": [0], \"explanation\": \"Explain why the answer is correct.\" } ] } }. Important: 'correct' MUST be an array of integers.".to_string()
    };

    if let Some(ctx) = &quiz_req.context {
        if !ctx.is_empty() {
            system_prompt.push_str(&format!(" Additional Context: {}", ctx));
        }
    }

    if let Some(qtype) = &quiz_req.quiz_type {
        if !qtype.is_empty() && qtype != "memory-match" {
            system_prompt.push_str(&format!(" Question Type to use: {}. If the type is 'multiple-choice', follow the structure above. If it's something else, adapt the block 'type' (e.g., 'true-false') accordingly, but keep it within the 'blocks' array.", qtype));
        }
    }

    let mut request = client
        .post(&url)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": content_text
                }
            ],
            "response_format": { "type": "json_object" }
        }));

    if !auth_header.is_empty() {
        request = request.header("Authorization", auth_header);
    }

    let response = request.send().await.map_err(|e| {
        tracing::error!("Quiz generation request failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response_status = response.status();
    
    if !response_status.is_success() {
        tracing::error!("Quiz API error: {}", response_status);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    let response_json: serde_json::Value = response.json().await.unwrap_or_default();
    
    // Calculate token usage
    let input_tokens = count_tokens(&system_prompt) + count_tokens(&content_text);
    let output_tokens = count_tokens(&response_json.to_string());
    let total_tokens = input_tokens + output_tokens;

    // Log AI usage with prompt and response
    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(claims.sub)
        .bind(org_ctx.id)
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/lessons/generate-quiz")
        .bind(&model)
        .bind("quiz-generation")
        .bind(&json!({
            "lesson_id": id,
            "quiz_type": quiz_req.quiz_type,
        }))
        .bind(&system_prompt)  // prompt
        .bind(&response_json.to_string())  // response
        .execute(&pool)
        .await;

    let quiz_data: serde_json::Value = response_json;
    let quiz_json_str = quiz_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("{}");

    let mut quiz_data_parsed: serde_json::Value =
        serde_json::from_str(quiz_json_str).unwrap_or(json!({}));

    // Post-processing: Normalize questions to ensure frontend doesn't crash
    if let Some(blocks) = quiz_data_parsed.get_mut("blocks").and_then(|b| b.as_array_mut()) {
        for block in blocks {
            if block.get("type").and_then(|t| t.as_str()) == Some("quiz") {
                if let Some(questions) = block.get_mut("quiz_data").and_then(|qd| qd.get_mut("questions")).and_then(|q| q.as_array_mut()) {
                    for q in questions {
                        // Ensure options exists
                        if q.get("options").is_none() {
                            q["options"] = json!([]);
                        }
                        // Ensure correct exists and is an array (handle LLM returning correctAnswer as a number)
                        if q.get("correct").is_none() {
                            if let Some(ca) = q.get("correctAnswer").and_then(|ca| ca.as_i64()) {
                                q["correct"] = json!([ca]);
                            } else {
                                q["correct"] = json!([0]);
                            }
                        } else if q["correct"].is_number() {
                            // Convert single number to array
                            let num = q["correct"].as_i64().unwrap_or(0);
                            q["correct"] = json!([num]);
                        }
                    }
                }
            }
        }
    }

    // Ensure we return just the blocks array as the frontend expects
    let quiz_blocks = quiz_data_parsed
        .get("blocks")
        .cloned()
        .unwrap_or(json!([]));

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "QUIZ_GENERATED",
        "Lesson",
        id,
        json!({}),
    )
    .await;

    Ok(Json(quiz_blocks))
}

pub async fn get_lesson(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    // Join to ensure lesson belongs to the organization
    let lesson = sqlx::query_as::<_, Lesson>("SELECT l.* FROM lessons l JOIN modules m ON l.module_id = m.id JOIN courses c ON m.course_id = c.id WHERE l.id = $1 AND c.organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(lesson))
}

pub async fn update_lesson(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Lesson>, StatusCode> {
    let title = payload.get("title").and_then(|t| t.as_str());
    let content_type = payload.get("content_type").and_then(|t| t.as_str());
    let content_url = payload.get("content_url").and_then(|t| t.as_str());
    let position = payload
        .get("position")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    let is_graded = payload.get("is_graded").and_then(|v| v.as_bool());
    let max_attempts = payload
        .get("max_attempts")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    let allow_retry = payload.get("allow_retry").and_then(|v| v.as_bool());
    let metadata = payload.get("metadata").cloned();
    let important_date_type = payload.get("important_date_type").and_then(|v| v.as_str());
    let summary = payload.get("summary").and_then(|v| v.as_str());
    let is_previewable = payload.get("is_previewable").and_then(|v| v.as_bool());
    let content_blocks = payload.get("content_blocks").cloned();
    let transcription = payload.get("transcription").cloned();

    let clear_grading_category = payload
        .get("grading_category_id")
        .map(|v| v.is_null())
        .unwrap_or(false);
    let grading_category_id = payload
        .get("grading_category_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let clear_due_date = payload
        .get("due_date")
        .map(|v| v.is_null())
        .unwrap_or(false);
    let due_date = payload
        .get("due_date")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DateTime<Utc>>().ok());

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut *tx,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let lesson = sqlx::query_as::<_, Lesson>(
        "SELECT * FROM fn_update_lesson($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)"
    )
    .bind(id)
    .bind(org_ctx.id)
    .bind(title)
    .bind(content_type)
    .bind(content_url)
    .bind(content_blocks)
    .bind(transcription)
    .bind(metadata)
    .bind(is_graded)
    .bind(grading_category_id)
    .bind(max_attempts)
    .bind(allow_retry)
    .bind(position)
    .bind(due_date)
    .bind(important_date_type)
    .bind(summary)
    .bind(is_previewable)
    .bind(clear_due_date)
    .bind(clear_grading_category)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Update lesson failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Trigger auto-transcription if content URL was updated and it's a video/audio lesson
    if let Some(url) = content_url {
        if !url.is_empty() {
            let c_type = content_type.unwrap_or(lesson.content_type.as_str());
            if c_type == "video" || c_type == "audio" {
                trigger_transcription(pool, lesson.id).await;
            }
        }
    }

    Ok(Json(lesson))
}

// Grading Policies
pub async fn get_grading_categories(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<common::models::GradingCategory>>, (StatusCode, String)> {
    let categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1 AND course_id IN (SELECT id FROM courses WHERE organization_id = $2) ORDER BY created_at"
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(categories))
}

pub async fn create_grading_category(
    State(pool): State<PgPool>,
    Org(org_ctx): Org,
    Json(payload): Json<GradingPayload>,
) -> Result<Json<common::models::GradingCategory>, (StatusCode, String)> {
    let category = sqlx::query_as::<_, common::models::GradingCategory>(
        "INSERT INTO grading_categories (organization_id, course_id, name, weight, drop_count, tipo_nota_id) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *",
    )
    .bind(org_ctx.id)
    .bind(payload.course_id)
    .bind(payload.name)
    .bind(payload.weight)
    .bind(payload.drop_count)
    .bind(payload.tipo_nota_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(category))
}

// Tipo Nota (Assessment type catalog)
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct TipoNota {
    pub id_tipo_nota: i32,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub activo: i16,
}

pub async fn get_tipo_nota(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<TipoNota>>, StatusCode> {
    let tipos = sqlx::query_as::<_, TipoNota>(
        "SELECT * FROM tipo_nota WHERE activo = 1 ORDER BY id_tipo_nota"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tipos))
}

pub async fn delete_grading_category(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query("DELETE FROM grading_categories WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

pub async fn log_action(
    pool: &PgPool,
    organization_id: Uuid,
    user_id: Uuid,
    action: &str,
    entity_type: &str,
    entity_id: Uuid,
    changes: serde_json::Value,
) {
    let _ = sqlx::query(
        "INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, changes) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(user_id)
    .bind(organization_id)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(changes)
    .execute(pool)
    .await;
}

pub async fn get_course(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Course>, StatusCode> {
    let course =
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(course))
}

pub async fn get_modules(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(query): Query<ModuleQuery>,
) -> Result<Json<Vec<Module>>, StatusCode> {
    let modules = match query.course_id {
        Some(course_id) => {
            sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 AND course_id IN (SELECT id FROM courses WHERE organization_id = $2) ORDER BY position")
                .bind(course_id)
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
        }
        None => {
            sqlx::query_as::<_, Module>("SELECT m.* FROM modules m JOIN courses c ON m.course_id = c.id WHERE c.organization_id = $1 ORDER BY m.position")
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
        }
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(modules))
}

pub async fn get_lessons(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(query): Query<LessonQuery>,
) -> Result<Json<Vec<Lesson>>, StatusCode> {
    let lessons = match query.module_id {
        Some(module_id) => {
            sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE module_id = $1 AND module_id IN (SELECT m.id FROM modules m JOIN courses c ON m.course_id = c.id WHERE c.organization_id = $2) ORDER BY position")
                .bind(module_id)
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
        }
        None => {
            sqlx::query_as::<_, Lesson>("SELECT l.* FROM lessons l JOIN modules m ON l.module_id = m.id JOIN courses c ON m.course_id = c.id WHERE c.organization_id = $1 ORDER BY l.position")
                .bind(org_ctx.id)
                .fetch_all(&pool)
                .await
        }
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(lessons))
}

#[derive(Deserialize, Serialize)]
pub struct ReorderPayload {
    pub items: Vec<ReorderItem>,
}

#[derive(Deserialize, Serialize)]
pub struct ReorderItem {
    pub id: Uuid,
    pub position: i32,
}

pub async fn reorder_modules(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<ReorderPayload>,
) -> Result<StatusCode, StatusCode> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut *tx,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("CALL pr_reorder_modules($1, $2)")
        .bind(org_ctx.id)
        .bind(serde_json::to_value(&payload.items).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Reorder modules failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

pub async fn reorder_lessons(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<ReorderPayload>,
) -> Result<StatusCode, StatusCode> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut *tx,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("CALL pr_reorder_lessons($1, $2)")
        .bind(org_ctx.id)
        .bind(serde_json::to_value(&payload.items).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Reorder lessons failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

#[derive(Deserialize)]
pub struct GenerateMermaidPayload {
    #[allow(dead_code)]
    pub prompt_hint: Option<String>,
}

pub async fn generate_mermaid_diagram(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
    Json(payload): Json<GenerateMermaidPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    if !is_org_exercise_enabled(&pool, org_ctx.id, "mermaid")
        .await
        .map_err(|status| (status, "No se pudo validar la configuración de Mermaid".to_string()))?
    {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "La generación de diagramas Mermaid está desactivada para esta organización".to_string(),
        ));
    }

    tracing::info!("Generating Mermaid Diagram for lesson_id={}", lesson_id);

    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(lesson_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Lección no encontrada".into()))?;

    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "local".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://ollama:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
        (
            format!("{}/v1/chat/completions", base_url),
            "".to_string(),
            model,
        )
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4o".to_string(),
        )
    };

    let transcription_str = lesson.transcription.as_ref().and_then(|v| v.as_str());
    let summary_str = lesson.summary.as_deref();
    let lesson_context = transcription_str.or(summary_str).unwrap_or("Conceptos generales de la lección.");
    let user_hint = payload.prompt_hint.clone().unwrap_or_else(|| "Extrae los conceptos y flujos principales de la lección.".to_string());

    let system_prompt = format!(
        "Eres un experto arquitecto de información y especialista en diagramación usando Mermaid.js.\n\
         Tu tarea es generar el código de un diagrama Mermaid que resuma o conceptualice el siguiente contenido de la lección.\n\
         INSTRUCCIONES CRÍTICAS:\n\
         1. Genera SOLO código Mermaid válido.\n\
         2. NO uses bloques de código con markdown o backticks (```mermaid ... ```). Genera el texto en crudo directamente.\n\
         3. NO agregues introducciones, explicaciones, ni conclusiones.\n\
         4. NO saludes.\n\
         5. Si es aplicable, usa 'flowchart TD', 'mindmap', 'sequenceDiagram' o similares.\n\n\
         Contexto de la lección:\n{}\n\n\
         Instrucciones adicionales del usuario:\n{}",
         lesson_context, user_hint
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": "Genera el código Mermaid directamente." }
            ],
            "temperature": 0.3
        }))
        .send()
        .await
        .map_err(|e| {
            tracing::error!("LLM Request failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Error contacting AI provider".into())
        })?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("LLM Error response: {}", err_body);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "AI provider returned an error".into()));
    }

    let ai_data: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Failed to parse LLM JSON: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Error parsing AI response".into())
    })?;

    let ai_response = ai_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim();

    let cleaned_response = ai_response
        .strip_prefix("```mermaid\n").unwrap_or(ai_response)
        .strip_prefix("```\n").unwrap_or(ai_response)
        .strip_suffix("```").unwrap_or(ai_response).trim();

    let input_tokens = count_tokens(&system_prompt) + count_tokens("Genera el código Mermaid directamente.");
    let output_tokens = count_tokens(cleaned_response);
    let total_tokens = input_tokens + output_tokens;

    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(claims.sub)
        .bind(org_ctx.id)
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/lessons/generate-mermaid")
        .bind(&model)
        .bind("diagram-generation")
        .bind(&json!({
            "lesson_id": lesson_id,
            "hint": payload.prompt_hint,
        }))
        .bind(&system_prompt)
        .bind(cleaned_response)
        .execute(&pool)
        .await;

    Ok(Json(serde_json::json!({
        "mermaid_code": cleaned_response,
    })))
}

#[derive(Deserialize)]
pub struct GenerateCodeLabPayload {
    pub language: Option<String>,
    pub prompt_hint: Option<String>,
}

pub async fn generate_code_lab(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
    Json(payload): Json<GenerateCodeLabPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    if !is_org_exercise_enabled(&pool, org_ctx.id, "code-lab")
        .await
        .map_err(|status| (status, "No se pudo validar la configuración de Code Lab".to_string()))?
    {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "Code Lab está desactivado para esta organización".to_string(),
        ));
    }

    tracing::info!("Generating Code Lab for lesson_id={}", lesson_id);

    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(lesson_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Lección no encontrada".into()))?;

    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "local".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://ollama:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3.2:3b".to_string());
        (format!("{}/v1/chat/completions", base_url), "".to_string(), model)
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4o".to_string(),
        )
    };

    let transcription_str = lesson.transcription.as_ref().and_then(|v| v.as_str());
    let summary_str = lesson.summary.as_deref();
    let lesson_context = transcription_str.or(summary_str).unwrap_or("Conceptos generales de la lección.");
    let language = payload.language.unwrap_or_else(|| "python".to_string());
    let user_hint = payload.prompt_hint.unwrap_or_else(|| "Diseña un ejercicio práctico que refuerce los conceptos de la lección.".to_string());

    let system_prompt = format!(
        "Eres un experto pedagogo y programador especializado en crear ejercicios de código educativos.\n\
         Tu tarea es generar un ejercicio de programación en {} basado en el siguiente contenido de la lección.\n\
         INSTRUCCIONES CRÍTICAS:\n\
         1. Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin explicaciones, sin bloques markdown.\n\
         2. El JSON debe tener exactamente esta estructura:\n\
         {{\"title\": \"string\", \"instructions\": \"string\", \"initial_code\": \"string\", \"solution\": \"string\", \"test_cases\": [{{\"description\": \"string\", \"expected\": \"string\"}}]}}\n\
         3. El campo 'initial_code' debe ser un esqueleto con comentarios TODO para que el estudiante lo complete.\n\
         4. El campo 'solution' debe ser la solución completa.\n\
         5. El campo 'test_cases' debe contener 2-3 casos de prueba descriptivos.\n\
         6. Las instrucciones deben ser claras y pedagógicamente apropiadas.\n\n\
         Contexto de la lección:\n{}\n\n\
         Instrucciones adicionales:\n{}",
        language, lesson_context, user_hint
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": "Genera el ejercicio de código ahora." }
            ],
            "temperature": 0.4
        }))
        .send()
        .await
        .map_err(|e| {
            tracing::error!("LLM Request failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Error contacting AI provider".into())
        })?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("LLM Error response: {}", err_body);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "AI provider returned an error".into()));
    }

    let ai_data: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Failed to parse LLM JSON: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Error parsing AI response".into())
    })?;

    let ai_text = ai_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("{}")
        .trim();

    // Strip potential markdown code fences
    let cleaned = ai_text
        .strip_prefix("```json\n").unwrap_or(ai_text)
        .strip_prefix("```\n").unwrap_or(ai_text)
        .strip_suffix("```").unwrap_or(ai_text)
        .trim();

    let exercise: serde_json::Value = serde_json::from_str(cleaned).map_err(|e| {
        tracing::error!("Failed to parse exercise JSON from LLM: {} | raw: {}", e, cleaned);
        (StatusCode::INTERNAL_SERVER_ERROR, "AI returned invalid exercise JSON".into())
    })?;

    // Calculate and log token usage
    let full_prompt = format!("{} - {}", system_prompt, "Genera el ejercicio de código ahora.");
    let input_tokens = count_tokens(&system_prompt) + count_tokens("Genera el ejercicio de código ahora.");
    let output_tokens = count_tokens(cleaned);
    let total_tokens = input_tokens + output_tokens;

    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(_claims.sub)
        .bind(org_ctx.id)
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/lessons/generate-code-lab")
        .bind(&model)
        .bind("code-lab-generation")
        .bind(&json!({
            "lesson_id": lesson_id,
            "language": language,
        }))
        .bind(&full_prompt)  // prompt
        .bind(cleaned)  // response
        .execute(&pool)
        .await;

    Ok(Json(serde_json::json!({
        "language": language,
        "title": exercise["title"],
        "instructions": exercise["instructions"],
        "initial_code": exercise["initial_code"],
        "solution": exercise["solution"],
        "test_cases": exercise["test_cases"],
    })))
}

#[derive(Deserialize)]
pub struct GenerateHotspotsPayload {
    pub image_url: String,
    pub prompt_hint: Option<String>,
}

pub async fn generate_hotspots(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
    Json(payload): Json<GenerateHotspotsPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !is_org_exercise_enabled(&pool, org_ctx.id, "hotspot").await? {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Check token limit before proceeding (estimate 2000 tokens for hotspots)
    if let Err(_) = common::token_limits::check_ai_token_limit(&pool, claims.sub, 2000).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    
    // 1. Resolve image path
    // Accept common formats used by Studio:
    // - /assets/<key>
    // - /uploads/<key>
    // - assets/<key>
    // - uploads/<key>
    // - absolute URLs (we use only their path component)
    let raw_input = payload.image_url.trim();
    if raw_input.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let is_absolute_url = raw_input.starts_with("http://") || raw_input.starts_with("https://");
    let mut path_only = if is_absolute_url {
        match reqwest::Url::parse(raw_input) {
            Ok(url) => url.path().to_string(),
            Err(_) => raw_input.to_string(),
        }
    } else {
        raw_input.to_string()
    };

    if let Some((without_query, _)) = path_only.split_once('?') {
        path_only = without_query.to_string();
    }

    let mut storage_path = if let Some(rest) = path_only.strip_prefix("/assets/") {
        format!("uploads/{}", rest)
    } else if let Some(rest) = path_only.strip_prefix("assets/") {
        format!("uploads/{}", rest)
    } else if let Some(rest) = path_only.strip_prefix("/uploads/") {
        format!("uploads/{}", rest)
    } else if path_only.starts_with("uploads/") {
        path_only.clone()
    } else {
        let filename = path_only.split('/').last().unwrap_or_default();
        if filename.is_empty() {
            return Err(StatusCode::BAD_REQUEST);
        }
        format!("uploads/{}", filename)
    };

    storage_path = storage_path.replace('\\', "/");
    if storage_path.contains("..") {
        tracing::warn!("Invalid hotspot image path traversal attempt: {}", storage_path);
        return Err(StatusCode::BAD_REQUEST);
    }

    // 2. Read and encode image
    // Prefer direct HTTP fetch for absolute URLs (e.g. /api/assets/s3-proxy),
    // and fallback to local disk resolution for legacy /assets/* and uploads/* paths.
    let (image_data, mime_type) = if is_absolute_url {
        match reqwest::get(raw_input).await {
            Ok(response) if response.status().is_success() => {
                let content_type = response
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|h| h.to_str().ok())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| {
                        mime_guess::from_path(&path_only)
                            .first_or_octet_stream()
                            .to_string()
                    });

                let bytes = response.bytes().await.map_err(|e| {
                    tracing::error!("Failed to read hotspot image bytes from {}: {}", raw_input, e);
                    StatusCode::BAD_GATEWAY
                })?;

                (bytes.to_vec(), content_type)
            }
            Ok(response) => {
                tracing::warn!(
                    "Hotspot image URL {} returned non-success status {}. Falling back to local path {}",
                    raw_input,
                    response.status(),
                    storage_path
                );
                let bytes = tokio::fs::read(&storage_path).await.map_err(|e| {
                    tracing::error!("Failed to read image at {}: {}", storage_path, e);
                    StatusCode::NOT_FOUND
                })?;
                let mime = mime_guess::from_path(&storage_path).first_or_octet_stream().to_string();
                (bytes, mime)
            }
            Err(err) => {
                tracing::warn!(
                    "Hotspot image URL fetch failed for {}: {}. Falling back to local path {}",
                    raw_input,
                    err,
                    storage_path
                );
                let bytes = tokio::fs::read(&storage_path).await.map_err(|e| {
                    tracing::error!("Failed to read image at {}: {}", storage_path, e);
                    StatusCode::NOT_FOUND
                })?;
                let mime = mime_guess::from_path(&storage_path).first_or_octet_stream().to_string();
                (bytes, mime)
            }
        }
    } else if let Some((bytes, mime)) = read_hotspot_s3_proxy_bytes(&path_only).await? {
        (bytes, mime)
    } else {
        let bytes = tokio::fs::read(&storage_path).await.map_err(|e| {
            tracing::error!("Failed to read image at {}: {}", storage_path, e);
            StatusCode::NOT_FOUND
        })?;
        let mime = mime_guess::from_path(&storage_path).first_or_octet_stream().to_string();
        (bytes, mime)
    };

    let base64_image = general_purpose::STANDARD.encode(image_data);
    let image_url_data = format!("data:{};base64,{}", mime_type, base64_image);

    // 3. Fetch lesson context (optional but helpful for AI)
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(lesson_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // 4. Setup AI Request
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model, is_ollama) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llava:latest".to_string());
        (format!("{}/v1/chat/completions", base_url), "".to_string(), model, true)
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4o".to_string(),
            false,
        )
    };

    let system_prompt = "Eres un experto en análisis visual pedagógico. \
        Tu tarea es identificar los puntos de interés más importantes en la imagen proporcionada \
        que sean relevantes para una lección educativa. \
        \
        Para cada punto identificado, proporciona: \
        - Un nombre o etiqueta corta (label). \
        - Una descripción técnica o pedagógica de lo que es o su función. \
        - Coordenadas X e Y en porcentaje (0-100) respecto a la imagen. (x: 0 es izquierda, 100 es derecha; y: 0 es arriba, 100 es abajo). \
        \
        RESPONDE ÚNICAMENTE CON UN ARRAY JSON DE OBJETOS CON EL SIGUIENTE FORMATO: \
        [ \
          { \"label\": \"Nombre\", \"description\": \"Descripción\", \"x\": 50.5, \"y\": 20.0 } \
        ]";

    let user_prompt = format!(
        "Analiza esta imagen para la lección: {0}. {1}",
        lesson.title,
        payload.prompt_hint.as_deref().unwrap_or("Identifica los componentes técnicos o partes clave de la imagen.")
    );

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    if !auth_header.is_empty() {
        headers.insert("Authorization", auth_header.parse().unwrap());
    }

    let mut request_body = json!({
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    { "type": "text", "text": format!("{}\n\n{}", system_prompt, user_prompt) },
                    { "type": "image_url", "image_url": { "url": image_url_data } }
                ]
            }
        ],
        "response_format": { "type": "json_object" },
        "temperature": 0.2
    });

    // Ollama requires stream: false for non-streaming responses
    if is_ollama {
        request_body["stream"] = json!(false);
    }

    let response = client.post(&url)
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("AI request failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let ai_text = response.text().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Parse the raw response
    let ai_json: serde_json::Value = serde_json::from_str(&ai_text).map_err(|e| {
        tracing::error!("Failed to parse AI response: {}. Text: {}", e, ai_text);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Extract the content from the response
    // OpenAI format: { "choices": [ { "message": { "content": "..." } } ] }
    // Ollama format (v1 API): same as OpenAI
    let content = ai_json["choices"][0]["message"]["content"].as_str()
        .or_else(|| ai_json["message"]["content"].as_str()) // Fallback for direct Ollama format
        .ok_or_else(|| {
            tracing::error!("Unexpected AI response format: {:?}", ai_json);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Attempt to parse the content as JSON (it should be an array)
    let mut hotspots: serde_json::Value = if let Ok(parsed) = serde_json::from_str(content) {
        parsed
    } else {
        // Fallback: try to find the array in the text if AI wrapped it in markdown or something
        if let Some(start) = content.find('[') {
            if let Some(end) = content.rfind(']') {
                serde_json::from_str(&content[start..=end]).map_err(|e| {
                    tracing::error!("Failed to parse hotspots array: {}. Content: {}", e, content);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?
            } else {
                tracing::error!("No JSON array found in AI response: {}", content);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        } else {
            tracing::error!("AI response doesn't contain a JSON array: {}", content);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Handle case where AI returns an object with hotspots array inside
    // e.g., { "hotspots": [...] } or { "items": [...] }
    if !hotspots.is_array() && hotspots.is_object() {
        if let Some(obj) = hotspots.as_object() {
            // Try common keys where the array might be stored
            for key in ["hotspots", "items", "data", "results", "points"] {
                if let Some(val) = obj.get(key) {
                    if val.is_array() {
                        hotspots = val.clone();
                        tracing::info!("Extracted hotspots array from '{}'", key);
                        break;
                    }
                }
            }
        }
    }

    // Handle case where AI returns a single object instead of an array
    // e.g., { "label": "...", "x": 50, "y": 50 } instead of [{ "label": "...", "x": 50, "y": 50 }]
    if !hotspots.is_array() && hotspots.is_object() {
        tracing::info!("AI returned a single object, wrapping in array");
        hotspots = serde_json::Value::Array(vec![hotspots]);
    }

    // Ensure the result is an array
    if !hotspots.is_array() {
        tracing::error!("AI response is not an array: {:?}", hotspots);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Calculate and log token usage
    let full_prompt = format!("{} - {}", system_prompt, user_prompt);
    let input_tokens = count_tokens(&full_prompt) + 500; // Estimate for image tokens
    let output_tokens = count_tokens(&hotspots.to_string());
    let total_tokens = input_tokens + output_tokens;

    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(claims.sub)
        .bind(org_ctx.id)
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/lessons/generate-hotspots")
        .bind(&model)
        .bind("hotspots-generation")
        .bind(&json!({
            "lesson_id": lesson_id,
            "image_url": payload.image_url,
        }))
        .bind(&full_prompt)  // prompt
        .bind(&hotspots.to_string())  // response
        .execute(&pool)
        .await;

    Ok(Json(hotspots))
}

#[derive(Deserialize)]
pub struct GenerateRolePlayPayload {
    pub prompt_hint: Option<String>,
}

pub async fn generate_role_play(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
    Json(payload): Json<GenerateRolePlayPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !is_org_exercise_enabled(&pool, org_ctx.id, "role-playing").await? {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Check token limit before proceeding (estimate 2500 tokens for role-play)
    if let Err(_) = common::token_limits::check_ai_token_limit(&pool, claims.sub, 2500).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    
    // 1. Fetch lesson context
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(lesson_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let content_text = lesson.summary.as_ref()
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or_else(|| format!("Lesson: {}", lesson.title));

    // 2. Setup AI Request
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3:8b".to_string());
        (format!("{}/v1/chat/completions", base_url), "".to_string(), model)
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4o".to_string(),
        )
    };

    let system_prompt = "Eres un experto diseñador de instrucciones y pedagogía. \
        Tu tarea es crear un escenario de juego de rol interactivo basado en el contenido de la lección proporcionada. \
        El escenario debe permitir al estudiante practicar conceptos clave en un entorno realista. \
        \
        RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO CON EL SIGUIENTE FORMATTO: \
        { \
          \"title\": \"Título de la simulación\", \
          \"scenario\": \"Descripción detallada del entorno y la situación\", \
          \"ai_persona\": \"Quién es la IA y qué actitud debe tener\", \
          \"user_role\": \"Quién es el estudiante en esta situación\", \
          \"objectives\": \"Qué debe lograr el estudiante\", \
          \"initial_message\": \"El primer mensaje que la IA enviará para iniciar la conversación\" \
        } \
        \
        Asegúrate de que el escenario sea desafiante pero apropiado para el nivel del estudiante.";

    let user_prompt = format!(
        "Contenido de la lección: {0}\n\nSugerencia del usuario: {1}",
        content_text,
        payload.prompt_hint.as_deref().unwrap_or("Crea un escenario relevante para practicar los temas de la lección.")
    );

    let response = client.post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "response_format": { "type": "json_object" },
            "temperature": 0.7
        }))
        .send().await
        .map_err(|e| {
            tracing::error!("AI Role-Play generation request failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("AI API error: {}", err_body);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let ai_data: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Failed to parse AI response: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    let content = ai_data["choices"][0]["message"]["content"].as_str().ok_or_else(|| {
        tracing::error!("AI response missing content field");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    let parsed_json: serde_json::Value = serde_json::from_str(content).map_err(|e| {
        tracing::error!("Failed to parse content as JSON: {}. Content: {}", e, content);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Calculate and log token usage
    let full_prompt = format!("{} - {}", system_prompt, user_prompt);
    let input_tokens = count_tokens(&system_prompt) + count_tokens(&user_prompt);
    let output_tokens = count_tokens(content);
    let total_tokens = input_tokens + output_tokens;

    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(claims.sub)
        .bind(org_ctx.id)
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/lessons/generate-role-play")
        .bind(&model)
        .bind("role-play-generation")
        .bind(&json!({
            "lesson_id": lesson_id,
        }))
        .bind(&full_prompt)  // prompt
        .bind(content)  // response
        .execute(&pool)
        .await;

    Ok(Json(parsed_json))
}

#[derive(Deserialize)]
pub struct AuthPayload {
    pub email: String,
    pub password: String,
    pub full_name: Option<String>,
    pub role: Option<String>,
    pub organization_name: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct AdminCreateUserPayload {
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub role: String,
    pub organization_id: Option<Uuid>,
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Response, (StatusCode, String)> {
    if payload.email.trim().is_empty() || payload.password.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "El email y la contraseña son obligatorios".into(),
        ));
    }
    if payload.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, "La contraseña debe tener al menos 8 caracteres".into()));
    }

    let password_hash = hash(payload.password, 13)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hashing failed".into()))?;

    let full_name = payload.full_name.unwrap_or_else(|| {
        payload
            .email
            .split('@')
            .next()
            .unwrap_or("User")
            .to_string()
    });
    let role = payload.role.unwrap_or_else(|| "instructor".to_string());

    // Find or create organization based on email domain or use default
    let org_name = payload.organization_name.unwrap_or_default();

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM fn_register_user($1, $2, $3, $4, $5)")
        .bind(&payload.email)
        .bind(password_hash)
        .bind(full_name)
        .bind(&role)
        .bind(&org_name)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| {
            tracing::error!("Failed to create user: {}", e);
            (
                StatusCode::CONFLICT,
                format!("User already exists or DB error: {}", e),
            )
        })?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let token = create_jwt(user.id, user.organization_id, &user.role).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "JWT generation failed".into(),
        )
    })?;

    let auth_response = AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            organization_id: user.organization_id,
            xp: user.xp,
            level: user.level,
            avatar_url: user.avatar_url,
            bio: user.bio,
            language: user.language,
        },
        token: token.clone(),
    };

    let mut response = Json(auth_response).into_response();
    response.headers_mut().insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&auth_cookie_header(&token))
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Cookie error".into()))?,
    );
    Ok(response)
}

pub async fn admin_create_user(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<AdminCreateUserPayload>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".into()));
    }

    if !["admin", "instructor", "student"].contains(&payload.role.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Invalid role".into()));
    }

    let password_hash = hash(payload.password, 13)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hashing failed".into()))?;

    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    let target_org_id = if is_super_admin {
        payload.organization_id.unwrap_or(org_ctx.id)
    } else {
        org_ctx.id
    };

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name, role, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING *"
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(&payload.full_name)
    .bind(&payload.role)
    .bind(target_org_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create user: {}", e);
        (StatusCode::CONFLICT, "User already exists or DB error".into())
    })?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        organization_id: user.organization_id,
        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url,
        bio: user.bio,
        language: user.language,
    }))
}

pub async fn logout() -> Response {
    use common::auth::auth_cookie_clear_header;
    let mut response = axum::http::Response::builder()
        .status(StatusCode::OK)
        .body(axum::body::Body::empty())
        .unwrap();
    response.headers_mut().insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_static(auth_cookie_clear_header()),
    );
    response
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Response, (StatusCode, String)> {
    tracing::info!("Login attempt for email: {}", payload.email);

    let user = sqlx::query_as::<_, User>("SELECT * FROM fn_get_user_by_email($1)")
        .bind(&payload.email)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch user: {}", e);
            (StatusCode::UNAUTHORIZED, "Invalid credentials".into())
        })?;

    tracing::info!("User found: {}", user.email);

    let verify_result = verify(payload.password, &user.password_hash);
    match verify_result {
        Ok(valid) => {
            if !valid {
                tracing::warn!("Invalid password for user: {}", user.email);
                return Err((StatusCode::UNAUTHORIZED, "Credenciales inválidas".into()));
            }
        },
        Err(e) => {
            tracing::error!("Password verification failed: {}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, "Verification failed".into()));
        }
    }

    tracing::info!("Password verified for user: {}", user.email);

    let token = create_jwt(user.id, user.organization_id, &user.role).map_err(|e| {
        tracing::error!("JWT generation failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "JWT generation failed".into(),
        )
    })?;

    tracing::info!("Login successful for user: {}", user.email);

    let auth_response = AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            organization_id: user.organization_id,
            xp: user.xp,
            level: user.level,
            avatar_url: user.avatar_url,
            bio: user.bio,
            language: user.language,
        },
        token: token.clone(),
    };

    let mut response = Json(auth_response).into_response();
    response.headers_mut().insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&auth_cookie_header(&token))
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Cookie error".into()))?,
    );
    Ok(response)
}
pub async fn get_course_analytics(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<CourseAnalytics>, (StatusCode, String)> {
    // 1. Fetch Course to check ownership
    let course =
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| (StatusCode::NOT_FOUND, "Course not found".into()))?;

    // 2. Enforce RBAC
    if claims.role != "admin" && course.instructor_id != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "You do not have permission to view stats for a course you don't own".into(),
        ));
    }

    // 4. Fetch from LMS
    let client = reqwest::Client::new();
    let lms_url =
        env::var("LMS_INTERNAL_URL").unwrap_or_else(|_| "http://experience:3002".to_string());
    let res = client
        .get(format!("{}/courses/{}/analytics", lms_url, id))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    if !res.status().is_success() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch analytics from LMS".into(),
        ));
    }

    let analytics = res
        .json::<CourseAnalytics>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(analytics))
}

pub async fn get_advanced_analytics(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<common::models::AdvancedAnalytics>, (StatusCode, String)> {
    // 1. Fetch Course to check ownership
    let course =
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| (StatusCode::NOT_FOUND, "Course not found".into()))?;

    // 2. Enforce RBAC
    if claims.role != "admin" && course.instructor_id != claims.sub {
        return Err((
            StatusCode::FORBIDDEN,
            "You do not have permission to view stats for a course you don't own".into(),
        ));
    }

    // 4. Fetch from LMS
    let client = reqwest::Client::new();
    let lms_url =
        env::var("LMS_INTERNAL_URL").unwrap_or_else(|_| "http://experience:3002".to_string());
    let res = client
        .get(format!("{}/courses/{}/analytics/advanced", lms_url, id))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    if !res.status().is_success() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch advanced analytics from LMS".into(),
        ));
    }

    let analytics = res
        .json::<common::models::AdvancedAnalytics>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(analytics))
}

pub async fn get_lesson_heatmap(
    Org(org_ctx): Org,
    _claims: common::auth::Claims,
    State(_pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
) -> Result<Json<Vec<common::models::HeatmapPoint>>, (StatusCode, String)> {
    let client = reqwest::Client::new();
    let lms_url =
        env::var("LMS_INTERNAL_URL").unwrap_or_else(|_| "http://experience:3002".to_string());
    let res = client
        .get(format!("{}/lessons/{}/heatmap", lms_url, lesson_id))
        .header("X-Organization-Id", org_ctx.id.to_string())
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    if !res.status().is_success() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch heatmap from LMS".into(),
        ));
    }

    let heatmap = res
        .json::<Vec<common::models::HeatmapPoint>>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(heatmap))
}

#[derive(Deserialize)]
pub struct AuditQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn get_audit_logs(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Query(query): Query<AuditQuery>,
) -> Result<Json<Vec<common::models::AuditLogResponse>>, (StatusCode, String)> {
    // 1. RBAC check
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Only admins can view audit logs".into(),
        ));
    }

    // 2. Query (filtered by organization)
    let limit = query.limit.unwrap_or(50);
    let offset = (query.page.unwrap_or(1) - 1) * limit;

    let logs = sqlx::query_as::<_, common::models::AuditLogResponse>(
        r#"
        SELECT a.id, a.user_id, u.full_name as user_full_name, a.action, a.entity_type, a.entity_id, a.changes, a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.organization_id = $3
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2
        "#
    )
    .bind(limit)
    .bind(offset)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(logs))
}

pub async fn get_organization(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Organization>, StatusCode> {
    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(org))
}

/// GET /organization - Public endpoint (returns default organization)
#[allow(dead_code)]
pub async fn get_public_organization(
    State(pool): State<PgPool>,
) -> Result<Json<Organization>, StatusCode> {
    // Get the first/default organization
    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations ORDER BY created_at LIMIT 1")
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(org))
}

pub async fn get_me(
    claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Usuario no encontrado".to_string()))?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        organization_id: user.organization_id,
        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url,
        bio: user.bio,
        language: user.language,
    }))
}

// SSO Configuration Management
pub async fn get_sso_config(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Option<common::models::OrganizationSSOConfig>>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los administradores pueden ver la configuración de SSO".to_string(),
        ));
    }

    let config = sqlx::query_as::<_, common::models::OrganizationSSOConfig>(
        "SELECT * FROM organization_sso_configs WHERE organization_id = $1",
    )
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(config))
}

pub async fn update_sso_config(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<common::models::OrganizationSSOConfig>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los administradores pueden configurar SSO".to_string(),
        ));
    }

    let issuer_url = payload.get("issuer_url").and_then(|v| v.as_str()).ok_or((
        StatusCode::BAD_REQUEST,
        "issuer_url es requerido".to_string(),
    ))?;
    let client_id = payload.get("client_id").and_then(|v| v.as_str()).ok_or((
        StatusCode::BAD_REQUEST,
        "client_id es requerido".to_string(),
    ))?;
    let client_secret = payload
        .get("client_secret")
        .and_then(|v| v.as_str())
        .ok_or((
            StatusCode::BAD_REQUEST,
            "client_secret es requerido".to_string(),
        ))?;
    let enabled = payload
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let config = sqlx::query_as::<_, common::models::OrganizationSSOConfig>(
        "INSERT INTO organization_sso_configs (organization_id, issuer_url, client_id, client_secret, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (organization_id) DO UPDATE SET
            issuer_url = EXCLUDED.issuer_url,
            client_id = EXCLUDED.client_id,
            client_secret = EXCLUDED.client_secret,
            enabled = EXCLUDED.enabled,
            updated_at = NOW()
         RETURNING *"
    )
    .bind(org_ctx.id)
    .bind(issuer_url)
    .bind(client_id)
    .bind(client_secret)
    .bind(enabled)
    .fetch_all(&pool)
    .await;

    // We use fetch_all + next for slightly better error handling in this complex query
    let config = config
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .into_iter()
        .next()
        .ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update SSO config".to_string(),
        ))?;

    Ok(Json(config))
}

pub async fn sso_login_init(
    Path(org_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<axum::response::Redirect, (StatusCode, String)> {
    let config = sqlx::query_as::<_, common::models::OrganizationSSOConfig>(
        "SELECT * FROM organization_sso_configs WHERE organization_id = $1 AND enabled = TRUE",
    )
    .bind(org_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((
        StatusCode::NOT_FOUND,
        "SSO no configurado o deshabilitado para esta organización".to_string(),
    ))?;

    let issuer_url = IssuerUrl::new(config.issuer_url.clone()).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Invalid issuer URL: {}", e),
        )
    })?;

    let provider_metadata = CoreProviderMetadata::discover_async(issuer_url, async_http_client)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to discover OIDC provider: {}", e),
            )
        })?;

    let client = CoreClient::from_provider_metadata(
        provider_metadata,
        ClientId::new(config.client_id.clone()),
        Some(ClientSecret::new(config.client_secret.clone())),
    )
    .set_redirect_uri(
        RedirectUrl::new(format!(
            "{}/auth/sso/callback",
            env::var("CMS_API_URL").unwrap_or_else(|_| "http://localhost:3001".to_string())
        ))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
    );

    let (auth_url, csrf_token, nonce) = client
        .authorize_url(
            AuthenticationFlow::<CoreResponseType>::AuthorizationCode,
            CsrfToken::new_random,
            Nonce::new_random,
        )
        .add_scope(Scope::new("openid".to_string()))
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("profile".to_string()))
        .url();

    // Store state and nonce
    sqlx::query("INSERT INTO sso_states (state_token, organization_id, nonce) VALUES ($1, $2, $3)")
        .bind(csrf_token.secret())
        .bind(org_id)
        .bind(nonce.secret())
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(axum::response::Redirect::to(auth_url.as_str()))
}

pub async fn sso_callback(
    Query(params): Query<SSOCallbackParams>,
    State(pool): State<PgPool>,
) -> Result<axum::response::Redirect, (StatusCode, String)> {
    // 1. Verify state and get org_id/nonce
    let row: (Uuid, String) = sqlx::query_as(
        "DELETE FROM sso_states WHERE state_token = $1 RETURNING organization_id, nonce",
    )
    .bind(&params.state)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            "Invalid state or timeout".to_string(),
        )
    })?;

    let org_id = row.0;
    let nonce = Nonce::new(row.1);

    // 2. Fetch config
    let config = sqlx::query_as::<_, common::models::OrganizationSSOConfig>(
        "SELECT * FROM organization_sso_configs WHERE organization_id = $1",
    )
    .bind(org_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Exchange code for token
    let issuer_url = IssuerUrl::new(config.issuer_url.clone())
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let provider_metadata = CoreProviderMetadata::discover_async(issuer_url, async_http_client)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let client = CoreClient::from_provider_metadata(
        provider_metadata,
        ClientId::new(config.client_id),
        Some(ClientSecret::new(config.client_secret)),
    )
    .set_redirect_uri(
        RedirectUrl::new(format!(
            "{}/auth/sso/callback",
            env::var("CMS_API_URL").unwrap_or_else(|_| "http://localhost:3001".to_string())
        ))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
    );

    let token_response = client
        .exchange_code(AuthorizationCode::new(params.code))
        .request_async(async_http_client)
        .await
        .map_err(|e| {
            (
                StatusCode::UNAUTHORIZED,
                format!("Token exchange failed: {}", e),
            )
        })?;

    // 4. Extract user info from ID Token
    let id_token = token_response
        .id_token()
        .ok_or((StatusCode::UNAUTHORIZED, "Missing ID token".to_string()))?;
    let claims = id_token
        .claims(&client.id_token_verifier(), &nonce)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid ID token: {}", e)))?;

    let email = claims
        .email()
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Missing email in ID token".to_string(),
        ))?
        .to_string();
    let name = claims
        .name()
        .and_then(|n| n.get(None))
        .map(|n| n.to_string())
        .unwrap_or_else(|| email.split('@').next().unwrap_or("User").to_string());

    // 5. User Provisioning
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE organization_id = $1 AND lower(email) = lower($2)",
    )
    .bind(org_id)
    .bind(&email)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = match user {
        Some(u) => u,
        None => {
            // Create user
            sqlx::query_as::<_, User>(
                "INSERT INTO users (organization_id, email, password_hash, full_name, role)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *",
            )
            .bind(org_id)
            .bind(&email)
            .bind("SSO_MANAGED") // No password for SSO users
            .bind(&name)
            .bind("student") // Default role
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        }
    };

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 6. Generate JWT
    let token =
        common::auth::create_jwt(user.id, user.organization_id, &user.role).map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "JWT generation failed".to_string(),
            )
        })?;

    // Determine where to redirect based on user role
    let frontend_url = if user.role == "student" {
        env::var("EXPERIENCE_URL").unwrap_or_else(|_| "http://localhost:3003".to_string())
    } else {
        env::var("STUDIO_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
    };

    Ok(axum::response::Redirect::to(&format!(
        "{}/auth/callback?token={}",
        frontend_url, token
    )))
}

#[derive(Serialize)]
pub struct ModuleWithLessons {
    #[serde(flatten)]
    pub module: Module,
    pub lessons: Vec<Lesson>,
}

#[derive(Serialize)]
pub struct CourseWithOutline {
    #[serde(flatten)]
    pub course: Course,
    pub modules: Vec<ModuleWithLessons>,
}

pub async fn get_course_outline(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<CourseWithOutline>, StatusCode> {
    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    // 1. Fetch Course
    let course = if is_super_admin {
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
    } else {
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
    }
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Fetch Modules
    let modules =
        sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
            .bind(id)
            .fetch_all(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut modules_with_lessons = Vec::new();

    // 3. Fetch Lessons (This could be optimized with a single query, but N+1 is acceptable for course editor scale)
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>(
            "SELECT * FROM lessons WHERE module_id = $1 ORDER BY position",
        )
        .bind(module.id)
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        modules_with_lessons.push(ModuleWithLessons { module, lessons });
    }

    Ok(Json(CourseWithOutline {
        course,
        modules: modules_with_lessons,
    }))
}

pub async fn update_module(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Module>, StatusCode> {
    let title = payload.get("title").and_then(|t| t.as_str());
    let position = payload
        .get("position")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut *tx,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Fetch existing to handle COALESCE if not handled in function
    // For now, let's just use the function logic.
    // Wait, the DB function I wrote doesn't use COALESCE, it just sets values.
    // I should fix the DB function or handle COALESCE here.
    // Let's fix the DB function to use COALESCE for optional updates.

    let module = sqlx::query_as::<_, Module>("SELECT * FROM fn_update_module($1, $2, $3, $4)")
        .bind(id)
        .bind(org_ctx.id)
        .bind(title)
        .bind(position)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Update module failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(module))
}

pub async fn delete_module(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut conn = pool
        .acquire()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut conn,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let success = sqlx::query_scalar::<_, bool>("SELECT fn_delete_module($1, $2)")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|e| {
            tracing::error!("Delete module failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !success {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_lesson(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut conn = pool
        .acquire()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut conn,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let success = sqlx::query_scalar::<_, bool>("SELECT fn_delete_lesson($1, $2)")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|e| {
            tracing::error!("Delete lesson failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !success {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

// User Management
pub async fn get_all_users(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<UserResponse>>, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let users = sqlx::query_as::<_, UserResponse>(
        "SELECT id, email, full_name, role, organization_id, xp, level, avatar_url, bio, language FROM users WHERE organization_id = $1",
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch users: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(users))
}

pub async fn update_user(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    if claims.role != "admin" && claims.sub != id {
        return Err((StatusCode::FORBIDDEN, "Not authorized".into()));
    }

    let role = payload.get("role").and_then(|r| r.as_str());
    let full_name = payload.get("full_name").and_then(|f| f.as_str());
    let avatar_url = payload.get("avatar_url").and_then(|v| v.as_str());
    let bio = payload.get("bio").and_then(|v| v.as_str());
    let language = payload.get("language").and_then(|v| v.as_str());
    let organization_id = payload
        .get("organization_id")
        .and_then(|o| o.as_str())
        .and_then(|o| Uuid::parse_str(o).ok());
    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    let user = if is_super_admin {
        sqlx::query_as::<_, User>(
            "UPDATE users SET 
                role = COALESCE($1, role), 
                organization_id = COALESCE($2, organization_id), 
                full_name = COALESCE($3, full_name), 
                avatar_url = COALESCE($4, avatar_url), 
                bio = COALESCE($5, bio), 
                language = COALESCE($6, language) 
             WHERE id = $7 RETURNING *"
        )
        .bind(role)
        .bind(organization_id)
        .bind(full_name)
        .bind(avatar_url)
        .bind(bio)
        .bind(language)
        .bind(id)
        .fetch_one(&pool)
        .await
    } else {
        sqlx::query_as::<_, User>(
            "UPDATE users SET 
                role = COALESCE($1, role), 
                organization_id = COALESCE($2, organization_id), 
                full_name = COALESCE($3, full_name), 
                avatar_url = COALESCE($4, avatar_url), 
                bio = COALESCE($5, bio), 
                language = COALESCE($6, language) 
             WHERE id = $7 AND organization_id = $8 RETURNING *"
        )
        .bind(role)
        .bind(organization_id)
        .bind(full_name)
        .bind(avatar_url)
        .bind(bio)
        .bind(language)
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "UPDATE_USER",
        "User",
        id,
        payload,
    )
    .await;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        organization_id: user.organization_id,
        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url,
        bio: user.bio,
        language: user.language,
    }))
}

pub async fn delete_user(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Not authorized".into()));
    }
    // Prevent an admin from deleting themselves
    if claims.sub == id {
        return Err((StatusCode::BAD_REQUEST, "Cannot delete your own account".into()));
    }

    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    let result = if is_super_admin {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id)
            .execute(&pool)
            .await
    } else {
        sqlx::query("DELETE FROM users WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .execute(&pool)
            .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "User not found".into()));
    }

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "DELETE_USER",
        "User",
        id,
        serde_json::json!({}),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

// Organizations Management (Simplified for Single-Tenant)
// Multi-tenant organization management has been removed.
// The system now operates on a single default organization.

#[derive(serde::Deserialize)]
pub struct CreateWebhookPayload {
    pub url: String,
    pub events: Vec<String>,
    pub secret: Option<String>,
}

pub async fn get_webhooks(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<common::models::Webhook>>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".into()));
    }

    let webhooks = sqlx::query_as::<_, common::models::Webhook>(
        "SELECT * FROM webhooks WHERE organization_id = $1 ORDER BY created_at DESC",
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(webhooks))
}

pub async fn create_webhook(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateWebhookPayload>,
) -> Result<Json<common::models::Webhook>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".into()));
    }

    let webhook = sqlx::query_as::<_, common::models::Webhook>(
        r#"
        INSERT INTO webhooks (organization_id, url, events, secret)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(org_ctx.id)
    .bind(payload.url)
    .bind(payload.events)
    .bind(payload.secret)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "CREATE_WEBHOOK",
        "Webhook",
        webhook.id,
        serde_json::to_value(&webhook).unwrap(),
    )
    .await;

    Ok(Json(webhook))
}

pub async fn delete_webhook(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".into()));
    }

    let result = sqlx::query("DELETE FROM webhooks WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Webhook not found".into()));
    }

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "DELETE_WEBHOOK",
        "Webhook",
        id,
        serde_json::json!({}),
    )
    .await;

    Ok(StatusCode::OK)
}

// --- Course Portability ---

pub async fn export_course(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    // 1. Verify access (ensure course belongs to org)
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM courses WHERE id = $1 AND organization_id = $2)",
    )
    .bind(id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "DB Check failed".to_string(),
        )
    })?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Rúbrica no encontrada".to_string()));
    }

    // 2. Generate ZIP
    let zip_bytes = exporter::generate_course_zip(&pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Export failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    let filename = format!("course-{}.ccb", id);
    let disposition = format!("attachment; filename=\"{}\"", filename);

    axum::response::Response::builder()
        .header(axum::http::header::CONTENT_TYPE, "application/zip")
        .header(axum::http::header::CONTENT_DISPOSITION, disposition)
        .body(axum::body::Body::from(zip_bytes))
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response".to_string(),
            )
        })
}


#[axum::debug_handler]
pub async fn import_course(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<Course>, StatusCode> {
    // 1. Buffer the uploaded ZIP file
    let mut zip_data = Vec::new();
    while let Some(field) = multipart.next_field().await.map_err(|_| StatusCode::BAD_REQUEST)? {
        if field.name() == Some("file") {
            zip_data = field.bytes().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.to_vec();
            break;
        }
    }

    if zip_data.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 2. Open ZIP
    let reader = std::io::Cursor::new(zip_data);
    let mut archive = zip::ZipArchive::new(reader).map_err(|_| StatusCode::BAD_REQUEST)?;

    // 3. Process Assets & Prepare Remapping
    let mut asset_map = std::collections::HashMap::new(); // Old Filename -> New URL

    let len = archive.len();
    for i in 0..len {
        let (old_filename, content) = {
            let mut file = archive.by_index(i).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            if !file.name().starts_with("assets/") || !file.is_file() {
                continue;
            }
            let old_filename = file.name().trim_start_matches("assets/").to_string();
            
            // Read content
            let mut content = Vec::new();
            std::io::Read::read_to_end(&mut file, &mut content).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            (old_filename, content)
        }; // file is dropped here

        // Generate New ID and Path
        let new_id = Uuid::new_v4();
        let extension = std::path::Path::new(&old_filename).extension().and_then(|s| s.to_str()).unwrap_or("");
        let new_storage_filename = format!("{}.{}", new_id, extension);
        let new_storage_path = format!("uploads/{}", new_storage_filename);
        let new_url = format!("/assets/{}", new_storage_filename);

        // Write to Disk
        tokio::fs::create_dir_all("uploads").await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        tokio::fs::write(&new_storage_path, &content).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // Get mimetype (guess or simple)
        let mimetype = mime_guess::from_path(&old_filename).first_or_octet_stream().to_string();

        sqlx::query(
            "INSERT INTO assets (id, filename, storage_path, mimetype, size_bytes, organization_id, uploaded_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(new_id)
        .bind(&old_filename) 
        .bind(&new_storage_path)
        .bind(&mimetype)
        .bind(content.len() as i64)
        .bind(org_ctx.id)
        .bind(claims.sub)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        asset_map.insert(format!("/assets/{}", old_filename), new_url);
    }

    // 4. Read Course JSON and Remap
    let mut course_json_str = String::new();
    {
        let mut json_file = archive.by_name("course.json").map_err(|_| StatusCode::BAD_REQUEST)?;
        std::io::Read::read_to_string(&mut json_file, &mut course_json_str).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // Apply Replacements
    for (old_url, new_url) in &asset_map {
        course_json_str = course_json_str.replace(old_url, new_url);
    }

    let payload: exporter::CourseExport = serde_json::from_str(&course_json_str).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. Create Course
    let new_course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (
            organization_id, instructor_id, title, pacing_mode, description, 
            passing_percentage, certificate_template, start_date, end_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING *",
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(format!("{} (Importado)", payload.course.title))
    .bind(payload.course.pacing_mode)
    .bind(payload.course.description)
    .bind(payload.course.passing_percentage)
    .bind(payload.course.certificate_template)
    .bind(payload.course.start_date)
    .bind(payload.course.end_date)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create imported course: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 6. Import Grading Categories
    let mut cat_map = std::collections::HashMap::new();
    for old_cat in payload.grading_categories {
        let new_cat = sqlx::query_as::<_, common::models::GradingCategory>(
            "INSERT INTO grading_categories (organization_id, course_id, name, weight, drop_count) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *",
        )
        .bind(org_ctx.id)
        .bind(new_course.id)
        .bind(old_cat.name)
        .bind(old_cat.weight)
        .bind(old_cat.drop_count)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        cat_map.insert(old_cat.id, new_cat.id);
    }

    // 7. Import Modules & Lessons
    for module_data in payload.modules {
        let new_module = sqlx::query_as::<_, Module>(
            "INSERT INTO modules (course_id, organization_id, title, position) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *",
        )
        .bind(new_course.id)
        .bind(org_ctx.id)
        .bind(module_data.module.title)
        .bind(module_data.module.position)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        for lesson in module_data.lessons {
            let new_cat_id = lesson
                .grading_category_id
                .and_then(|id| cat_map.get(&id))
                .cloned();

            sqlx::query(
                "INSERT INTO lessons (
                    module_id, organization_id, title, content_type, 
                    content_url, position, is_graded, metadata, summary, 
                    transcription, grading_category_id, max_attempts
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
            )
            .bind(new_module.id)
            .bind(org_ctx.id)
            .bind(lesson.title)
            .bind(lesson.content_type)
            .bind(lesson.content_url)
            .bind(lesson.position)
            .bind(lesson.is_graded)
            .bind(lesson.metadata)
            .bind(lesson.summary)
            .bind(lesson.transcription)
            .bind(new_cat_id)
            .bind(lesson.max_attempts)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to import lesson: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "COURSE_IMPORTED",
        "Course",
        new_course.id,
        serde_json::json!({ "original_title": payload.course.title }),
    )
    .await;

    Ok(Json(new_course))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CourseTemplateSummary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub source_course_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCourseTemplatePayload {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApplyCourseTemplatePayload {
    pub title: Option<String>,
}

pub async fn list_course_templates(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<CourseTemplateSummary>>, StatusCode> {
    let templates = sqlx::query_as::<_, CourseTemplateSummary>(
        r#"
        SELECT id, name, description, source_course_id, created_at, updated_at
        FROM course_templates
        WHERE organization_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(templates))
}

pub async fn create_course_template_from_course(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
    Json(payload): Json<CreateCourseTemplatePayload>,
) -> Result<Json<CourseTemplateSummary>, StatusCode> {
    if claims.role != "admin" && claims.role != "instructor" {
        return Err(StatusCode::FORBIDDEN);
    }

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM courses WHERE id = $1 AND organization_id = $2)",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !exists {
        return Err(StatusCode::NOT_FOUND);
    }

    let data = exporter::get_course_data(&pool, course_id)
        .await
        .map_err(|e| {
            tracing::error!("Template export failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let template_data = serde_json::to_value(&data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let template = sqlx::query_as::<_, CourseTemplateSummary>(
        r#"
        INSERT INTO course_templates (
            organization_id, source_course_id, name, description, template_data, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, description, source_course_id, created_at, updated_at
        "#,
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .bind(payload.name)
    .bind(payload.description)
    .bind(template_data)
    .bind(claims.sub)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "COURSE_TEMPLATE_CREATED",
        "CourseTemplate",
        template.id,
        serde_json::json!({ "source_course_id": course_id }),
    )
    .await;

    Ok(Json(template))
}

pub async fn apply_course_template(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(template_id): Path<Uuid>,
    Json(payload): Json<ApplyCourseTemplatePayload>,
) -> Result<Json<Course>, StatusCode> {
    if claims.role != "admin" && claims.role != "instructor" {
        return Err(StatusCode::FORBIDDEN);
    }

    let template_data = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT template_data FROM course_templates WHERE id = $1 AND organization_id = $2",
    )
    .bind(template_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    let exported: exporter::CourseExport = serde_json::from_value(template_data)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let new_title = payload
        .title
        .unwrap_or_else(|| format!("{} (Desde plantilla)", exported.course.title));

    let new_course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (
            organization_id, instructor_id, title, pacing_mode, description,
            passing_percentage, certificate_template, start_date, end_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *",
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(new_title)
    .bind(exported.course.pacing_mode)
    .bind(exported.course.description)
    .bind(exported.course.passing_percentage)
    .bind(exported.course.certificate_template)
    .bind(exported.course.start_date)
    .bind(exported.course.end_date)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut cat_map = std::collections::HashMap::new();
    for old_cat in exported.grading_categories {
        let new_cat = sqlx::query_as::<_, common::models::GradingCategory>(
            "INSERT INTO grading_categories (organization_id, course_id, name, weight, drop_count)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(org_ctx.id)
        .bind(new_course.id)
        .bind(old_cat.name)
        .bind(old_cat.weight)
        .bind(old_cat.drop_count)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        cat_map.insert(old_cat.id, new_cat.id);
    }

    for module_data in exported.modules {
        let new_module = sqlx::query_as::<_, Module>(
            "INSERT INTO modules (course_id, organization_id, title, position)
             VALUES ($1, $2, $3, $4)
             RETURNING *",
        )
        .bind(new_course.id)
        .bind(org_ctx.id)
        .bind(module_data.module.title)
        .bind(module_data.module.position)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        for lesson in module_data.lessons {
            let new_cat_id = lesson
                .grading_category_id
                .and_then(|id| cat_map.get(&id))
                .cloned();

            sqlx::query(
                "INSERT INTO lessons (
                    module_id, organization_id, title, content_type,
                    content_url, position, is_graded, metadata, summary,
                    transcription, grading_category_id, max_attempts
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
            )
            .bind(new_module.id)
            .bind(org_ctx.id)
            .bind(lesson.title)
            .bind(lesson.content_type)
            .bind(lesson.content_url)
            .bind(lesson.position)
            .bind(lesson.is_graded)
            .bind(lesson.metadata)
            .bind(lesson.summary)
            .bind(lesson.transcription)
            .bind(new_cat_id)
            .bind(lesson.max_attempts)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "COURSE_TEMPLATE_APPLIED",
        "Course",
        new_course.id,
        serde_json::json!({ "template_id": template_id }),
    )
    .await;

    Ok(Json(new_course))
}

pub async fn delete_course_template(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(template_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if claims.role != "admin" && claims.role != "instructor" {
        return Err(StatusCode::FORBIDDEN);
    }

    let result = sqlx::query("DELETE FROM course_templates WHERE id = $1 AND organization_id = $2")
        .bind(template_id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn check_course_access(
    pool: &PgPool,
    course_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<bool, (StatusCode, String)> {
    if role == "admin" {
        return Ok(true);
    }

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM course_instructors WHERE course_id = $1 AND user_id = $2)"
    )
    .bind(course_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(exists)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CourseInstructorDetail {
    pub id: Uuid,
    pub course_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub email: String,
    pub full_name: String,
}

pub async fn get_course_team(
    Org(_org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<CourseInstructorDetail>>, (StatusCode, String)> {
    if !check_course_access(&pool, course_id, claims.sub, &claims.role).await? {
        return Err((StatusCode::FORBIDDEN, "No access to this course team".into()));
    }

    let team = sqlx::query_as::<_, CourseInstructorDetail>(
        r#"
        SELECT ci.id, ci.course_id, ci.user_id, ci.role, ci.created_at, u.email, u.full_name
        FROM course_instructors ci
        JOIN users u ON ci.user_id = u.id
        WHERE ci.course_id = $1
        "#
    )
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(team))
}

#[derive(Deserialize)]
pub struct AddTeamMemberPayload {
    pub email: String,
    pub role: String,
}

pub async fn add_team_member(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddTeamMemberPayload>,
) -> Result<Json<CourseInstructor>, (StatusCode, String)> {
    // Only primary instructors or admins can add members
    let is_authorized = if claims.role == "admin" {
        true
    } else {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM course_instructors WHERE course_id = $1 AND user_id = $2 AND role = 'primary')"
        )
        .bind(id)
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    };

    if !is_authorized {
        return Err((StatusCode::FORBIDDEN, "Only primary instructors can add team members".into()));
    }

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "User not found".into()))?;

    let instructor = sqlx::query_as::<_, CourseInstructor>(
        "INSERT INTO course_instructors (organization_id, course_id, user_id, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *, (SELECT email FROM users WHERE id = $3) as email, (SELECT full_name FROM users WHERE id = $3) as full_name"
    )
        .bind(org_ctx.id)
    .bind(id)
    .bind(user.id)
    .bind(&payload.role)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(instructor))
}

pub async fn remove_team_member(
    Org(_org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let is_authorized = if claims.role == "admin" {
        true
    } else {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM course_instructors WHERE course_id = $1 AND user_id = $2 AND role = 'primary')"
        )
        .bind(course_id)
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    };

    if !is_authorized && claims.sub != user_id {
        return Err((StatusCode::FORBIDDEN, "Unauthorized to remove this member".into()));
    }

    sqlx::query("DELETE FROM course_instructors WHERE course_id = $1 AND user_id = $2")
        .bind(course_id)
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_course_preview_token(
    Org(_org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Verify user has access to this course (must be an instructor/admin)
    if !check_course_access(&pool, id, claims.sub, &claims.role).await? {
        return Err((StatusCode::FORBIDDEN, "No access to this course preview".into()));
    }

    let token = create_preview_token(claims.sub, claims.org, id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "token": token })))
}

// --- AI Course Generation ---

#[derive(Deserialize)]
pub struct GenerateCoursePayload {
    pub prompt: String,
    pub target_organization_id: Option<Uuid>,
}

pub async fn generate_course(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<GenerateCoursePayload>,
) -> Result<Json<Course>, StatusCode> {
    tracing::info!(
        "Starting AI course generation for prompt: {}",
        payload.prompt
    );
    
    // Check token limit before proceeding (estimate 5000 tokens for course generation)
    if let Err(_) = common::token_limits::check_ai_token_limit(&pool, claims.sub, 5000).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // 1. Determine target org
    let target_org_id = payload.target_organization_id.unwrap_or(org_ctx.id);

    // 2. AI Setup
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url =
            env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3".to_string());
        (
            format!("{}/v1/chat/completions", base_url),
            "".to_string(),
            model,
        )
    } else {
        let api_key = env::var("OPENAI_API_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", api_key),
            "gpt-4o".to_string(),
        )
    };

    let system_prompt = r#"You are an expert English Teacher and curriculum designer. 
Generate an English language course in JSON. You can receive instructions in Spanish or English.
Structure:
{
  "title": "Course Title",
  "description": "Description (Include language level like A1, B2, etc.)",
  "modules": [
    {
      "title": "Module Title",
      "lessons": [
        { "title": "Lesson Title", "content_type": "text" }
      ]
    }
  ]
}
RULES:
1. content_type MUST be one of: text, video, quiz.
2. The tone should be that of a helpful English Teacher.
3. Return ONLY the JSON object."#;

    let mut request = client.post(&url).json(&json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": format!("Create a course about: {}", payload.prompt) }
        ],
        "response_format": { "type": "json_object" },
        "temperature": 0.1
    }));

    if !auth_header.is_empty() {
        request = request.header("Authorization", auth_header);
    }

    let response_result = request.send().await;

    let mut content_str = match response_result {
        Ok(response) if response.status().is_success() => {
            let llm_data: serde_json::Value = response.json().await.map_err(|e| {
                tracing::error!("Failed to parse LLM JSON response: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
            tracing::info!("LLM Response received successfully");
            llm_data["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("{}")
                .trim()
                .to_string()
        }
        Ok(response) => {
            let err_body = response.text().await.unwrap_or_default();
            tracing::error!("LLM API error (generating course): {}", err_body);
            tracing::warn!("Falling back to default course template.");
            r#"{
              "title": "Nueva Plantilla de Curso",
              "description": "El servidor de IA no respondió. Esta es una plantilla básica que puedes editar directamente.",
              "modules": [
                {
                  "title": "Módulo 1",
                  "lessons": [
                    { "title": "Lección 1", "content_type": "text" }
                  ]
                }
              ]
            }"#.to_string()
        }
        Err(e) => {
            tracing::error!("LLM request failed (generating course): {}", e);
            tracing::warn!("Falling back to default course template due to unreachable AI.");
            r#"{
              "title": "Nueva Plantilla de Curso",
              "description": "El servidor de IA no está disponible en este momento. Esta es una plantilla básica.",
              "modules": [
                {
                  "title": "Módulo 1",
                  "lessons": [
                    { "title": "Lección 1", "content_type": "text" }
                  ]
                }
              ]
            }"#.to_string()
        }
    };

    tracing::info!("Extracted content string (length: {})", content_str.len());

    // Clean markdown code blocks if present
    if content_str.starts_with("```") {
        content_str = content_str
            .lines()
            .filter(|line| !line.starts_with("```"))
            .collect::<Vec<_>>()
            .join("\n");
    }

    let result_json: serde_json::Value = serde_json::from_str(&content_str).map_err(|e| {
        tracing::error!("Failed to parse AI JSON: {}. Content: {}", e, content_str);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(
        "JSON parsed successfully. Title: {:?}",
        result_json["title"]
    );

    // 3. Database Transaction
    tracing::info!("Starting database transaction...");
    let mut tx = pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Transaction started");

    // Create Course
    let course_title = result_json["title"].as_str().unwrap_or("Untitled Course");
    let course_desc = result_json["description"].as_str();

    let course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (organization_id, instructor_id, title, description, pacing_mode) 
         VALUES ($1, $2, $3, $4, 'self_paced') 
         RETURNING *",
    )
    .bind(target_org_id)
    .bind(claims.sub)
    .bind(course_title)
    .bind(course_desc)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("DB Course creation failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Course created with ID: {}", course.id);

    // Create Modules and Lessons
    if let Some(modules) = result_json["modules"].as_array() {
        for (m_idx, m_val) in modules.iter().enumerate() {
            let m_title = m_val["title"].as_str().unwrap_or("Module");

            let module = sqlx::query_as::<_, Module>(
                "INSERT INTO modules (course_id, organization_id, title, position) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING *",
            )
            .bind(course.id)
            .bind(target_org_id)
            .bind(m_title)
            .bind((m_idx + 1) as i32)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("DB Module creation failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            tracing::info!("Module created: {}", m_title);

            if let Some(lessons) = m_val["lessons"].as_array() {
                for (l_idx, l_val) in lessons.iter().enumerate() {
                    let l_title = l_val["title"].as_str().unwrap_or("Lesson");
                    let l_type = l_val["content_type"].as_str().unwrap_or("text");

                    sqlx::query(
                        "INSERT INTO lessons (module_id, organization_id, title, content_type, position) 
                         VALUES ($1, $2, $3, $4, $5)"
                    )
                    .bind(module.id)
                    .bind(target_org_id)
                    .bind(l_title)
                    .bind(l_type)
                    .bind((l_idx + 1) as i32)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| {
                        tracing::error!("DB Lesson creation failed: {}", e);
                        StatusCode::INTERNAL_SERVER_ERROR
                    })?;

                    tracing::info!("Lesson created: {}", l_title);
                }
            }
        }
    }

    tracing::info!("Committing transaction...");
    tx.commit().await.map_err(|e| {
        tracing::error!("Transaction commit failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Transaction committed successfully");

    // Log AI usage for course generation
    let input_tokens = count_tokens(&system_prompt) + count_tokens(&payload.prompt);
    let output_tokens = count_tokens(&content_str);
    let total_tokens = input_tokens + output_tokens;
    
    let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
        .bind(claims.sub)
        .bind(target_org_id)
        .bind(total_tokens)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind("/courses/generate")
        .bind(&model)
        .bind("course-generation")
        .bind(&json!({ "prompt": payload.prompt, "course_title": course_title }))
        .bind(&format!("{} - {}", system_prompt, payload.prompt))  // prompt
        .bind(&content_str)  // response
        .execute(&pool)
        .await;

    log_action(
        &pool,
        target_org_id,
        claims.sub,
        "AI_COURSE_GENERATED",
        "Course",
        course.id,
        json!({ "prompt": payload.prompt, "tokens_used": total_tokens }),
    )
    .await;

    Ok(Json(course))
}

pub async fn delete_course(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let is_super_admin = claims.role == "admin"
        && claims.org == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    // 1. Check if course exists and belongs to org (or if requester is super admin)
    let course = if is_super_admin {
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
    } else {
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
    }
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Additional permission check for instructors
    if !is_super_admin && !check_course_access(&pool, course.id, claims.sub, &claims.role).await.map_err(|(status, _)| status)? {
        return Err(StatusCode::FORBIDDEN);
    }

    // 3. Delete course using DB function
    let mut conn = pool
        .acquire()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .map(|s| s.to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    crate::db_util::set_session_context(
        &mut conn,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let success = sqlx::query_scalar::<_, bool>("SELECT fn_delete_course($1, $2)")
        .bind(id)
        .bind(course.organization_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(|e| {
            tracing::error!("Delete course failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !success {
        return Err(StatusCode::NOT_FOUND);
    }

    log_action(
        &pool,
        org_ctx.id,
        claims.sub,
        "DELETE",
        "Course",
        id,
        json!({ "title": course.title }),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn review_text(
    _: Org,
    _claims: Claims,
    State(_pool): State<PgPool>,
    Json(payload): Json<ReviewTextRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if payload.text.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Configuration
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url =
            env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3".to_string());
        (
            format!("{}/v1/chat/completions", base_url),
            "".to_string(),
            model,
        )
    } else {
        let api_key = env::var("OPENAI_API_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", api_key),
            "gpt-4o".to_string(),
        )
    };

    let system_prompt = "You are an expert English Teacher and Editor. Analyze the following text and provide suggestions for improvement. Focus on: 1. Grammar and spelling. 2. Tone (should be professional yet encouraging). 3. Clarity and conciseness. 4. Better vocabulary choices. Return ONLY a JSON object with a field 'suggestion' containing the improved version of the text, and a field 'comments' which is a brief list of what was improved.";

    let mut request = client
        .post(&url)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": payload.text
                }
            ],
            "response_format": { "type": "json_object" }
        }));

    if !auth_header.is_empty() {
        request = request.header("Authorization", auth_header);
    }

    let response = request.send().await.map_err(|e| {
        tracing::error!("Text review request failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("Text review API error: {}", err_body);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let review_data: serde_json::Value = response
        .json()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let content_str = review_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("{}");

    let parsed_review: serde_json::Value = serde_json::from_str(content_str).unwrap_or(json!({
        "suggestion": payload.text,
        "comments": "No suggestions available at this time."
    }));

    Ok(Json(parsed_review))
}
