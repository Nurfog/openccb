use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use common::auth::Claims;
use common::models::{Badge, UserBadge, PublicProfile};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub async fn get_public_profile(
    Path(user_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<PublicProfile>, (StatusCode, String)> {
    let user = sqlx::query("SELECT id, full_name, avatar_url, bio, level, xp, is_public_profile FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let is_public: bool = user.get("is_public_profile");
    if !is_public {
        return Err((StatusCode::FORBIDDEN, "This profile is private".to_string()));
    }

    let badges = sqlx::query_as::<sqlx::Postgres, Badge>(
        r#"
        SELECT b.* FROM badges b
        JOIN user_badges ub ON b.id = ub.badge_id
        WHERE ub.user_id = $1
        "#
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let completed_courses: i64 = sqlx::query("SELECT COUNT(*) FROM enrollments WHERE user_id = $1 AND progress_percentage >= 100")
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .get(0);

    Ok(Json(PublicProfile {
        user_id,
        full_name: user.get("full_name"),
        avatar_url: user.get("avatar_url"),
        bio: user.get("bio"),
        badges,
        level: user.get("level"),
        xp: user.get("xp"),
        completed_courses_count: completed_courses,
    }))
}

pub async fn get_my_badges(
    claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Badge>>, (StatusCode, String)> {
    let badges = sqlx::query_as::<sqlx::Postgres, Badge>(
        r#"
        SELECT b.* FROM badges b
        JOIN user_badges ub ON b.id = ub.badge_id
        WHERE ub.user_id = $1
        "#
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(badges))
}

pub async fn award_badge(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(payload): Json<UserBadge>,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role == "student" {
        return Err((StatusCode::FORBIDDEN, "Only admins can award badges manually".to_string()));
    }

    sqlx::query("INSERT INTO user_badges (user_id, badge_id, awarded_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING")
        .bind(payload.user_id)
        .bind(payload.badge_id)
        .execute(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::CREATED)
}
