use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use common::models::{AnnouncementWithAuthor, CourseAnnouncement};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

// ========== DTOs de Solicitud/Respuesta ==========

#[derive(Deserialize)]
pub struct CreateAnnouncementPayload {
    pub title: String,
    pub content: String,
    pub is_pinned: Option<bool>,
    pub cohort_ids: Option<Vec<Uuid>>,
}

#[derive(Deserialize)]
pub struct UpdateAnnouncementPayload {
    pub title: Option<String>,
    pub content: Option<String>,
    pub is_pinned: Option<bool>,
}

fn is_instructor_or_admin(role: &str) -> bool {
    role == "instructor" || role == "admin"
}

fn normalize_lms_role(role: &str) -> &'static str {
    match role {
        "admin" => "admin",
        "instructor" => "instructor",
        _ => "student",
    }
}

async fn ensure_announcement_author_exists(
    pool: &PgPool,
    user_id: Uuid,
    organization_id: Uuid,
    role: &str,
) -> Result<(), (StatusCode, String)> {
    let exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)")
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if exists {
        return Ok(());
    }

    let synthetic_email = format!("user-{}@openccb.local", user_id);
    let synthetic_name = format!("Usuario {}", &user_id.to_string()[..8]);
    let normalized_role = normalize_lms_role(role);

    sqlx::query(
        "INSERT INTO users (id, email, password_hash, full_name, organization_id, role)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(user_id)
    .bind(&synthetic_email)
    .bind("external-auth")
    .bind(&synthetic_name)
    .bind(organization_id)
    .bind(normalized_role)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("No se pudo provisionar usuario LMS: {}", e)))?;

    Ok(())
}

// ========== MANEJADORES ==========

pub async fn list_announcements(
    Org(org_ctx): Org,
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<AnnouncementWithAuthor>>, (StatusCode, String)> {
    let mut announcements = sqlx::query_as::<_, AnnouncementWithAuthor>(
        "SELECT 
            a.*,
            u.full_name as author_name,
            u.avatar_url as author_avatar
        FROM course_announcements a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.course_id = $1 AND a.organization_id = $2
        ORDER BY a.is_pinned DESC, a.created_at DESC",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Adjuntar cohort_ids a cada anuncio
    for a in &mut announcements {
        let cohorts: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT cohort_id FROM announcement_cohorts WHERE announcement_id = $1"
        )
        .bind(a.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if !cohorts.is_empty() {
            a.cohort_ids = Some(cohorts.into_iter().map(|c| c.0).collect());
        }
    }

    Ok(Json(announcements))
}

pub async fn create_announcement(
    Org(org_ctx): Org,
    claims: Claims,
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateAnnouncementPayload>,
) -> Result<Json<CourseAnnouncement>, (StatusCode, String)> {
    if !is_instructor_or_admin(&claims.role) {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los instructores pueden crear anuncios".to_string(),
        ));
    }

    ensure_announcement_author_exists(&pool, claims.sub, org_ctx.id, &claims.role).await?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 1. Crear anuncio
    let mut announcement = sqlx::query_as::<_, CourseAnnouncement>(
        "INSERT INTO course_announcements (organization_id, course_id, author_id, title, content, is_pinned)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *"
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .bind(claims.sub)
    .bind(&payload.title)
    .bind(&payload.content)
    .bind(payload.is_pinned.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Vincular cohortes si se proporcionan
    if let Some(ref cohort_ids) = payload.cohort_ids {
        for cohort_id in cohort_ids {
            sqlx::query(
                "INSERT INTO announcement_cohorts (announcement_id, cohort_id) VALUES ($1, $2)",
            )
            .bind(announcement.id)
            .bind(cohort_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
        announcement.cohort_ids = Some(cohort_ids.clone());
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Obtener estudiantes objetivo para notificaciones
    let enrolled_students = if let Some(ref cohort_ids) = payload.cohort_ids {
        if !cohort_ids.is_empty() {
            sqlx::query_as::<_, (Uuid,)>(
                "SELECT DISTINCT uc.user_id 
                 FROM user_cohorts uc 
                 JOIN enrollments e ON uc.user_id = e.user_id AND e.course_id = $1
                 WHERE uc.cohort_id = ANY($2) AND uc.user_id != $3",
            )
            .bind(course_id)
            .bind(cohort_ids)
            .bind(claims.sub)
            .fetch_all(&pool)
            .await
        } else {
            // Recurrir a todos si se proporciona una lista vacía (aunque la interfaz debería evitarlo)
            sqlx::query_as::<_, (Uuid,)>(
                "SELECT user_id FROM enrollments WHERE course_id = $1 AND user_id != $2",
            )
            .bind(course_id)
            .bind(claims.sub)
            .fetch_all(&pool)
            .await
        }
    } else {
        // No se proporcionó segmento -> todos en el curso
        sqlx::query_as::<_, (Uuid,)>(
            "SELECT user_id FROM enrollments WHERE course_id = $1 AND user_id != $2",
        )
        .bind(course_id)
        .bind(claims.sub)
        .fetch_all(&pool)
        .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Crear notificación para cada estudiante inscrito
    for (student_id,) in enrolled_students {
        let notification_title = format!("Nuevo Anuncio: {}", payload.title);
        let notification_message = if payload.content.len() > 100 {
            format!("{}...", &payload.content[..100])
        } else {
            payload.content.clone()
        };

        let _ = sqlx::query(
            "INSERT INTO notifications (organization_id, user_id, title, message, notification_type, link_url)
             VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(org_ctx.id)
        .bind(student_id)
        .bind(notification_title)
        .bind(notification_message)
        .bind("announcement")
        .bind(format!("/courses/{}#announcements", course_id))
        .execute(&pool)
        .await;
    }

    Ok(Json(announcement))
}

pub async fn update_announcement(
    Org(org_ctx): Org,
    claims: Claims,
    Path(announcement_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateAnnouncementPayload>,
) -> Result<Json<CourseAnnouncement>, (StatusCode, String)> {
    if !is_instructor_or_admin(&claims.role) {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los instructores pueden actualizar anuncios".to_string(),
        ));
    }

    // Obtener el anuncio actual para verificar la propiedad
    let current = sqlx::query_as::<_, CourseAnnouncement>(
        "SELECT * FROM course_announcements WHERE id = $1 AND organization_id = $2",
    )
    .bind(announcement_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::NOT_FOUND, "Anuncio no encontrado".to_string()))?;

    let title = payload.title.unwrap_or(current.title);
    let content = payload.content.unwrap_or(current.content);
    let is_pinned = payload.is_pinned.unwrap_or(current.is_pinned);

    let announcement = sqlx::query_as::<_, CourseAnnouncement>(
        "UPDATE course_announcements 
         SET title = $1, content = $2, is_pinned = $3
         WHERE id = $4 AND organization_id = $5
         RETURNING *",
    )
    .bind(title)
    .bind(content)
    .bind(is_pinned)
    .bind(announcement_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(announcement))
}

pub async fn delete_announcement(
    Org(org_ctx): Org,
    claims: Claims,
    Path(announcement_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    if !is_instructor_or_admin(&claims.role) {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los instructores pueden eliminar anuncios".to_string(),
        ));
    }

    sqlx::query(
        "DELETE FROM course_announcements 
         WHERE id = $1 AND organization_id = $2",
    )
    .bind(announcement_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}
