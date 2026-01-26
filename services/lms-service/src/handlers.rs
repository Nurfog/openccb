use axum::{
    Json,
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
};
use bcrypt::{DEFAULT_COST, hash, verify};
use common::auth::{Claims, create_jwt};
use common::middleware::Org;
use common::models::{
    AuthResponse, Course, CourseAnalytics, Enrollment, HeatmapPoint, Lesson, LessonAnalytics,
    Module, Notification, Organization, RecommendationResponse, User, UserResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::env;
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

#[derive(Deserialize)]
pub struct AudioGradingPayload {
    pub transcript: String,
    pub prompt: String,
    pub keywords: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct AudioGradingResponse {
    pub score: i32,
    pub found_keywords: Vec<String>,
    pub feedback: String,
}

#[derive(Deserialize)]
pub struct InteractionPayload {
    pub video_timestamp: Option<f64>,
    pub event_type: String, // 'heartbeat', 'pause', 'seek', 'complete', 'start'
    pub metadata: Option<serde_json::Value>,
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let password_hash = hash(payload.password, DEFAULT_COST)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error al procesar la contraseña".into()))?;

    let full_name = payload.full_name.unwrap_or_else(|| {
        payload
            .email
            .split('@')
            .next()
            .unwrap_or("Estudiante")
            .to_string()
    });

    // Use provided organization name or Default Organization
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let organization = if let Some(org_name) = payload.organization_name {
        sqlx::query_as::<_, Organization>(
            "INSERT INTO organizations (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *"
        )
        .bind(&org_name)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al buscar o crear la organización: {}", e)))?
    } else {
        sqlx::query_as::<_, Organization>(
            "SELECT * FROM organizations WHERE id = '00000000-0000-0000-0000-000000000001'",
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Organización por defecto no encontrada".into(),
            )
        })?
    };

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name, organization_id, role) VALUES ($1, $2, $3, $4, 'student') RETURNING *"
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(full_name)
    .bind(organization.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::CONFLICT, format!("El usuario ya existe o error en la BD: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let token = create_jwt(user.id, user.organization_id, "student").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error al generar el token de acceso".into(),
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

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Credenciales inválidas".into()))?;

    if !verify(payload.password, &user.password_hash).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error de verificación".into(),
        )
    })? {
        return Err((StatusCode::UNAUTHORIZED, "Credenciales inválidas".into()));
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
            avatar_url: user.avatar_url,
            bio: user.bio,
            language: user.language,
        },
        token,
    }))
}

#[derive(Deserialize)]
pub struct CatalogQuery {
    pub organization_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
}

