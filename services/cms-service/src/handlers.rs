use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bcrypt::{DEFAULT_COST, hash, verify};
use chrono::{DateTime, Utc};
use common::auth::create_jwt;
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

pub async fn publish_course(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
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

    let mut pub_modules = Vec::new();

    // 3. Fetch Grading Categories
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. Fetch Lessons for each Module
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

    let payload = PublishedCourse {
        course,
        grading_categories,
        modules: pub_modules,
    };

    // 4. Send to LMS
    // Using service name for Docker compatibility
    let client = reqwest::Client::new();
    let res = client
        .post("http://lms-service:3002/ingest")
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

    log_action(&pool, Uuid::new_v4(), "PUBLISH", "Course", id, json!({})).await;

    Ok(StatusCode::OK)
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

pub async fn create_course(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
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

    let course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (title, instructor_id, organization_id, pacing_mode) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(title)
    .bind(instructor_id)
    .bind(org_ctx.id)
    .bind(pacing_mode)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Create course failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(
        &pool,
        instructor_id,
        "CREATE",
        "Course",
        course.id,
        json!({ "title": title, "pacing_mode": pacing_mode }),
    )
    .await;

    Ok(Json(course))
}
pub async fn get_courses(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Course>>, StatusCode> {
    let courses = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE organization_id = $1")
        .bind(org_ctx.id)
        .fetch_all(&pool)
        .await
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

    let course = sqlx::query_as::<_, Course>(
        "UPDATE courses SET title = $1, description = $2, passing_percentage = $3, certificate_template = $4, pacing_mode = $5, start_date = $6, end_date = $7, updated_at = NOW() WHERE id = $8 AND organization_id = $9 RETURNING *"
    )
    .bind(title)
    .bind(description)
    .bind(passing_percentage)
    .bind(certificate_template)
    .bind(pacing_mode)
    .bind(start_date)
    .bind(end_date)
    .bind(id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update course: {}", e)))?;

    Ok(Json(course))
}

pub async fn create_module(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
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

    let module = sqlx::query_as::<_, Module>(
        "INSERT INTO modules (course_id, title, position) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(course_id)
    .bind(title)
    .bind(position)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(
        &pool,
        claims.sub,
        "CREATE",
        "Module",
        module.id,
        json!({ "title": title, "course_id": course_id }),
    )
    .await;

    Ok(Json(module))
}

pub async fn create_lesson(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
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

    let lesson = sqlx::query_as::<_, Lesson>(
        "INSERT INTO lessons (module_id, title, content_type, content_url, position, transcription, metadata, is_graded, grading_category_id, max_attempts, allow_retry, due_date, important_date_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *"
    )
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
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Create lesson failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(
        &pool,
        claims.sub,
        "CREATE",
        "Lesson",
        lesson.id,
        json!({ "title": title, "module_id": module_id }),
    )
    .await;

    Ok(Json(lesson))
}

pub async fn process_transcription(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    // 1. Fetch lesson
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
        .bind(id)
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

    // 2. Read file
    let file_data = tokio::fs::read(&file_path).await.map_err(|e| {
        tracing::error!("File read failed ({}): {}", file_path, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 3. Configuration
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url =
            env::var("LOCAL_WHISPER_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());
        (
            format!("{}/v1/audio/transcriptions", base_url),
            "".to_string(),
            "medium".to_string(),
        )
    } else {
        let api_key = env::var("OPENAI_API_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        (
            "https://api.openai.com/v1/audio/transcriptions".to_string(),
            format!("Bearer {}", api_key),
            "whisper-1".to_string(),
        )
    };

    let part = reqwest::multipart::Part::bytes(file_data)
        .file_name(filename.to_string())
        .mime_str("application/octet-stream")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", model)
        .text("response_format", "verbose_json");

    let mut request = client.post(&url).multipart(form);
    if !auth_header.is_empty() {
        request = request.header("Authorization", auth_header);
    }

    let response = request.send().await.map_err(|e| {
        tracing::error!("Transcription request failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("Transcription API error: {}", err_body);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let whisper_data: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Whisper JSON parse failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Extract text and segments (cues)
    let text = whisper_data["text"].as_str().unwrap_or_default();
    let segments = whisper_data["segments"].as_array();

    let mut cues = Vec::new();
    if let Some(segments) = segments {
        for s in segments {
            cues.push(json!({
                "start": s["start"],
                "end": s["end"],
                "text": s["text"]
            }));
        }
    }

    let transcription = json!({
        "en": text,
        "es": "", // Could add a translation step here
        "cues": cues
    });

    // 4. Update lesson
    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons SET transcription = $1 WHERE id = $2 RETURNING *",
    )
    .bind(transcription)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database update failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(
        &pool,
        claims.sub,
        "TRANSCRIPTION_PROCESSED",
        "Lesson",
        id,
        json!({}),
    )
    .await;

    Ok(Json(updated_lesson))
}

pub async fn summarize_lesson(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    // 1. Fetch lesson
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let transcription_text = lesson
        .transcription
        .as_ref()
        .and_then(|t| t["en"].as_str())
        .unwrap_or("");

    if transcription_text.is_empty() {
        tracing::warn!("Cannot summarize lesson {}: No transcription found", id);
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
                    "content": "You are a professional educational assistant. Summarize the following lesson transcription into a high-quality summary suited for a course platform. Keep it concise but informative (max 150 words). Focus on the key learning objectives."
                },
                {
                    "role": "user",
                    "content": transcription_text
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
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 1. Fetch lesson
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let transcription_text = lesson
        .transcription
        .as_ref()
        .and_then(|t| t["en"].as_str())
        .unwrap_or("");

    if transcription_text.is_empty() {
        tracing::warn!(
            "Cannot generate quiz for lesson {}: No transcription found",
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

    let mut request = client
        .post(&url)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an educational content designer. Generate 3 multiple-choice questions based on the lesson transcription. Return ONLY a JSON object with a field 'blocks' which is an array. Each block in the array must follow this exact structure: { \"id\": \"string-uuid\", \"type\": \"quiz\", \"title\": \"Quiz: Concept Check\", \"quiz_data\": { \"questions\": [ { \"id\": \"q-string\", \"type\": \"multiple-choice\", \"question\": \"String\", \"options\": [\"Option 1\", \"Option 2\", \"Option 3\", \"Option 4\"], \"correctAnswer\": 0, \"explanation\": \"Explain why the answer is correct.\" } ] } }"
                },
                {
                    "role": "user",
                    "content": transcription_text
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

    // Ensure we return just the blocks array as the frontend expects
    let quiz_blocks = quiz_data_parsed
        .get_mut("blocks")
        .cloned()
        .unwrap_or(json!([]));

    log_action(&pool, claims.sub, "QUIZ_GENERATED", "Lesson", id, json!({})).await;

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
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
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
    let metadata = payload.get("metadata");
    let important_date_type = payload.get("important_date_type").and_then(|v| v.as_str());

    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons 
         SET title = COALESCE($1, title), 
             content_type = COALESCE($2, content_type), 
             content_url = COALESCE($3, content_url),
             position = COALESCE($4, position),
             is_graded = COALESCE($5, is_graded),
             grading_category_id = CASE WHEN $6 = 'SET_NULL' THEN NULL WHEN $7::UUID IS NOT NULL THEN $7 ELSE grading_category_id END,
             metadata = COALESCE($8, metadata),
             max_attempts = COALESCE($9, max_attempts),
             allow_retry = COALESCE($10, allow_retry),
             summary = COALESCE($11, summary),
             due_date = CASE WHEN $12 = 'SET_NULL' THEN NULL WHEN $13::TIMESTAMPTZ IS NOT NULL THEN $13 ELSE due_date END,
             important_date_type = COALESCE($14, important_date_type)
         WHERE id = $15 RETURNING *"
    )
    .bind(title)
    .bind(content_type)
    .bind(content_url)
    .bind(position)
    .bind(is_graded)
    .bind(if payload.get("grading_category_id").map(|v| v.is_null()).unwrap_or(false) { "SET_NULL" } else { "" })
    .bind(payload.get("grading_category_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok()))
    .bind(metadata)
    .bind(max_attempts)
    .bind(allow_retry)
    .bind(payload.get("summary").and_then(|v| v.as_str()))
    .bind(if payload.get("due_date").map(|v| v.is_null()).unwrap_or(false) { "SET_NULL" } else { "" })
    .bind(payload.get("due_date").and_then(|v| v.as_str()).and_then(|s| s.parse::<DateTime<Utc>>().ok()))
    .bind(important_date_type)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Update lesson failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(&pool, claims.sub, "UPDATE", "Lesson", id, json!(payload)).await;

    Ok(Json(updated_lesson))
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
    Json(payload): Json<GradingPayload>,
) -> Result<Json<common::models::GradingCategory>, (StatusCode, String)> {
    let category = sqlx::query_as::<_, common::models::GradingCategory>(
        "INSERT INTO grading_categories (course_id, name, weight, drop_count) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *",
    )
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
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query("DELETE FROM grading_categories WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

pub async fn log_action(
    pool: &PgPool,
    user_id: Uuid,
    action: &str,
    entity_type: &str,
    entity_id: Uuid,
    changes: serde_json::Value,
) {
    let _ = sqlx::query(
        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(user_id)
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

#[derive(Deserialize)]
pub struct ReorderPayload {
    pub items: Vec<ReorderItem>,
}

#[derive(Deserialize)]
pub struct ReorderItem {
    pub id: Uuid,
    pub position: i32,
}

pub async fn reorder_modules(
    _claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ReorderPayload>,
) -> Result<StatusCode, StatusCode> {
    for item in payload.items {
        sqlx::query("UPDATE modules SET position = $1 WHERE id = $2")
            .bind(item.position)
            .bind(item.id)
            .execute(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Reorder modules failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    }

    Ok(StatusCode::OK)
}

pub async fn reorder_lessons(
    _claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<ReorderPayload>,
) -> Result<StatusCode, StatusCode> {
    for item in payload.items {
        sqlx::query("UPDATE lessons SET position = $1 WHERE id = $2")
            .bind(item.position)
            .bind(item.id)
            .execute(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Reorder lessons failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    }

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
    let mut filename = String::new();
    let mut data = Vec::new();
    let mut mimetype = String::new();

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
        "INSERT INTO assets (id, filename, storage_path, mimetype, size_bytes, organization_id) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(asset_id)
    .bind(&filename)
    .bind(storage_path)
    .bind(mimetype)
    .bind(size_bytes)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let url = format!("/assets/{}", storage_filename);

    Ok(Json(UploadResponse {
        id: asset_id,
        filename,
        url,
    }))
}

#[derive(Deserialize)]
pub struct AuthPayload {
    pub email: String,
    pub password: String,
    pub full_name: Option<String>,
    pub role: Option<String>,
    pub organization_name: Option<String>,
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

    // Find or create organization based on email domain
    let org_name = payload.organization_name.unwrap_or_else(|| {
        let parts: Vec<&str> = payload.email.split('@').collect();
        parts.get(1).unwrap_or(&"default.com").to_string()
    });

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let organization = sqlx::query_as::<_, Organization>(
        "INSERT INTO organizations (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *"
    )
    .bind(&org_name)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create/find org: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to find or create organization: {}", e))
    })?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name, role, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING *"
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(full_name)
    .bind(&role)
    .bind(organization.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create user: {}", e);
        (StatusCode::CONFLICT, format!("User already exists or DB error: {}", e))
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
        },
        token,
    }))
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
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
    let res = client
        .get(format!("http://lms-service:3002/courses/{}/analytics", id))
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
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Module>, StatusCode> {
    let title = payload.get("title").and_then(|t| t.as_str());
    let position = payload
        .get("position")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);

    let updated_module = sqlx::query_as::<_, Module>(
        "UPDATE modules 
         SET title = COALESCE($1, title), 
             position = COALESCE($2, position)
         WHERE id = $3 RETURNING *",
    )
    .bind(title)
    .bind(position)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Update module failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(&pool, claims.sub, "UPDATE", "Module", id, json!(payload)).await;

    Ok(Json(updated_module))
}

pub async fn delete_module(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query("DELETE FROM modules WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Delete module failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    log_action(&pool, claims.sub, "DELETE", "Module", id, json!({})).await;

    Ok(StatusCode::OK)
}

pub async fn delete_lesson(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    sqlx::query("DELETE FROM lessons WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, claims.sub, "DELETE_LESSON", "Lesson", id, json!({})).await;

    Ok(StatusCode::OK)
}

// User Management
pub async fn get_all_users(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<UserResponse>>, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let users = sqlx::query_as::<_, UserResponse>(
        "SELECT id, email, full_name, role, organization_id FROM users",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch users: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(users))
}

pub async fn update_user(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".into()));
    }

    let role = payload.get("role").and_then(|r| r.as_str());
    let organization_id = payload
        .get("organization_id")
        .and_then(|o| o.as_str())
        .and_then(|o| Uuid::parse_str(o).ok());

    sqlx::query(
        "UPDATE users SET role = COALESCE($1, role), organization_id = COALESCE($2, organization_id) WHERE id = $3"
    )
    .bind(role)
    .bind(organization_id)
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    log_action(&pool, claims.sub, "UPDATE_USER", "User", id, payload).await;

    Ok(StatusCode::OK)
}

// Organizations Management (Plural/Admin)
pub async fn get_organizations(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Organization>>, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let orgs = sqlx::query_as::<_, Organization>("SELECT * FROM organizations ORDER BY created_at DESC")
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

    let name = payload.get("name").and_then(|v| v.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let domain = payload.get("domain").and_then(|v| v.as_str());

    let org = sqlx::query_as::<_, Organization>(
        "INSERT INTO organizations (name, domain) VALUES ($1, $2) RETURNING *"
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
