use axum::{
    extract::{State, Path, Query},
    http::StatusCode,
    Json,
};
use common::models::{Course, Module, Lesson};
use sqlx::PgPool;
use uuid::Uuid;
use serde_json::json;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ModuleQuery {
    pub course_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct LessonQuery {
    pub module_id: Option<Uuid>,
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

    let lesson = sqlx::query_as::<_, Lesson>(
        "INSERT INTO lessons (module_id, title, content_type, content_url, position, transcription, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"
    )
    .bind(module_id)
    .bind(title)
    .bind(content_type)
    .bind(content_url)
    .bind(position)
    .bind(transcription)
    .bind(metadata)
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

    let updated_lesson = sqlx::query_as::<_, Lesson>(
        "UPDATE lessons 
         SET title = COALESCE($1, title), 
             content_type = COALESCE($2, content_type), 
             content_url = COALESCE($3, content_url),
             position = COALESCE($4, position)
         WHERE id = $5 RETURNING *"
    )
    .bind(title)
    .bind(content_type)
    .bind(content_url)
    .bind(position)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    log_action(&pool, Uuid::new_v4(), "UPDATE", "Lesson", id, json!(payload)).await;

    Ok(Json(updated_lesson))
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
