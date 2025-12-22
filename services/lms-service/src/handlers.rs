use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use common::models::{Course, Enrollment, Module, Lesson, User, UserResponse, AuthResponse};
use common::auth::create_jwt;
use sqlx::PgPool;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use bcrypt::{hash, verify, DEFAULT_COST};

pub async fn enroll_user(
    State(pool): State<PgPool>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Enrollment>, StatusCode> {
    let course_id_str = payload.get("course_id").and_then(|v| v.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let course_id = Uuid::parse_str(course_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let user_id_str = payload.get("user_id").and_then(|v| v.as_str()).ok_or(StatusCode::BAD_REQUEST)?;
    let user_id = Uuid::parse_str(user_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;

    let enrollment = sqlx::query_as::<_, Enrollment>(
        "INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) RETURNING *"
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Enrollment failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(enrollment))
}

#[derive(Deserialize)]
pub struct AuthPayload {
    pub email: String,
    pub password: String,
    pub full_name: Option<String>,
}

#[derive(Deserialize)]
pub struct GradeSubmissionPayload {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub score: f32,
    pub metadata: Option<serde_json::Value>,
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let password_hash = hash(payload.password, DEFAULT_COST)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hashing failed".into()))?;

    let full_name = payload.full_name.unwrap_or_else(|| payload.email.split('@').next().unwrap_or("Student").to_string());

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(full_name)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::CONFLICT, format!("User already exists or DB error: {}", e)))?;

    let token = create_jwt(user.id, "student")
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

    let token = create_jwt(user.id, "student")
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

    // 2. Clear existing grading categories, modules and lessons (cascading handles lessons/categories)
    sqlx::query("DELETE FROM grading_categories WHERE course_id = $1")
        .bind(payload.course.id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("DELETE FROM modules WHERE course_id = $1")
        .bind(payload.course.id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. Insert Grading Categories
    for cat in payload.grading_categories {
        sqlx::query(
            "INSERT INTO grading_categories (id, course_id, name, weight, drop_count, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(cat.id)
        .bind(payload.course.id)
        .bind(&cat.name)
        .bind(cat.weight)
        .bind(cat.drop_count)
        .bind(cat.created_at)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // 4. Insert Modules and Lessons
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
                "INSERT INTO lessons (id, module_id, title, content_type, content_url, transcription, metadata, position, created_at, is_graded, grading_category_id, max_attempts, allow_retry)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"
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
            .bind(lesson.is_graded)
            .bind(lesson.grading_category_id)
            .bind(lesson.max_attempts)
            .bind(lesson.allow_retry)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to insert lesson: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
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

    // 3. Fetch Grading Categories
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1 ORDER BY created_at"
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. Fetch Lessons
    let mut pub_modules = Vec::new();
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
        grading_categories,
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

pub async fn get_user_enrollments(
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<Enrollment>>, StatusCode> {
    let enrollments = sqlx::query_as::<_, Enrollment>("SELECT * FROM enrollments WHERE user_id = $1")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(enrollments))
}

pub async fn submit_lesson_score(
    State(pool): State<PgPool>,
    Json(payload): Json<GradeSubmissionPayload>,
) -> Result<Json<common::models::UserGrade>, (StatusCode, String)> {
    // 1. Get lesson attempt rules
    let max_attempts: Option<Option<i32>> = sqlx::query_scalar("SELECT max_attempts FROM lessons WHERE id = $1")
        .bind(payload.lesson_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if max_attempts.is_none() {
        return Err((StatusCode::NOT_FOUND, "Lesson not found".into()));
    }
    let max_attempts = max_attempts.flatten();

    // 2. Check existing grade/attempts
    let existing_attempts: Option<i32> = sqlx::query_scalar("SELECT attempts_count FROM user_grades WHERE user_id = $1 AND lesson_id = $2")
        .bind(payload.user_id)
        .bind(payload.lesson_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(count) = existing_attempts {
        if let Some(max) = max_attempts {
            if count >= max {
                tracing::warn!("User {} attempted to resubmit lesson {} but reached max_attempts ({})", payload.user_id, payload.lesson_id, max);
                return Err((StatusCode::FORBIDDEN, "Maximum attempts reached for this assessment".into()));
            }
        }
    }

    // 3. Upsert with increment
    let grade = sqlx::query_as::<_, common::models::UserGrade>(
        "INSERT INTO user_grades (user_id, course_id, lesson_id, score, metadata, attempts_count)
         VALUES ($1, $2, $3, $4, $5, 1)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET
            score = EXCLUDED.score,
            metadata = EXCLUDED.metadata,
            attempts_count = user_grades.attempts_count + 1,
            created_at = CURRENT_TIMESTAMP
         RETURNING *"
    )
    .bind(payload.user_id)
    .bind(payload.course_id)
    .bind(payload.lesson_id)
    .bind(payload.score)
    .bind(payload.metadata)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(grade))
}

pub async fn get_user_course_grades(
    State(pool): State<PgPool>,
    Path((user_id, course_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<common::models::UserGrade>>, StatusCode> {
    let grades = sqlx::query_as::<_, common::models::UserGrade>(
        "SELECT * FROM user_grades WHERE user_id = $1 AND course_id = $2"
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(grades))
}