pub async fn get_course_catalog(
    State(pool): State<PgPool>,
    Query(query): Query<CatalogQuery>,
) -> Result<Json<Vec<Course>>, StatusCode> {
    tracing::info!("get_course_catalog: org_id={:?}, user_id={:?}", query.organization_id, query.user_id);
    let courses = match (query.organization_id, query.user_id) {
        (Some(org_id), Some(user_id)) => {
            sqlx::query_as::<_, Course>(
                "SELECT DISTINCT c.* FROM courses c 
                 LEFT JOIN enrollments e ON c.id = e.course_id AND e.user_id = $2
                 WHERE c.organization_id = $1 OR c.organization_id = '00000000-0000-0000-0000-000000000001' OR e.id IS NOT NULL"
            )
            .bind(org_id)
            .bind(user_id)
            .fetch_all(&pool)
            .await
        }
        (Some(org_id), None) => {
            sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE organization_id = $1 OR organization_id = '00000000-0000-0000-0000-000000000001'")
                .bind(org_id)
                .fetch_all(&pool)
                .await
        }
        (None, Some(user_id)) => {
            sqlx::query_as::<_, Course>(
                "SELECT DISTINCT c.* FROM courses c 
                 JOIN enrollments e ON c.id = e.course_id 
                 WHERE e.user_id = $1 OR c.organization_id = '00000000-0000-0000-0000-000000000001'"
            )
            .bind(user_id)
            .fetch_all(&pool)
            .await
        }
        (None, None) => {
            sqlx::query_as::<_, Course>("SELECT * FROM courses")
                .fetch_all(&pool)
                .await
        }
    }
    .map_err(|e| {
        tracing::error!("Catalog fetch failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

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
    for pub_module in &payload.modules {
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

        for lesson in &pub_module.lessons {
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

    // 5. Background Ingestion of Knowledge Base
    // We do this after commit to ensure lesson IDs are persistent
    for pub_module in &payload.modules {
        for lesson in &pub_module.lessons {
            let block_content = extract_block_content(&lesson.metadata);
            if !block_content.trim().is_empty() {
                let _ = ingest_lesson_knowledge(&pool, org_id, lesson.id, &block_content).await;
            }
            // Also ingest summary as a high-relevance chunk
            if let Some(summary) = &lesson.summary {
                 let _ = ingest_lesson_knowledge(&pool, org_id, lesson.id, summary).await;
            }
        }
    }

    Ok(StatusCode::OK)
}

pub async fn get_course_outline(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<common::models::PublishedCourse>, StatusCode> {
    tracing::info!("get_course_outline: id={}, caller_org={}", id, org_ctx.id);
    // 1. Fetch Course
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            tracing::error!("get_course_outline: course fetch failed for {}: {}", id, e);
            StatusCode::NOT_FOUND
        })?;

    tracing::info!("get_course_outline: course found, title='{}'", course.title);

    // 2. Fetch Modules
    let modules =
        sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
            .bind(id)
            .fetch_all(&pool)
            .await
            .map_err(|e| {
                tracing::error!("get_course_outline: modules fetch failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    tracing::info!("get_course_outline: found {} modules", modules.len());

    // 3. Fetch Organization
    let organization = sqlx::query_as::<_, common::models::Organization>(
        "SELECT * FROM organizations WHERE id = $1",
    )
    .bind(course.organization_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("get_course_outline: organization fetch failed for {}: {}", course.organization_id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("get_course_outline: organization found: {}", organization.name);

    // 4. Fetch Grading Categories
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1 ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("get_course_outline: grading categories fetch failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 5. Fetch Lessons
    let mut pub_modules = Vec::new();
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>(
            "SELECT * FROM lessons WHERE module_id = $1 ORDER BY position",
        )
        .bind(module.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            tracing::error!("get_course_outline: lessons fetch failed for module {}: {}", module.id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

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
    Org(_org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lesson>, StatusCode> {
    tracing::info!("get_lesson_content: fetching lesson {}", id);
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1")
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
    tracing::info!("get_user_enrollments: user_id={}, caller_org_id={}", user_id, org_ctx.id);
    let enrollments =
        sqlx::query_as::<_, Enrollment>("SELECT * FROM enrollments WHERE user_id = $1")
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
    let max_attempts: Option<Option<i32>> =
        sqlx::query_scalar("SELECT max_attempts FROM lessons WHERE id = $1")
            .bind(payload.lesson_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if max_attempts.is_none() {
        return Err((StatusCode::NOT_FOUND, "Lección no encontrada".into()));
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
                    "Se ha alcanzado el número máximo de intentos para esta evaluación".into(),
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
    let user_stats: (i32, i32) =
        sqlx::query_as("SELECT xp, level FROM users WHERE id = $1 AND organization_id = $2")
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
            avatar_url: u.avatar_url,
            bio: u.bio,
            language: u.language,
        })
        .collect();

    Ok(Json(response))
}

pub async fn get_user_course_grades(
    Org(_org_ctx): Org,
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

pub async fn record_interaction(
    Org(org_ctx): Org,
    Path(lesson_id): Path<Uuid>,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<InteractionPayload>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query(
        "INSERT INTO lesson_interactions (organization_id, user_id, lesson_id, video_timestamp, event_type, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(lesson_id)
    .bind(payload.video_timestamp)
    .bind(payload.event_type)
    .bind(payload.metadata)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to record interaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::CREATED)
}

pub async fn get_lesson_heatmap(
    Org(org_ctx): Org,
    Path(lesson_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<HeatmapPoint>>, StatusCode> {
    let heatmap = sqlx::query_as::<_, HeatmapPoint>(
        "SELECT floor(video_timestamp)::int as second, count(*)::bigint as count 
         FROM lesson_interactions 
         WHERE lesson_id = $1 AND organization_id = $2 AND video_timestamp IS NOT NULL
         GROUP BY second 
         ORDER BY second",
    )
    .bind(lesson_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch heatmap: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(heatmap))
}

pub async fn get_notifications(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Notification>>, StatusCode> {
    let notifications = sqlx::query_as::<_, Notification>(
        "SELECT * FROM notifications WHERE user_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 50"
    )
    .bind(claims.sub)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch notifications: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(notifications))
}

pub async fn mark_notification_as_read(
    Org(org_ctx): Org,
    claims: Claims,
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 AND organization_id = $3"
    )
    .bind(id)
    .bind(claims.sub)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to mark notification as read: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::OK)
}

pub async fn check_deadlines_and_notify(pool: PgPool) {
    let result = sqlx::query(
        "INSERT INTO notifications (organization_id, user_id, title, message, notification_type, link_url)
         SELECT 
            l.organization_id, 
            e.user_id, 
            'Fecha límite próxima: ' || l.title,
            'La lección \"' || l.title || '\" del curso \"' || c.title || '\" vence en menos de 24 horas.',
            'deadline',
            '/courses/' || c.id || '/lessons/' || l.id
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         JOIN modules m ON m.course_id = c.id
         JOIN lessons l ON l.module_id = m.id
         WHERE l.due_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
         AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = e.user_id 
            AND n.notification_type = 'deadline' 
            AND n.link_url = '/courses/' || c.id || '/lessons/' || l.id
            AND n.created_at > NOW() - INTERVAL '48 hours'
         )"
    )
    .execute(&pool)
    .await;

    if let Err(e) = result {
        tracing::error!("Failed to run deadline notifications: {}", e);
    }
}

pub async fn update_user(
    Org(org_ctx): Org,
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    if claims.sub != id {
        return Err((StatusCode::FORBIDDEN, "No autorizado".into()));
    }

    let full_name = payload.get("full_name").and_then(|f| f.as_str());
    let avatar_url = payload.get("avatar_url").and_then(|v| v.as_str());
    let bio = payload.get("bio").and_then(|v| v.as_str());
    let language = payload.get("language").and_then(|v| v.as_str());

    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET full_name = COALESCE($1, full_name), avatar_url = COALESCE($2, avatar_url), bio = COALESCE($3, bio), language = COALESCE($4, language) WHERE id = $5 AND organization_id = $6 RETURNING *"
    )
    .bind(full_name)
    .bind(avatar_url)
    .bind(bio)
    .bind(language)
    .bind(id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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

pub async fn get_recommendations(
    Org(_org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<RecommendationResponse>, (StatusCode, String)> {
    let user_id = claims.sub;

    // 1. Fetch performance data (recent grades)
    let grades: Vec<common::models::UserGrade> = sqlx::query_as::<_, common::models::UserGrade>(
        "SELECT * FROM user_grades WHERE user_id = $1 AND course_id = $2 ORDER BY created_at DESC LIMIT 10"
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Fetch lesson metadata (titles) for context
    #[derive(sqlx::FromRow)]
    struct LessonContext {
        id: Uuid,
        title: String,
    }

    let lessons =
        sqlx::query_as::<_, LessonContext>("SELECT id, title FROM lessons WHERE course_id = $1")
            .bind(course_id)
            .fetch_all(&pool)
            .await
            .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Prepare AI context
    let mut performance_summary = String::new();
    for grade in &grades {
        let lesson_title = lessons
            .iter()
            .find(|l| l.id == grade.lesson_id)
            .map(|l| l.title.clone())
            .unwrap_or_else(|| "Lección desconocida".to_string());

        performance_summary.push_str(&format!(
            "- Lesson: {}, Score: {}%\n",
            lesson_title,
            (grade.score * 100.0) as i32
        ));
    }

    if performance_summary.is_empty() {
        performance_summary = "El estudiante aún no ha completado ninguna evaluación.".to_string();
    }

    // 4. Call Ollama
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url =
            env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://ollama:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3:8b".to_string());
        (
            format!("{}/v1/chat/completions", base_url),
            "".to_string(),
            model,
        )
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4-turbo".to_string(),
        )
    };

    let response = client.post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un tutor de inglés profesional y empático. Basándote en el desempeño del estudiante, sugiere 3 recomendaciones de estudio altamente personalizadas para mejorar sus habilidades en inglés (gramática, vocabulario, habla). Enfócate en las áreas donde obtuvo puntuaciones bajas. Devuelve ÚNICAMENTE un objeto JSON válido que comience con { \"recommendations\": [...] }. Cada objeto DEBE tener: 'title', 'description', 'lesson_id' (un UUID válido o null), 'priority' ('high', 'medium', 'low') y 'reason'. Responde en español con un tono motivador y alentador."
                },
                {
                    "role": "user",
                    "content": format!("Desempeño del estudiante en el curso:\n{}", performance_summary)
                }
            ],
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|e: reqwest::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let ai_response: RecommendationResponse = response
        .json()
        .await
        .map_err(|e: reqwest::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ai_response))
}

pub async fn evaluate_audio_response(
    Org(_org_ctx): Org,
    _claims: Claims,
    Json(payload): Json<AudioGradingPayload>,
) -> Result<Json<AudioGradingResponse>, (StatusCode, String)> {
    let client = reqwest::Client::new();
    
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let (url, auth_header, model) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://ollama:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3:8b".to_string());
        (format!("{}/v1/chat/completions", base_url), "".to_string(), model)
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4-turbo".to_string(),
        )
    };

    let system_prompt = "Eres un profesor de inglés experto. Evalúa la transcripción de la respuesta hablada del estudiante. \
        Compárala con el prompt y las palabras clave esperadas. \
        Proporciona una puntuación de 0 a 100. \
        Identifica qué palabras clave fueron utilizadas. \
        Da retroalimentación constructiva en español sobre su pronunciación (basándote en la calidad de la transcripción) y contenido. \
        Devuelve ÚNICAMENTE un objeto JSON: { \"score\": number, \"found_keywords\": [string], \"feedback\": string }.";

    let user_content = format!(
        "Prompt: {}\nExpected Keywords: {:?}\nStudent Transcript: {}",
        payload.prompt, payload.keywords, payload.transcript
    );

    let response = client.post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_content }
            ],
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let ai_data: serde_json::Value = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("AI response parse failed: {}", e)))?;

    let grading: AudioGradingResponse = serde_json::from_value(
        ai_data["choices"][0]["message"]["content"]
            .as_str()
            .and_then(|c| serde_json::from_str(c).ok())
            .unwrap_or_else(|| {
                // Fallback in case AI doesn't return clean JSON
                serde_json::json!({
                    "score": 50,
                    "found_keywords": vec![] as Vec<String>,
                    "feedback": "Lo siento, tuve un problema analizando tu respuesta. ¡Sigue practicando!"
                })
            })
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Mapping failed: {}", e)))?;

    Ok(Json(grading))
}

pub async fn evaluate_audio_file(
    Org(_org_ctx): Org,
    _claims: Claims,
    mut multipart: Multipart,
) -> Result<Json<AudioGradingResponse>, (StatusCode, String)> {
    let mut prompt = String::new();
    let mut keywords_str = String::new();
    let mut audio_data = Vec::new();
    let mut filename = "audio.webm".to_string();

    while let Some(field) = multipart.next_field().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "prompt" => prompt = field.text().await.unwrap_or_default(),
            "keywords" => keywords_str = field.text().await.unwrap_or_default(),
            "file" => {
                filename = field.file_name().unwrap_or("audio.webm").to_string();
                audio_data = field.bytes().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.to_vec();
            },
            _ => {}
        }
    }

    if audio_data.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No se proporcionó ningún archivo de audio".into()));
    }

    // 1. Send to Whisper
    let whisper_url = env::var("LOCAL_WHISPER_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());
    let client = reqwest::Client::new();
    
    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(audio_data).file_name(filename))
        .text("model", "whisper-1")
        .text("response_format", "json");

    let response = client.post(format!("{}/v1/audio/transcriptions", whisper_url))
        .multipart(form)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error en la solicitud a Whisper: {}", e)))?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        tracing::error!("Whisper error: {}", err_body);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Error de la API de Whisper: {}", err_body)));
    }

    let transcription_result: serde_json::Value = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al analizar la respuesta de Whisper: {}", e)))?;

    let transcript = transcription_result["text"].as_str().unwrap_or("").to_string();
    
    if transcript.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Whisper no pudo detectar voz. Por favor, habla más fuerte o revisa tu micrófono.".into()));
    }

    let keywords: Vec<String> = if keywords_str.trim().starts_with('[') {
        serde_json::from_str(&keywords_str).unwrap_or_default()
    } else {
        keywords_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
    };

    // 2. Perform AI Grading
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let (url, auth_header, model) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://ollama:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3:8b".to_string());
        (format!("{}/v1/chat/completions", base_url), "".to_string(), model)
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4-turbo".to_string(),
        )
    };

    let system_prompt = "Eres un profesor experto. Evalúa la transcripción de la respuesta hablada del estudiante. \
        Compárala con el prompt y las palabras clave esperadas. \
        Proporciona una puntuación de 0 a 100. \
        Identifica qué palabras clave fueron utilizadas. \
        Da retroalimentación constructiva en español sobre su pronunciación (basándote en la calidad de la transcripción) y contenido. \
        Devuelve ÚNICAMENTE un objeto JSON: { \"score\": number, \"found_keywords\": [string], \"feedback\": string }.";

    let user_content = format!(
        "Prompt: {}\nExpected Keywords: {:?}\nStudent Transcript: {}",
        prompt, keywords, transcript
    );

    let response = client.post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_content }
            ],
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error en la solicitud de IA: {}", e)))?;

    let ai_data: serde_json::Value = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al analizar la respuesta de la IA: {}", e)))?;

    let grading: AudioGradingResponse = serde_json::from_value(
        ai_data["choices"][0]["message"]["content"]
            .as_str()
            .and_then(|c| serde_json::from_str(c).ok())
            .unwrap_or_else(|| {
                serde_json::json!({
                    "score": 50,
                    "found_keywords": vec![] as Vec<String>,
                    "feedback": "Lo siento, tuve un problema analizando tu respuesta con Whisper. ¡Sigue practicando!"
                })
            })
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Mapping failed: {}", e)))?;

    Ok(Json(grading))
}

