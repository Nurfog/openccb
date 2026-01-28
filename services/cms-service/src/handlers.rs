use crate::exporter;
use crate::webhooks::WebhookService;
pub mod tasks;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bcrypt::{DEFAULT_COST, hash, verify};
use chrono::{DateTime, Utc};
use common::auth::{Claims, create_jwt};
use common::middleware::Org;
use common::models::{
    AuthResponse, Course, CourseAnalytics, Lesson, Module, Organization, PublishedCourse,
    PublishedModule, User, UserResponse,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

use openidconnect::core::{CoreClient, CoreProviderMetadata, CoreResponseType};
use openidconnect::reqwest::async_http_client;
use openidconnect::{
    AuthenticationFlow, AuthorizationCode, ClientId, ClientSecret, CsrfToken, IssuerUrl, Nonce,
    RedirectUrl, Scope, TokenResponse,
};

#[derive(Deserialize)]
pub struct SSOCallbackParams {
    pub code: String,
    pub state: String,
}

#[derive(Deserialize)]
pub struct PublishPayload {
    pub target_organization_id: Option<Uuid>,
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

    // 1. Fetch Course (Super admin can publish any course, others only their org's)
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

    // Determine target organization
    let target_org_id = if is_super_admin && payload_params.target_organization_id.is_some() {
        payload_params.target_organization_id.unwrap()
    } else {
        course.organization_id
    };

    // 2. Fetch Modules
    let modules =
        sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
            .bind(id)
            .fetch_all(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut pub_modules = Vec::new();

    // 3. Fetch Grading Categories
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. Fetch Target Organization
    let organization = sqlx::query_as::<_, common::models::Organization>(
        "SELECT * FROM organizations WHERE id = $1",
    )
    .bind(target_org_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. Fetch Lessons for each Module
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

    // Overwrite the course's organization_id in the payload if publishing to a different org
    let mut course_for_pub = course.clone();
    course_for_pub.organization_id = target_org_id;

    let payload = PublishedCourse {
        course: course_for_pub,
        organization,
        grading_categories,
        modules: pub_modules,
    };

    // 4. Send to LMS
    let lms_url =
        env::var("LMS_INTERNAL_URL").unwrap_or_else(|_| "http://experience:3002".to_string());
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/ingest", lms_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to reach LMS service: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    if !res.status().is_success() {
        tracing::error!("LMS ingestion failed with status: {}", res.status());
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

    // 5. Trigger Webhook
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
        tracing::error!("Failed to start transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Set session context for the DB trigger to find
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
        tracing::error!("Failed to set session context: {}", e);
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

    let course = sqlx::query_as::<_, Course>("SELECT * FROM fn_create_course($1, $2, $3, $4)")
        .bind(target_org_id)
        .bind(instructor_id)
        .bind(title)
        .bind(pacing_mode)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Create course failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {}", e);
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

    let courses = if is_super_admin {
        sqlx::query_as::<_, Course>("SELECT * FROM courses")
            .fetch_all(&pool)
            .await
    } else {
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE organization_id = $1")
            .bind(org_ctx.id)
            .fetch_all(&pool)
            .await
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
            .map_err(|_| (StatusCode::NOT_FOUND, "Course not found".into()))?;

    if claims.role != "admin" && existing.instructor_id != claims.sub {
        return Err((StatusCode::FORBIDDEN, "Not authorized".into()));
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

    // BEGIN TRANSACTION
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Set auditing context
    sqlx::query(
        "SELECT set_config('app.current_user_id', $1, true), set_config('app.org_id', $2, true)",
    )
    .bind(claims.sub.to_string())
    .bind(org_ctx.id.to_string())
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let course = sqlx::query_as::<_, Course>(
        "SELECT * FROM fn_update_course($1, $2, $3, $4, $5, $6, $7, $8, $9)",
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
            tracing::error!("Create module failed: {}", e);
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
        "SELECT * FROM fn_create_lesson($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)"
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
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Create lesson failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Trigger auto-transcription if it's a video or audio lesson with a URL
    if (content_type == "video" || content_type == "audio") && content_url.is_some() {
        trigger_transcription(pool, lesson.id).await;
    }

    Ok(Json(lesson))
}

async fn trigger_transcription(pool: PgPool, lesson_id: Uuid) {
    // Set status to queued
    let _ = sqlx::query("UPDATE lessons SET transcription_status = 'queued' WHERE id = $1")
        .bind(lesson_id)
        .execute(&pool)
        .await;

    // Spawn background task
    tokio::spawn(async move {
        if let Err(e) = run_transcription_task(pool, lesson_id).await {
            tracing::error!("Auto-transcription task failed for lesson {}: {}", lesson_id, e);
        }
    });
}

pub async fn process_transcription(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    tracing::info!("Received transcription request for lesson: {}", id);
    // 1. Fetch lesson
    let lesson =
        sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Lesson fetch failed: {}", e);
                StatusCode::NOT_FOUND
            })?;

    if lesson.content_type != "video" && lesson.content_type != "audio" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let url = lesson.content_url.ok_or(StatusCode::BAD_REQUEST)?;
    let filename = url.trim_start_matches("/assets/");
    let file_path = format!("uploads/{}", filename);

    // 2. Read file to verify it exists
    if !tokio::fs::metadata(&file_path).await.is_ok() {
        tracing::error!("File not found: {}", file_path);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 3. Set status to queued
    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons SET transcription_status = 'queued' WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database update failed (queued): {}", e);
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

    // 4. Spawn background task
    let pool_clone = pool.clone();
    tokio::spawn(async move {
        if let Err(e) = run_transcription_task(pool_clone, id).await {
            tracing::error!("Transcription task failed for lesson {}: {}", id, e);
        }
    });

    Ok(Json(updated_lesson))
}

async fn _translate_text(text: &str, target_lang: &str) -> Result<String, String> {
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
    let filename = url.trim_start_matches("/assets/");
    let file_path = format!("uploads/{}", filename);

    // 2. Set status to processing
    tracing::info!("Starting transcription for lesson {} (file: {})", lesson_id, file_path);
    sqlx::query("UPDATE lessons SET transcription_status = 'processing' WHERE id = $1")
        .bind(lesson_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Update to processing failed: {}", e))?;

    // 3. Read file
    let file_data = tokio::fs::read(&file_path)
        .await
        .map_err(|e| {
            let err = format!("File read failed ({}): {}", file_path, e);
            tracing::error!("{}", err);
            err
        })?;
    
    tracing::info!("File read successfully ({} bytes). Sending to Whisper...", file_data.len());

    // 4. Send to Whisper
    let whisper_url = env::var("LOCAL_WHISPER_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());
    let client = reqwest::Client::new();
    
    // We assume a standard Whisper API (like faster-whisper-server or openai-compatible)
    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(file_data).file_name(filename.to_string()))
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

    let transcription_result: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Whisper response: {}", e))?;

    tracing::info!("Transcription received successfully for lesson {}", lesson_id);

    // 5. Update lesson with transcription
    sqlx::query("UPDATE lessons SET transcription = $1, transcription_status = 'completed' WHERE id = $2")
        .bind(&transcription_result)
        .bind(lesson_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update lesson with transcription: {}", e))?;

    // 6. Optional: Trigger Summarization using Ollama
    let full_text = transcription_result["text"].as_str().unwrap_or("");
    if !full_text.is_empty() {
        tracing::info!("Triggering AI summary for lesson {}", lesson_id);
        if let Ok(summary) = generate_summary_with_ollama(full_text).await {
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

async fn generate_summary_with_ollama(text: &str) -> Result<String, String> {
    let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
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

    Ok(summary)
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

pub async fn summarize_lesson(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    tracing::info!("Received summarization request for lesson: {}", id);
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

    let mut system_prompt = "You are an expert English Teacher. Generate 3 questions based on the lesson content to test the student's understanding of English grammar, vocabulary, or comprehension. Instructions can be in Spanish or English. Return ONLY a JSON object with a field 'blocks' which is an array of content blocks. Each block in the array must follow this exact structure: { \"id\": \"string-uuid\", \"type\": \"quiz\", \"title\": \"Quiz: Concept Check\", \"quiz_data\": { \"questions\": [ { \"id\": \"q-string\", \"type\": \"multiple-choice\", \"question\": \"String\", \"options\": [\"Option 1\", \"Option 2\", \"Option 3\", \"Option 4\"], \"correct\": [0], \"explanation\": \"Explain why the answer is correct.\" } ] } }. Important: 'correct' MUST be an array of integers.".to_string();

    if let Some(ctx) = &quiz_req.context {
        if !ctx.is_empty() {
            system_prompt.push_str(&format!(" Additional Context: {}", ctx));
        }
    }

    if let Some(qtype) = &quiz_req.quiz_type {
        if !qtype.is_empty() {
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

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("Quiz API error: {}", err_body);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let quiz_data: serde_json::Value = response
        .json()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
        "SELECT * FROM fn_update_lesson($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)"
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
        "INSERT INTO grading_categories (organization_id, course_id, name, weight, drop_count) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *",
    )
    .bind(org_ctx.id)
    .bind(payload.course_id)
    .bind(payload.name)
    .bind(payload.weight)
    .bind(payload.drop_count)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(category))
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

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub id: Uuid,
    pub filename: String,
    pub url: String,
}

pub async fn upload_asset(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, String)> {
    tracing::info!("Starting upload_asset for org: {}", org_ctx.id);
    let mut filename = String::new();
    let mut data = Vec::new();
    let mut mimetype = String::new();
    let mut course_id: Option<Uuid> = None;

    while let Some(field) =
        multipart
            .next_field()
            .await
            .map_err(|e: axum::extract::multipart::MultipartError| {
                (StatusCode::BAD_REQUEST, e.to_string())
            })?
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
                .map_err(|e: axum::extract::multipart::MultipartError| {
                    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
                })?
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
    let extension = std::path::Path::new(&filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let storage_filename = format!("{}.{}", asset_id, extension);
    let storage_path = format!("uploads/{}", storage_filename);

    // Ensure uploads directory exists
    tokio::fs::create_dir_all("uploads")
        .await
        .map_err(|e: std::io::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Write file
    tokio::fs::write(&storage_path, data)
        .await
        .map_err(|e: std::io::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Record in DB
    let size_bytes = tokio::fs::metadata(&storage_path)
        .await
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    sqlx::query(
        "INSERT INTO assets (id, filename, storage_path, mimetype, size_bytes, organization_id, course_id) VALUES ($1, $2, $3, $4, $5, $6, $7)"
    )
    .bind(asset_id)
    .bind(&filename)
    .bind(storage_path)
    .bind(mimetype)
    .bind(size_bytes)
    .bind(org_ctx.id)
    .bind(course_id)
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let url = format!("/assets/{}", storage_filename);

    tracing::info!("Upload successful: {} -> {}", filename, url);
    Ok(Json(UploadResponse {
        id: asset_id,
        filename,
        url,
    }))
}

pub async fn get_course_assets(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<common::models::Asset>>, StatusCode> {
    let assets = sqlx::query_as::<_, common::models::Asset>(
        "SELECT * FROM assets WHERE organization_id = $1 AND course_id = $2 ORDER BY created_at DESC"
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch course assets: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(assets))
}

pub async fn delete_asset(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(asset_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 1. Fetch asset to verify ownership/org
    let asset = sqlx::query_as::<_, common::models::Asset>(
        "SELECT * FROM assets WHERE id = $1 AND organization_id = $2",
    )
    .bind(asset_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let asset = match asset {
        Some(a) => a,
        None => return Err((StatusCode::NOT_FOUND, "Asset not found".to_string())),
    };

    // 2. Check permissions (only instructor of the course or admin)
    if claims.role != "admin" {
        // If linked to a course, check if user owns that course
        if let Some(cid) = asset.course_id {
            let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
                .bind(cid)
                .fetch_optional(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            if let Some(c) = course {
                if c.instructor_id != claims.sub {
                    return Err((
                        StatusCode::FORBIDDEN,
                        "Not authorized to delete this asset".to_string(),
                    ));
                }
            }
        }
        // If not linked to a course, only admins might delete? Or maybe uploader?
        // For now, let's assume if it's orphaned, only admin deletes.
        if asset.course_id.is_none() {
            return Err((
                StatusCode::FORBIDDEN,
                "Only admins can delete global assets".to_string(),
            ));
        }
    }

    // 3. Delete file
    // Note: storage_path is relative to working dir usually "uploads/..."
    if let Err(e) = tokio::fs::remove_file(&asset.storage_path).await {
        tracing::warn!("Failed to delete file {}: {}", asset.storage_path, e);
        // We continue to delete from DB even if file specific deletion failed (maybe already gone)
    }

    // 4. Delete from DB
    sqlx::query("DELETE FROM assets WHERE id = $1")
        .bind(asset_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct AuthPayload {
    pub email: String,
    pub password: String,
    pub full_name: Option<String>,
    pub role: Option<String>,
    pub organization_name: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct ProvisionPayload {
    pub org_name: String,
    pub org_domain: Option<String>,
    pub admin_email: String,
    pub admin_password: String,
    pub admin_full_name: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct AdminCreateUserPayload {
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub role: String,
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let password_hash = hash(payload.password, DEFAULT_COST)
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

    Ok(Json(AuthResponse {
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
        token,
    }))
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

    let password_hash = hash(payload.password, DEFAULT_COST)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hashing failed".into()))?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name, role, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING *"
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(&payload.full_name)
    .bind(&payload.role)
    .bind(org_ctx.id)
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

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM fn_get_user_by_email($1)")
        .bind(&payload.email)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid credentials".into()))?;

    if !verify(payload.password, &user.password_hash).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Verification failed".into(),
        )
    })? {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".into()));
    }

    let token = create_jwt(user.id, user.organization_id, &user.role).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "JWT generation failed".into(),
        )
    })?;

    Ok(Json(AuthResponse {
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
        token,
    }))
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
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<CourseWithOutline>, StatusCode> {
    // 1. Fetch Course
    let course =
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
            .bind(id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
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

    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET role = COALESCE($1, role), organization_id = COALESCE($2, organization_id), full_name = COALESCE($3, full_name), avatar_url = COALESCE($4, avatar_url), bio = COALESCE($5, bio), language = COALESCE($6, language) WHERE id = $7 AND organization_id = $8 RETURNING *"
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

// Organizations Management (Plural/Admin)
pub async fn get_organizations(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Organization>>, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let orgs =
        sqlx::query_as::<_, Organization>("SELECT * FROM organizations ORDER BY created_at DESC")
            .fetch_all(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch organizations: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(orgs))
}

pub async fn create_organization(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Organization>, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let domain = payload.get("domain").and_then(|v| v.as_str());

    let org = sqlx::query_as::<_, Organization>(
        "INSERT INTO organizations (name, domain) VALUES ($1, $2) RETURNING *",
    )
    .bind(name)
    .bind(domain)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create organization: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(org))
}

pub async fn provision_organization(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ProvisionPayload>,
) -> Result<Json<Organization>, (StatusCode, String)> {
    if claims.role != "admin" || claims.org != Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap() {
        return Err((StatusCode::FORBIDDEN, "Super Admin access required".into()));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let org = sqlx::query_as::<_, Organization>(
        "INSERT INTO organizations (name, domain) VALUES ($1, $2) RETURNING *"
    )
    .bind(&payload.org_name)
    .bind(&payload.org_domain)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create organization: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create organization".into())
    })?;

    let password_hash = hash(payload.admin_password, DEFAULT_COST)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hashing failed".into()))?;

    sqlx::query(
        "INSERT INTO users (email, password_hash, full_name, role, organization_id) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(&payload.admin_email)
    .bind(password_hash)
    .bind(&payload.admin_full_name)
    .bind("admin")
    .bind(org.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create admin user: {}", e);
        (StatusCode::CONFLICT, "User already exists or DB error".into())
    })?;

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(org))
}

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
        return Err((StatusCode::NOT_FOUND, "Course not found".to_string()));
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
            "INSERT INTO assets (id, filename, storage_path, mimetype, size_bytes, organization_id) 
             VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(new_id)
        .bind(&old_filename) 
        .bind(&new_storage_path)
        .bind(&mimetype)
        .bind(content.len() as i64)
        .bind(org_ctx.id)
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

    let response = request.send().await.map_err(|e| {
        tracing::error!("LLM request failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("LLM API error: {}", err_body);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let llm_data: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Failed to parse LLM JSON response: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("LLM Response received successfully");

    let mut content_str = llm_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("{}")
        .trim()
        .to_string();

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

    log_action(
        &pool,
        target_org_id,
        claims.sub,
        "AI_COURSE_GENERATED",
        "Course",
        course.id,
        json!({ "prompt": payload.prompt }),
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
    if !is_super_admin && claims.role == "instructor" && course.instructor_id != claims.sub {
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
