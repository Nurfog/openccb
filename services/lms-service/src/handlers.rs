use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use common::models::{Course, Enrollment, Module, Lesson};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn enroll_user(
    State(pool): State<PgPool>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Enrollment>, StatusCode> {
    let course_id_str = payload.get("course_id").and_then(|v| v.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let course_id = Uuid::parse_str(course_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let user_id = Uuid::new_v4(); // Placeholder for actual auth

    let enrollment = sqlx::query_as::<_, Enrollment>(
        "INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) RETURNING *"
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(enrollment))
}

pub async fn get_course_catalog(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Course>>, StatusCode> {
    let courses = sqlx::query_as::<_, Course>("SELECT * FROM courses")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(courses))
}

pub async fn ingest_course(
    State(pool): State<PgPool>,
    Json(payload): Json<common::models::PublishedCourse>,
) -> Result<StatusCode, StatusCode> {
    let mut tx = pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. Upsert Course
    sqlx::query(
        "INSERT INTO courses (id, title, description, instructor_id, start_date, end_date, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            instructor_id = EXCLUDED.instructor_id,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            updated_at = EXCLUDED.updated_at"
    )
    .bind(payload.course.id)
    .bind(&payload.course.title)
    .bind(&payload.course.description)
    .bind(payload.course.instructor_id)
    .bind(payload.course.start_date)
    .bind(payload.course.end_date)
    .bind(payload.course.updated_at)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to upsert course during ingestion: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 2. Clear existing modules and lessons for this course to ensure perfect sync
    // Cascading delete on courses(id) handles lessons too
    sqlx::query("DELETE FROM modules WHERE course_id = $1")
        .bind(payload.course.id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. Insert Modules and Lessons
    for pub_module in payload.modules {
        sqlx::query(
            "INSERT INTO modules (id, course_id, title, position, created_at)
             VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(pub_module.module.id)
        .bind(payload.course.id)
        .bind(&pub_module.module.title)
        .bind(pub_module.module.position)
        .bind(pub_module.module.created_at)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        for lesson in pub_module.lessons {
            sqlx::query(
                "INSERT INTO lessons (id, module_id, title, content_type, content_url, transcription, metadata, position, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
            )
            .bind(lesson.id)
            .bind(pub_module.module.id)
            .bind(&lesson.title)
            .bind(&lesson.content_type)
            .bind(&lesson.content_url)
            .bind(&lesson.transcription)
            .bind(&lesson.metadata)
            .bind(lesson.position)
            .bind(lesson.created_at)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

pub async fn get_course_outline(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<common::models::PublishedCourse>, StatusCode> {
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

    // 3. Fetch Lessons
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE module_id = $1 ORDER BY position")
            .bind(module.id)
            .fetch_all(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        pub_modules.push(common::models::PublishedModule {
            module,
            lessons,
        });
    }

    Ok(Json(common::models::PublishedCourse {
        course,
        modules: pub_modules,
    }))
}

pub async fn get_lesson_content(
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