#[derive(Deserialize)]
pub struct ChatPayload {
    pub message: String,
    pub session_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub response: String,
    pub session_id: Uuid,
}

pub async fn chat_with_tutor(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
    Json(payload): Json<ChatPayload>,
) -> Result<Json<ChatResponse>, (StatusCode, String)> {
    // 1. Fetch lesson context (summary and transcription)
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(lesson_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Lección no encontrada".into()))?;

    // 1.5 Fetch previous lessons in the course for context
    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = $1")
        .bind(lesson.module_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error al obtener el contexto del módulo".into()))?;

    let previous_lessons = sqlx::query(
        r#"
        SELECT l.title, l.summary
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = $1
          AND (m.position < $2 OR (m.position = $2 AND l.position < $3))
        ORDER BY m.position, l.position
        "#,
    )
    .bind(module.course_id)
    .bind(module.position)
    .bind(lesson.position)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch previous lessons".into()))?;

    let mut history_context = String::new();
    if !previous_lessons.is_empty() {
        history_context.push_str("\n--- PAST LESSONS HISTORY (FOR CONTEXT) ---\n");
        for prev in previous_lessons {
            use sqlx::Row;
            let title: String = prev.get("title");
            let summary: Option<String> = prev.get("summary");
            history_context.push_str(&format!(
                "Past Lesson: {}\nSummary: {}\n\n",
                title,
                summary.as_deref().unwrap_or("No hay resumen disponible.")
            ));
        }
    }

    let block_content = extract_block_content(&lesson.metadata);

    let context = format!(
        "CURRENT Lesson Title: {}\nSummary: {}\nTranscription (Partial): {}\n\n--- CURRENT LESSON CONTENT (BLOCKS & ACTIVITIES) ---\n{}\n{}",
        lesson.title,
        lesson.summary.as_deref().unwrap_or_default(),
        lesson.transcription.as_ref().and_then(|t| t.get("text").and_then(|text| text.as_str())).unwrap_or("No hay transcripción disponible."),
        block_content,
        history_context
    );

    // 2. Setup AI request
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    // 2.1 Handle Session and Memory
    let session_id = if let Some(sid) = payload.session_id {
        sid
    } else {
        let row = sqlx::query(
            "INSERT INTO chat_sessions (organization_id, user_id, lesson_id, title) VALUES ($1, $2, $3, $4) RETURNING id"
        )
        .bind(org_ctx.id)
        .bind(claims.sub)
        .bind(Some(lesson_id))
        .bind(format!("Chat sobre {}", lesson.title))
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create chat session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Error al crear la sesión de chat".into())
        })?;
    
        use sqlx::Row;
        let sid: Uuid = row.get(0);
        sid
    };

    // Save user message
    sqlx::query(
        "INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)"
    )
    .bind(session_id)
    .bind("user")
    .bind(&payload.message)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to save user message".into()))?;

    // Fetch last 6 messages for context
    let history_rows = sqlx::query(
        "SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 6"
    )
    .bind(session_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let mut memory_context = String::new();
    if !history_rows.is_empty() {
        memory_context.push_str("\n--- HISTORIAL RECIENTE DE LA CONVERSACIÓN ---\n");
        // Reverse to get chronological order
        for row in history_rows.into_iter().rev() {
            let role: String = row.get("role");
            let content: String = row.get("content");
            memory_context.push_str(&format!("{}: {}\n", role.to_uppercase(), content));
        }
    }

    // 2.2 Knowledge Base Retrieval (RAG)
    let search_results = sqlx::query(
        r#"
        SELECT content_chunk
        FROM knowledge_base
        WHERE organization_id = $1
          AND search_vector @@ plainto_tsquery('english', $2)
        LIMIT 3
        "#,
    )
    .bind(org_ctx.id)
    .bind(&payload.message)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let mut kb_context = String::new();
    if !search_results.is_empty() {
        kb_context.push_str("\n--- CONTEXTO ADICIONAL DE LA BASE DE CONOCIMIENTOS ---\n");
        for row in search_results {
            let chunk: String = row.get("content_chunk");
            kb_context.push_str(&format!("Relevant Snippet: {}\n\n", chunk));
        }
    }

    let (url, auth_header, model) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://ollama:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3:8b".to_string());
        (format!("{}/v1/chat/completions", base_url), "".to_string(), model)
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4-turbo".to_string(),
        )
    };

    let system_prompt = format!(
        "Eres un asistente pedagógico de IA experto para la plataforma OpenCCB. \
        Tu propósito es ayudar al estudiante a comprender el contenido de esta lección y cómo se relaciona con las lecciones anteriores del curso. \
        \
        REGLAS ESTRICTAS: \
        1. Solo puedes responder preguntas relacionadas con la lección ACTUAL, las lecciones PASADAS o el CONTEXTO de la BASE DE CONOCIMIENTOS proporcionado. \
        2. Si un estudiante pregunta sobre temas NO cubiertos en los contextos proporcionados (ej. cultura general, temas futuros o conversaciones fuera de tema), \
        DEBES rechazar cortésmente y recordarle que estás aquí solo para ayudar con el contenido del curso hasta este punto. \
        3. CRÍTICO: NO proporciones respuestas directas para las actividades, cuestionarios o ejercicios de código de la lección ACTUAL. \
        Incluso si la respuesta está en la memoria o base de conocimientos, solo debes proporcionar pistas o explicar conceptos. \
        4. Usa el HISTORIAL DE LA CONVERSACIÓN para mantener la continuidad y brindar ayuda personalizada basada en preguntas anteriores. \
        5. Mantén un tono de apoyo, alentador y educativo. \
        6. Responde en el mismo idioma de la pregunta del estudiante. \
        \
        CONTEXTO DE LA LECCIÓN E HISTORIAL:\n{}\n{}\n{}",
        context,
        memory_context,
        kb_context
    );

    let response = client.post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": payload.message }
            ],
            "temperature": 0.7
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error en la solicitud de IA: {}", e)))?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Error de la API de IA: {}", err_body)));
    }

    let ai_data: serde_json::Value = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al analizar la respuesta de la IA: {}", e)))?;

    let tutor_response = ai_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Lo siento, tuve un problema procesando tu pregunta.")
        .to_string();

    // Save assistant response
    let _ = sqlx::query(
        "INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)"
    )
    .bind(session_id)
    .bind("assistant")
    .bind(&tutor_response)
    .execute(&pool)
    .await;

    Ok(Json(ChatResponse { 
        response: tutor_response,
        session_id,
    }))
}

