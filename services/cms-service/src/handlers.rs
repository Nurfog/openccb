use axum::{
    extract::{State, Path, Query},
    http::StatusCode,
    Json,
};
use common::models::{Course, Module, Lesson, PublishedCourse, PublishedModule, User, UserResponse, AuthResponse, CourseAnalytics, Organization};
use common::auth::create_jwt;
use common::middleware::Org;
use sqlx::PgPool;
use uuid::Uuid;
use serde_json::json;
use serde::{Deserialize, Serialize};
use bcrypt::{hash, verify, DEFAULT_COST};

pub async fn publish_course(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // 1. Fetch Course
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Fetch Modules
    let modules = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
        .bind(id)
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut pub_modules = Vec::new();

    // 3. Fetch Grading Categories
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1"
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. Fetch Lessons for each Module
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE module_id = $1 ORDER BY position")
            .bind(module.id)
            .fetch_all(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        pub_modules.push(PublishedModule {
            module,
            lessons,
        });
    }

    let payload = PublishedCourse {
        course,
        grading_categories,
        modules: pub_modules,
    };

    // 4. Send to LMS
    // Using service name for Docker compatibility
    let client = reqwest::Client::new();
    let res = client.post("http://lms-service:3002/ingest")
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
    let title = payload.get("title").and_then(|t| t.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let instructor_id = claims.sub;

    let course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (title, instructor_id, organization_id) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(title)
    .bind(instructor_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, instructor_id, "CREATE", "Course", course.id, json!({ "title": title })).await;

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
    // 1. Fetch course and check ownership/role
    let existing = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Course not found".into()))?;

    if claims.role != "admin" && existing.instructor_id != claims.sub {
        return Err((StatusCode::FORBIDDEN, "Not authorized".into()));
    }

    // 2. Update fields
    let title = payload.get("title").and_then(|v| v.as_str()).unwrap_or(&existing.title);
    let description = payload.get("description").and_then(|v| v.as_str()).unwrap_or(existing.description.as_deref().unwrap_or(""));
    let passing_percentage = payload.get("passing_percentage").and_then(|v| v.as_i64()).unwrap_or(existing.passing_percentage as i64) as i32;
    
    // Check if certificate_template is in payload (even if null to unset?)
    // For simplicity: if provided as string, use it. If not provided, keep existing.
    // To unset, user can send empty string maybe? 
    let certificate_template = payload.get("certificate_template")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or(existing.certificate_template);

    let course = sqlx::query_as::<_, Course>(
        "UPDATE courses SET title = $1, description = $2, passing_percentage = $3, certificate_template = $4, updated_at = NOW() WHERE id = $5 AND organization_id = $6 RETURNING *"
    )
    .bind(title)
    .bind(description)
    .bind(passing_percentage)
    .bind(certificate_template)
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
    let title = payload.get("title").and_then(|t| t.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let course_id_str = payload.get("course_id").and_then(|v| v.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let course_id = Uuid::parse_str(course_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let position = payload.get("position").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

    let module = sqlx::query_as::<_, Module>(
        "INSERT INTO modules (course_id, title, position) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(course_id)
    .bind(title)
    .bind(position)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, claims.sub, "CREATE", "Module", module.id, json!({ "title": title, "course_id": course_id })).await;

    Ok(Json(module))
}

pub async fn create_lesson(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Lesson>, StatusCode> {
    let title = payload.get("title").and_then(|t| t.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let module_id_str = payload.get("module_id").and_then(|v| v.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let module_id = Uuid::parse_str(module_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let content_type = payload.get("content_type").and_then(|t| t.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let content_url = payload.get("content_url").and_then(|v| v.as_str());
    let position = payload.get("position").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let transcription = payload.get("transcription").cloned();
    let metadata = payload.get("metadata").cloned();

    let is_graded = payload.get("is_graded").and_then(|v| v.as_bool()).unwrap_or(false);
    let grading_category_id = payload.get("grading_category_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok());
    let max_attempts = payload.get("max_attempts").and_then(|v| v.as_i64()).map(|v| v as i32);
    let allow_retry = payload.get("allow_retry").and_then(|v| v.as_bool()).unwrap_or(true);

    let lesson = sqlx::query_as::<_, Lesson>(
        "INSERT INTO lessons (module_id, title, content_type, content_url, position, transcription, metadata, is_graded, grading_category_id, max_attempts, allow_retry) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *"
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
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, claims.sub, "CREATE", "Lesson", lesson.id, json!({ "title": title, "module_id": module_id })).await;

    Ok(Json(lesson))
}

pub async fn process_transcription(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    // 1. Fetch lesson
    let _lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Simulate AI Processing
    let mock_transcription = json!({
        "en": "This is a simulated transcription of the video content in English.",
        "es": "Esta es una transcripción simulada del contenido del video en español.",
        "cues": [
            { "start": 0.0, "end": 2.0, "text": "Hello world!" },
            { "start": 2.1, "end": 5.0, "text": "Welcome to OpenCCB." }
        ]
    });

    // 3. Update lesson
    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons SET transcription = $1 WHERE id = $2 RETURNING *"
    )
    .bind(mock_transcription)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, claims.sub, "TRANSCRIPTION_PROCESSED", "Lesson", id, json!({})).await;

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

    // 2. Simulate AI Summarization based on content
    // In a real scenario, this would call an LLM with the transcription or blocks content
    let mock_summary = format!(
        "This lesson, titled '{}', covers the fundamental concepts of the topic. It includes interactive elements designed to reinforce learning through practice and assessment.",
        lesson.title
    );

    // 3. Update lesson
    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons SET summary = $1 WHERE id = $2 RETURNING *"
    )
    .bind(mock_summary)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, claims.sub, "SUMMARY_GENERATED", "Lesson", id, json!({})).await;

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

    // 2. Simulate AI Quiz Generation
    // Normally would use lesson content (transcription, blocks, etc.)
    let quiz_blocks = json!([
        {
            "id": Uuid::new_v4().to_string(),
            "type": "quiz",
            "title": "Automated Content Check",
            "quiz_data": {
                "questions": [
                    {
                        "id": "q1",
                        "type": "multiple-choice",
                        "question": format!("Based on '{}', what is the primary objective?", lesson.title),
                        "options": ["Option A", "Option B", "Option C", "Option D"],
                        "correctAnswer": 0,
                        "explanation": "This question was generated automatically based on the lesson title."
                    }
                ]
            }
        }
    ]);

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
    let position = payload.get("position").and_then(|v| v.as_i64()).map(|v| v as i32);
    let is_graded = payload.get("is_graded").and_then(|v| v.as_bool());
    let max_attempts = payload.get("max_attempts").and_then(|v| v.as_i64()).map(|v| v as i32);
    let allow_retry = payload.get("allow_retry").and_then(|v| v.as_bool());
    let metadata = payload.get("metadata");
    
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
             summary = COALESCE($11, summary)
         WHERE id = $12 RETURNING *"
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
         RETURNING *"
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

async fn log_action(
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
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
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

    while let Some(field) = multipart.next_field().await.map_err(|e: axum::extract::multipart::MultipartError| (StatusCode::BAD_REQUEST, e.to_string()))? {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            filename = field.file_name().unwrap_or("unnamed").to_string();
            mimetype = field.content_type().unwrap_or("application/octet-stream").to_string();
            data = field.bytes().await.map_err(|e: axum::extract::multipart::MultipartError| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.to_vec();
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
    tokio::fs::create_dir_all("uploads").await.map_err(|e: std::io::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Write file
    tokio::fs::write(&storage_path, data).await.map_err(|e: std::io::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Record in DB
    let size_bytes = tokio::fs::metadata(&storage_path).await.map(|m| m.len() as i64).unwrap_or(0);
    
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

    let full_name = payload.full_name.unwrap_or_else(|| payload.email.split('@').next().unwrap_or("User").to_string());
    let role = payload.role.unwrap_or_else(|| "instructor".to_string());

    // Find or create organization based on email domain
    let org_name = payload.organization_name.unwrap_or_else(|| {
        let parts: Vec<&str> = payload.email.split('@').collect();
        parts.get(1).unwrap_or(&"default.com").to_string()
    });

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let token = create_jwt(user.id, user.organization_id, &user.role)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "JWT generation failed".into()))?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
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

    if !verify(payload.password, &user.password_hash).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Verification failed".into()))? {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".into()));
    }

    let token = create_jwt(user.id, user.organization_id, &user.role)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "JWT generation failed".into()))?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
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
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Course not found".into()))?;

    // 2. Enforce RBAC
    if claims.role != "admin" && course.instructor_id != claims.sub {
        return Err((StatusCode::FORBIDDEN, "You do not have permission to view stats for a course you don't own".into()));
    }

    // 4. Fetch from LMS
    let client = reqwest::Client::new();
    let res = client.get(format!("http://lms-service:3002/courses/{}/analytics", id))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    if !res.status().is_success() {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch analytics from LMS".into()));
    }

    let analytics = res.json::<CourseAnalytics>().await
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
        return Err((StatusCode::FORBIDDEN, "Only admins can view audit logs".into()));
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
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Fetch Modules
    let modules = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
        .bind(id)
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut modules_with_lessons = Vec::new();

    // 3. Fetch Lessons (This could be optimized with a single query, but N+1 is acceptable for course editor scale)
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE module_id = $1 ORDER BY position")
            .bind(module.id)
            .fetch_all(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        modules_with_lessons.push(ModuleWithLessons {
            module,
            lessons,
        });
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
    let position = payload.get("position").and_then(|v| v.as_i64()).map(|v| v as i32);

    let updated_module = sqlx::query_as::<_, Module>(
        "UPDATE modules 
         SET title = COALESCE($1, title), 
             position = COALESCE($2, position)
         WHERE id = $3 RETURNING *"
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
