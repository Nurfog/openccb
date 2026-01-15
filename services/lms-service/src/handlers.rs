use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bcrypt::{DEFAULT_COST, hash, verify};
use common::auth::{Claims, create_jwt};
use common::middleware::Org;
use common::models::{
    AuthResponse, Course, CourseAnalytics, Enrollment, Lesson, LessonAnalytics, Module,
    Organization, User, UserResponse,
};
use serde::Deserialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub async fn enroll_user(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Enrollment>, StatusCode> {
    let course_id_str = payload
        .get("course_id")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let course_id = Uuid::parse_str(course_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;
    let user_id = claims.sub;

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
        &mut tx,
        Some(user_id),
        Some(org_ctx.id),
        ip,
        ua,
        Some("USER_EVENT".to_string()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let enrollment = sqlx::query_as::<_, Enrollment>("SELECT * FROM fn_enroll_student($1, $2, $3)")
        .bind(org_ctx.id)
        .bind(user_id)
        .bind(course_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Enrollment failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Dispatch Webhook
    let webhook_service = common::webhooks::WebhookService::new(pool.clone());
    webhook_service
        .dispatch(
            org_ctx.id,
            "user.enrolled",
            &serde_json::json!({
                "user_id": user_id,
                "course_id": course_id,
                "enrollment_id": enrollment.id
            }),
        )
        .await;

    Ok(Json(enrollment))
}

#[derive(Deserialize)]
pub struct AuthPayload {
    pub email: String,
    pub password: String,
    pub full_name: Option<String>,
    pub organization_name: Option<String>,
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

    let full_name = payload.full_name.unwrap_or_else(|| {
        payload
            .email
            .split('@')
            .next()
            .unwrap_or("Student")
            .to_string()
    });

    // Find or create organization
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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to find or create organization: {}", e)))?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name, organization_id, role) VALUES ($1, $2, $3, $4, 'student') RETURNING *"
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(full_name)
    .bind(organization.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::CONFLICT, format!("User already exists or DB error: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let token = create_jwt(user.id, user.organization_id, "student").map_err(|_| {
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

    let token = create_jwt(user.id, user.organization_id, "student").map_err(|_| {
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
        },
        token,
    }))
}

#[derive(Deserialize)]
pub struct CatalogQuery {
    pub organization_id: Option<Uuid>,
}

pub async fn get_course_catalog(
    State(pool): State<PgPool>,
    Query(query): Query<CatalogQuery>,
) -> Result<Json<Vec<Course>>, StatusCode> {
    let courses = match query.organization_id {
        Some(org_id) => {
            sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE organization_id = $1")
                .bind(org_id)
                .fetch_all(&pool)
                .await
        }
        None => {
            sqlx::query_as::<_, Course>("SELECT * FROM courses")
                .fetch_all(&pool)
                .await
        }
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(courses))
}

pub async fn ingest_course(
    State(pool): State<PgPool>,
    Json(payload): Json<common::models::PublishedCourse>,
) -> Result<StatusCode, StatusCode> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. Upsert Organization
    let org_id = payload.course.organization_id;
    sqlx::query(
        "INSERT INTO organizations (id, name, domain, logo_url, primary_color, secondary_color, certificate_template, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            domain = EXCLUDED.domain,
            logo_url = EXCLUDED.logo_url,
            primary_color = EXCLUDED.primary_color,
            secondary_color = EXCLUDED.secondary_color,
            certificate_template = EXCLUDED.certificate_template,
            updated_at = EXCLUDED.updated_at"
    )
    .bind(payload.organization.id)
    .bind(&payload.organization.name)
    .bind(&payload.organization.domain)
    .bind(&payload.organization.logo_url)
    .bind(&payload.organization.primary_color)
    .bind(&payload.organization.secondary_color)
    .bind(&payload.organization.certificate_template)
    .bind(payload.organization.created_at)
    .bind(payload.organization.updated_at)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to upsert organization during ingestion: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 2. Upsert Course
    sqlx::query(
        "INSERT INTO courses (id, title, description, instructor_id, start_date, end_date, passing_percentage, certificate_template, updated_at, organization_id, pacing_mode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            instructor_id = EXCLUDED.instructor_id,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            passing_percentage = EXCLUDED.passing_percentage,
            certificate_template = EXCLUDED.certificate_template,
            updated_at = EXCLUDED.updated_at,
            organization_id = EXCLUDED.organization_id,
            pacing_mode = EXCLUDED.pacing_mode"
    )
    .bind(payload.course.id)
    .bind(&payload.course.title)
    .bind(&payload.course.description)
    .bind(payload.course.instructor_id)
    .bind(payload.course.start_date)
    .bind(payload.course.end_date)
    .bind(payload.course.passing_percentage)
    .bind(&payload.course.certificate_template)
    .bind(payload.course.updated_at)
    .bind(org_id)
    .bind(&payload.course.pacing_mode)
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
            "INSERT INTO grading_categories (id, course_id, name, weight, drop_count, created_at, organization_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(cat.id)
        .bind(payload.course.id)
        .bind(&cat.name)
        .bind(cat.weight)
        .bind(cat.drop_count)
        .bind(cat.created_at)
        .bind(org_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // 4. Insert Modules and Lessons
    for pub_module in payload.modules {
        sqlx::query(
            "INSERT INTO modules (id, course_id, title, position, created_at, organization_id)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(pub_module.module.id)
        .bind(payload.course.id)
        .bind(&pub_module.module.title)
        .bind(pub_module.module.position)
        .bind(pub_module.module.created_at)
        .bind(org_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        for lesson in pub_module.lessons {
            sqlx::query(
                "INSERT INTO lessons (id, module_id, title, content_type, content_url, transcription, metadata, position, created_at, is_graded, grading_category_id, max_attempts, allow_retry, organization_id, summary, due_date, important_date_type, transcription_status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)"
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
            .bind(org_id)
            .bind(&lesson.summary)
            .bind(lesson.due_date)
            .bind(&lesson.important_date_type)
            .bind(&lesson.transcription_status)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to insert lesson: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

pub async fn get_course_outline(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<common::models::PublishedCourse>, StatusCode> {
    tracing::info!("get_course_outline: fetching course {}", id);
    // 1. Fetch Course
    let course =
        sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Fetch Modules
    let modules = sqlx::query_as::<_, Module>(
        "SELECT * FROM modules WHERE course_id = $1 ORDER BY position",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. Fetch Organization
    let organization = sqlx::query_as::<_, common::models::Organization>(
        "SELECT * FROM organizations WHERE id = $1",
    )
    .bind(course.organization_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. Fetch Grading Categories
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1 ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. Fetch Lessons
    let mut pub_modules = Vec::new();
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>(
            "SELECT * FROM lessons WHERE module_id = $1 ORDER BY position",
        )
        .bind(module.id)
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        pub_modules.push(common::models::PublishedModule { module, lessons });
    }

    Ok(Json(common::models::PublishedCourse {
        course,
        organization,
        grading_categories,
        modules: pub_modules,
    }))
}

pub async fn get_lesson_content(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    tracing::info!("get_lesson_content: fetching lesson {}", id);
    let lesson =
        sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(lesson))
}

pub async fn get_user_enrollments(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<Enrollment>>, StatusCode> {
    let enrollments = sqlx::query_as::<_, Enrollment>(
        "SELECT * FROM enrollments WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(enrollments))
}

pub async fn submit_lesson_score(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<GradeSubmissionPayload>,
) -> Result<Json<common::models::UserGrade>, (StatusCode, String)> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        &mut tx,
        Some(claims.sub),
        Some(org_ctx.id),
        ip,
        ua,
        Some("SYSTEM_EVENT".to_string()),
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 1. Get lesson attempt rules
    let max_attempts: Option<Option<i32>> = sqlx::query_scalar(
        "SELECT max_attempts FROM lessons WHERE id = $1",
    )
    .bind(payload.lesson_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if max_attempts.is_none() {
        return Err((StatusCode::NOT_FOUND, "Lesson not found".into()));
    }
    let max_attempts = max_attempts.flatten();

    // 2. Check existing grade/attempts
    let existing_attempts: Option<i32> = sqlx::query_scalar("SELECT attempts_count FROM user_grades WHERE user_id = $1 AND lesson_id = $2 AND organization_id = $3")
        .bind(payload.user_id)
        .bind(payload.lesson_id)
        .bind(org_ctx.id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(count) = existing_attempts {
        if let Some(max) = max_attempts {
            if count >= max {
                return Err((
                    StatusCode::FORBIDDEN,
                    "Maximum attempts reached for this assessment".into(),
                ));
            }
        }
    }

    // 3. Upsert with automated DB logic (XP, Badges)
    let grade = sqlx::query_as::<_, common::models::UserGrade>(
        "SELECT * FROM fn_upsert_user_grade($1, $2, $3, $4, $5, $6)",
    )
    .bind(org_ctx.id)
    .bind(payload.user_id)
    .bind(payload.course_id)
    .bind(payload.lesson_id)
    .bind(payload.score)
    .bind(payload.metadata)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 4. Dispatch Webhooks
    let webhook_service = common::webhooks::WebhookService::new(pool.clone());

    // lesson.completed
    webhook_service
        .dispatch(
            org_ctx.id,
            "lesson.completed",
            &serde_json::json!({
                "user_id": payload.user_id,
                "course_id": payload.course_id,
                "lesson_id": payload.lesson_id,
                "score": payload.score
            }),
        )
        .await;

    // Detect course completion logic
    let total_lessons: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM lessons WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1)")
        .bind(payload.course_id)
        .fetch_one(&pool).await.unwrap_or(0);

    let completed_lessons: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_grades WHERE organization_id = $1 AND user_id = $2 AND course_id = $3",
    )
    .bind(org_ctx.id)
    .bind(payload.user_id)
    .bind(payload.course_id)
    .fetch_one(&pool)
    .await
    .unwrap_or(0);

    if total_lessons > 0 && completed_lessons >= total_lessons {
        webhook_service
            .dispatch(
                org_ctx.id,
                "course.completed",
                &serde_json::json!({
                    "user_id": payload.user_id,
                    "course_id": payload.course_id
                }),
            )
            .await;
    }

    Ok(Json(grade))
}

#[derive(serde::Serialize)]
pub struct GamificationStatus {
    pub points: i64,
    pub level: i32,
    pub badges: Vec<BadgeResponse>,
}

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct BadgeResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub earned_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_user_gamification(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<GamificationStatus>, StatusCode> {
    let user_stats: (i32, i32) = sqlx::query_as("SELECT xp, level FROM users WHERE id = $1 AND organization_id = $2")
        .bind(user_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let badges = sqlx::query_as::<_, BadgeResponse>(
        "SELECT b.id, b.name, b.description, b.icon_url, ub.earned_at 
         FROM user_badges ub 
         JOIN badges b ON ub.badge_id = b.id 
         WHERE ub.user_id = $1 AND ub.organization_id = $2",
    )
    .bind(user_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(GamificationStatus {
        points: user_stats.0 as i64,
        level: user_stats.1,
        badges,
    }))
}

pub async fn get_leaderboard(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<UserResponse>>, StatusCode> {
    let top_users = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE organization_id = $1 ORDER BY xp DESC LIMIT 10",
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch leaderboard: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = top_users
        .into_iter()
        .map(|u| UserResponse {
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            organization_id: u.organization_id,
            xp: u.xp,
            level: u.level,
        })
        .collect();

    Ok(Json(response))
}

pub async fn get_user_course_grades(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path((user_id, course_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<common::models::UserGrade>>, StatusCode> {
    let grades = sqlx::query_as::<_, common::models::UserGrade>(
        "SELECT * FROM user_grades WHERE user_id = $1 AND course_id = $2",
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(grades))
}
pub async fn get_course_analytics(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<CourseAnalytics>, (StatusCode, String)> {
    // 1. Total Enrollments
    let total_enrollments: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM enrollments WHERE course_id = $1 AND organization_id = $2",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Average Course Score (Overall)
    let average_score: Option<f32> = sqlx::query_scalar(
        "SELECT AVG(score)::float4 FROM user_grades WHERE course_id = $1 AND organization_id = $2",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Per-Lesson Analytics
    // Note: We cast AVG to float4 for PostgreSQL compatibility
    let rows = sqlx::query(
        r#"
        SELECT 
            l.id, 
            l.title, 
            COALESCE(AVG(g.score), 0)::float4 as average_score, 
            COUNT(g.id) as submission_count
        FROM lessons l
        LEFT JOIN user_grades g ON l.id = g.lesson_id
        WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = $1) AND l.organization_id = $2
        GROUP BY l.id, l.title, l.position
        ORDER BY l.position
        "#
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let lessons = rows
        .into_iter()
        .map(|row| LessonAnalytics {
            lesson_id: row.get("id"),
            lesson_title: row.get("title"),
            average_score: row.get("average_score"),
            submission_count: row.get("submission_count"),
        })
        .collect();

    Ok(Json(CourseAnalytics {
        course_id,
        total_enrollments,
        average_score: average_score.unwrap_or(0.0),
        lessons,
    }))
}

pub async fn get_advanced_analytics(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<common::models::AdvancedAnalytics>, StatusCode> {
    // 1. Cohort Analysis using DB function
    let cohort_data = sqlx::query_as::<_, common::models::CohortData>(
        "SELECT period, student_count as count, completion_rate FROM fn_get_cohort_analytics($1, $2)",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Cohort query failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 2. Retention Analysis using DB function
    let retention_data = sqlx::query_as::<_, common::models::RetentionData>(
        "SELECT lesson_id, lesson_title, student_count FROM fn_get_retention_data($1, $2)",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Retention query failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(common::models::AdvancedAnalytics {
        cohorts: cohort_data,
        retention: retention_data,
    }))
}
