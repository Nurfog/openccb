use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use common::models::{CourseAnnouncement, AnnouncementWithAuthor};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

// ========== Request/Response DTOs ==========

#[derive(Deserialize)]
pub struct CreateAnnouncementPayload {
    pub title: String,
    pub content: String,
    pub is_pinned: Option<bool>,
}

#[derive(Deserialize)]
pub struct UpdateAnnouncementPayload {
    pub title: Option<String>,
    pub content: Option<String>,
    pub is_pinned: Option<bool>,
}

// ========== HANDLERS ==========

pub async fn list_announcements(
    Org(org_ctx): Org,
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<AnnouncementWithAuthor>>, (StatusCode, String)> {
    let announcements = sqlx::query_as::<_, AnnouncementWithAuthor>(
        "SELECT 
            a.*,
            u.full_name as author_name,
            u.avatar_url as author_avatar
        FROM course_announcements a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.course_id = $1 AND a.organization_id = $2
        ORDER BY a.is_pinned DESC, a.created_at DESC"
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(announcements))
}

pub async fn create_announcement(
    Org(org_ctx): Org,
    claims: Claims,
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateAnnouncementPayload>,
) -> Result<Json<CourseAnnouncement>, (StatusCode, String)> {
    // Check if user is instructor or admin
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((StatusCode::FORBIDDEN, "Only instructors can create announcements".to_string()));
    }

    // Create announcement
    let announcement = sqlx::query_as::<_, CourseAnnouncement>(
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
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get all enrolled students for notifications
    let enrolled_students = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM enrollments WHERE course_id = $1 AND user_id != $2"
    )
    .bind(course_id)
    .bind(claims.sub) // Exclude the announcement author
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create notification for each enrolled student
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
    // Check if user is instructor or admin
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((StatusCode::FORBIDDEN, "Only instructors can update announcements".to_string()));
    }

    // Get current announcement to verify ownership
    let current = sqlx::query_as::<_, CourseAnnouncement>(
        "SELECT * FROM course_announcements WHERE id = $1 AND organization_id = $2"
    )
    .bind(announcement_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::NOT_FOUND, "Announcement not found".to_string()))?;

    let title = payload.title.unwrap_or(current.title);
    let content = payload.content.unwrap_or(current.content);
    let is_pinned = payload.is_pinned.unwrap_or(current.is_pinned);

    let announcement = sqlx::query_as::<_, CourseAnnouncement>(
        "UPDATE course_announcements 
         SET title = $1, content = $2, is_pinned = $3
         WHERE id = $4 AND organization_id = $5
         RETURNING *"
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
    // Check if user is instructor or admin
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((StatusCode::FORBIDDEN, "Only instructors can delete announcements".to_string()));
    }

    sqlx::query(
        "DELETE FROM course_announcements 
         WHERE id = $1 AND organization_id = $2"
    )
    .bind(announcement_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}
