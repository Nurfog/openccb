use axum::{
    extract::{State, Path, Query},
    http::StatusCode,
    Json,
};
use common::models::{Course, Module, Lesson, PublishedCourse, PublishedModule, User, UserResponse, AuthResponse};
use common::auth::create_jwt;
use sqlx::PgPool;
use uuid::Uuid;
use serde_json::json;
use serde::{Deserialize, Serialize};
use bcrypt::{hash, verify, DEFAULT_COST};

pub async fn publish_course(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // 1. Fetch Course
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
        .bind(id)
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
    State(pool): State<PgPool>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Course>, StatusCode> {
    let title = payload.get("title").and_then(|t| t.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let instructor_id = Uuid::new_v4(); 

    let course = sqlx::query_as::<_, Course>(
        "INSERT INTO courses (title, instructor_id) VALUES ($1, $2) RETURNING *"
    )
    .bind(title)
    .bind(instructor_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, instructor_id, "CREATE", "Course", course.id, json!({ "title": title })).await;

    Ok(Json(course))
}

pub async fn get_courses(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Course>>, StatusCode> {
    let courses = sqlx::query_as::<_, Course>("SELECT * FROM courses")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(courses))
}

pub async fn create_module(
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

    log_action(&pool, Uuid::new_v4(), "CREATE", "Module", module.id, json!({ "title": title, "course_id": course_id })).await;

    Ok(Json(module))
}

pub async fn create_lesson(
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

    let lesson = sqlx::query_as::<_, Lesson>(
        "INSERT INTO lessons (module_id, title, content_type, content_url, position, transcription, metadata, is_graded, grading_category_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *"
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
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, Uuid::new_v4(), "CREATE", "Lesson", lesson.id, json!({ "title": title, "module_id": module_id })).await;

    Ok(Json(lesson))
}

pub async fn process_transcription(
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

    log_action(&pool, Uuid::new_v4(), "TRANSCRIPTION_PROCESSED", "Lesson", id, json!({})).await;

    Ok(Json(updated_lesson))
}

pub async fn get_lesson(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(lesson))
}

pub async fn update_lesson(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Lesson>, StatusCode> {
    let title = payload.get("title").and_then(|t| t.as_str());
    let content_type = payload.get("content_type").and_then(|t| t.as_str());
    let content_url = payload.get("content_url").and_then(|t| t.as_str());
    let position = payload.get("position").and_then(|v| v.as_i64()).map(|v| v as i32);
    let is_graded = payload.get("is_graded").and_then(|v| v.as_bool());
    let grading_category_id = payload.get("grading_category_id")
        .and_then(|v| {
            if v.is_null() {
                Some(None)
            } else {
                v.as_str().and_then(|s| Uuid::parse_str(s).ok()).map(Some)
            }
        });
    
    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons 
         SET title = COALESCE($1, title), 
             content_type = COALESCE($2, content_type), 
             content_url = COALESCE($3, content_url),
             position = COALESCE($4, position),
             is_graded = COALESCE($5, is_graded),
             grading_category_id = CASE WHEN $6 = 'SET_NULL' THEN NULL WHEN $7::UUID IS NOT NULL THEN $7 ELSE grading_category_id END
         WHERE id = $8 RETURNING *"
    )
    .bind(title)
    .bind(content_type)
    .bind(content_url)
    .bind(position)
    .bind(is_graded)
    .bind(if payload.get("grading_category_id").map(|v| v.is_null()).unwrap_or(false) { "SET_NULL" } else { "" })
    .bind(payload.get("grading_category_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok()))
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Update lesson failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(&pool, Uuid::new_v4(), "UPDATE", "Lesson", id, json!(payload)).await;

    Ok(Json(updated_lesson))
}

// Grading Policies
pub async fn get_grading_categories(
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<common::models::GradingCategory>>, (StatusCode, String)> {
    let categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1 ORDER BY created_at"
    )
    .bind(course_id)
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
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Course>, StatusCode> {
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(course))
}

pub async fn get_modules(
    State(pool): State<PgPool>,
    Query(query): Query<ModuleQuery>,
) -> Result<Json<Vec<Module>>, StatusCode> {
    let modules = match query.course_id {
        Some(course_id) => {
            sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
                .bind(course_id)
                .fetch_all(&pool)
                .await
        }
        None => {
            sqlx::query_as::<_, Module>("SELECT * FROM modules ORDER BY position")
                .fetch_all(&pool)
                .await
        }
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(modules))
}

pub async fn get_lessons(
    State(pool): State<PgPool>,
    Query(query): Query<LessonQuery>,
) -> Result<Json<Vec<Lesson>>, StatusCode> {
    let lessons = match query.module_id {
        Some(module_id) => {
            sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE module_id = $1 ORDER BY position")
                .bind(module_id)
                .fetch_all(&pool)
                .await
        }
        None => {
            sqlx::query_as::<_, Lesson>("SELECT * FROM lessons ORDER BY position")
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
        "INSERT INTO assets (id, filename, storage_path, mimetype, size_bytes) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(asset_id)
    .bind(&filename)
    .bind(storage_path)
    .bind(mimetype)
    .bind(size_bytes)
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
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let password_hash = hash(payload.password, DEFAULT_COST)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hashing failed".into()))?;

    let full_name = payload.full_name.unwrap_or_else(|| payload.email.split('@').next().unwrap_or("User").to_string());

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(full_name)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::CONFLICT, format!("User already exists or DB error: {}", e)))?;

    let token = create_jwt(user.id, "instructor")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "JWT generation failed".into()))?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
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

    let token = create_jwt(user.id, "instructor")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "JWT generation failed".into()))?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
        },
        token,
    }))
}