pub async fn get_lesson_feedback(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
) -> Result<Json<ChatResponse>, (StatusCode, String)> {
    let user_id = claims.sub;

    // 1. Fetch lesson context
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = $1 AND organization_id = $2")
        .bind(lesson_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Lección no encontrada".into()))?;

    // 2. Fetch user's grade for this lesson
    let grade = sqlx::query_as::<_, common::models::UserGrade>(
        "SELECT * FROM user_grades WHERE user_id = $1 AND lesson_id = $2"
    )
    .bind(user_id)
    .bind(lesson_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::BAD_REQUEST, "No se encontró calificación para esta lección".into()))?;

    let score_pct = (grade.score * 100.0) as i32;

    let block_content = extract_block_content(&lesson.metadata);

    let context = format!(
        "Lesson Title: {}\nSummary: {}\nStudent Score: {}%\nMax Attempts: {}\nAttempts Used: {}\n\n--- LESSON CONTENT ---\n{}",
        lesson.title,
        lesson.summary.as_deref().unwrap_or_default(),
        score_pct,
        lesson.max_attempts.unwrap_or(0),
        grade.attempts_count,
        block_content
    );

    // 3. Setup AI request
    let provider = env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string());
    let client = reqwest::Client::new();

    let (url, auth_header, model) = if provider == "local" {
        let base_url = env::var("LOCAL_OLLAMA_URL").unwrap_or_else(|_| "http://ollama:11434".to_string());
        let model = env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "llama3:8b".to_string());
        (format!("{}/v1/chat/completions", base_url), "".to_string(), model)
    } else {
        (
            "https://api.openai.com/v1/chat/completions".to_string(),
            format!("Bearer {}", env::var("OPENAI_API_KEY").unwrap_or_default()),
            "gpt-4-turbo".to_string(),
        )
    };

    let system_prompt = format!(
        "Eres un asistente pedagógico de IA experto. El estudiante ha completado una evaluación calificada y ahora está viendo sus resultados finales. \
        Proporciona un mensaje personalizado basado en su puntuación ({}%). \
        \
        REGLAS ESTRICTAS: \
        1. Basa tu retroalimentación ÚNICAMENTE en el contenido de la lección y el desempeño del estudiante. \
        2. Si la puntuación es alta (>= 80%), felicítalo calurosamente. \
        3. Si la puntuación es media (60-79%), reconoce su esfuerzo y sugiere áreas específicas para mejorar basadas en el contenido de la lección. \
        4. Si la puntuación es baja (< 60%), brinda aliento y numera temas específicos o bloques relacionados que debería repetir o revisar para mejorar. \
        5. Mantén el mensaje conciso, de apoyo y profesional. \
        6. Responde en español ya que la plataforma se usa principalmente en ese idioma. \
        \
        CONTEXTO DE LA LECCIÓN:\n{}",
        score_pct,
        context
    );

    let response = client.post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": "Genera mi retroalimentación personalizada basada en mis resultados." }
            ],
            "temperature": 0.7
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error en la solicitud de IA: {}", e)))?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Error de la API de IA: {}", err_body)));
    }

    let ai_data: serde_json::Value = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al analizar la respuesta de la IA: {}", e)))?;

    let tutor_response = ai_data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Buen trabajo completando la lección. Revisa tus resultados arriba.")
        .to_string();

    Ok(Json(ChatResponse { 
        response: tutor_response,
        session_id: Uuid::nil(),
    }))
}



pub async fn ingest_lesson_knowledge(
    pool: &PgPool,
    org_id: Uuid,
    lesson_id: Uuid,
    content: &str,
) -> Result<(), sqlx::Error> {
    // Split content into chunks of ~1000 characters for better RAG granularity
    let chunks: Vec<&str> = content.as_bytes()
        .chunks(1000)
        .map(|c| std::str::from_utf8(c).unwrap_or(""))
        .collect();

    for chunk in chunks {
        if chunk.trim().is_empty() { continue; }
        
        sqlx::query(
            "INSERT INTO knowledge_base (organization_id, source_type, source_id, content_chunk) 
             VALUES ($1, $2, $3, $4)"
        )
        .bind(org_id)
        .bind("lesson_content")
        .bind(Some(lesson_id))
        .bind(chunk)
        .execute(pool)
        .await?;
    }
    Ok(())
}

fn extract_block_content(metadata: &Option<serde_json::Value>) -> String {
    let mut block_content = String::new();
    if let Some(meta) = metadata {
        if let Some(blocks) = meta.get("blocks").and_then(|b| b.as_array()) {
            for block in blocks {
                let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                let title = block.get("title").and_then(|t| t.as_str()).unwrap_or("");
                
                block_content.push_str(&format!("\n--- Block: {} ({}) ---\n", title, block_type));
                
                match block_type {
                    "description" | "fill-in-the-blanks" => {
                        if let Some(content) = block.get("content").and_then(|c| c.as_str()) {
                            block_content.push_str(content);
                        }
                    }
                    "quiz" => {
                        if let Some(questions) = block.get("quiz_data").and_then(|q| q.get("questions")).and_then(|qs| qs.as_array()) {
                            for (i, q) in questions.iter().enumerate() {
                                let question_text = q.get("question").and_then(|qt| qt.as_str()).unwrap_or("");
                                block_content.push_str(&format!("Q{}: {}\n", i + 1, question_text));
                            }
                        }
                    }
                    "matching" | "memory-match" => {
                        if let Some(pairs) = block.get("pairs").and_then(|p| p.as_array()) {
                            for (i, p) in pairs.iter().enumerate() {
                                let left = p.get("left").and_then(|l| l.as_str()).unwrap_or("");
                                let right = p.get("right").and_then(|r| r.as_str()).unwrap_or("");
                                block_content.push_str(&format!("Pair {}: {} <-> {}\n", i + 1, left, right));
                            }
                        }
                    }
                    "ordering" => {
                         if let Some(items) = block.get("items").and_then(|i| i.as_array()) {
                            for (i, item) in items.iter().enumerate() {
                                let text = item.as_str().unwrap_or("");
                                block_content.push_str(&format!("Item {}: {}\n", i + 1, text));
                            }
                        }
                    }
                    "short-answer" | "audio-response" => {
                        if let Some(prompt) = block.get("prompt").and_then(|p| p.as_str()) {
                            block_content.push_str(&format!("Prompt: {}\n", prompt));
                        }
                    }
                    "code" => {
                        if let Some(instructions) = block.get("instructions").and_then(|i| i.as_str()) {
                            block_content.push_str(&format!("Instructions: {}\n", instructions));
                        }
                    }
                    "document" => {
                        if let Some(desc) = block.get("description").and_then(|d| d.as_str()) {
                            block_content.push_str(&format!("Document Description: {}\n", desc));
                        }
                    }
                    "hotspot" => {
                        if let Some(description) = block.get("description").and_then(|d| d.as_str()) {
                             block_content.push_str(&format!("Hotspot Activity Description: {}\n", description));
                        }
                    }
                    _ => {}
                }
                block_content.push_str("\n");
            }
        }
    }
    block_content
}
