use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use common::models::{DiscussionPost, DiscussionThread, PostWithAuthor, ThreadWithAuthor};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

// ========== Request/Response DTOs ==========

#[derive(Deserialize)]
pub struct CreateThreadPayload {
    pub title: String,
    pub content: String,
    pub lesson_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct CreatePostPayload {
    pub content: String,
    pub parent_post_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct VotePayload {
    pub vote_type: String, // 'upvote' or 'downvote'
}

#[derive(Deserialize)]
pub struct ThreadListQuery {
    pub lesson_id: Option<Uuid>,
    pub filter: Option<String>, // 'all', 'my_threads', 'unanswered', 'resolved'
    pub page: Option<i64>,
}

// ========== THREAD HANDLERS ==========

pub async fn list_threads(
    Org(org_ctx): Org,
    claims: Claims,
    Path(course_id): Path<Uuid>,
    Query(params): Query<ThreadListQuery>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<ThreadWithAuthor>>, (StatusCode, String)> {
    let page = params.page.unwrap_or(1);
    let limit = 50i64;
    let offset = (page - 1) * limit;

    let mut query = String::from(
        "SELECT 
            t.*, 
            u.full_name as author_name,
            u.avatar_url as author_avatar,
            COUNT(DISTINCT p.id) as post_count,
            BOOL_OR(p.is_endorsed) as has_endorsed_answer
        FROM discussion_threads t
        LEFT JOIN users u ON t.author_id = u.id
        LEFT JOIN discussion_posts p ON t.id = p.thread_id
        WHERE t.course_id = $1 AND t.organization_id = $2",
    );

    let mut bind_count = 2;

    if let Some(_lesson_id) = params.lesson_id {
        bind_count += 1;
        query.push_str(&format!(" AND t.lesson_id = ${}", bind_count));
    }

    if let Some(filter) = &params.filter {
        match filter.as_str() {
            "my_threads" => {
                bind_count += 1;
                query.push_str(&format!(" AND t.author_id = ${}", bind_count));
            }
            "unanswered" => {
                query.push_str(
                    " AND NOT EXISTS (SELECT 1 FROM discussion_posts WHERE thread_id = t.id)",
                );
            }
            "resolved" => {
                query.push_str(" AND EXISTS (SELECT 1 FROM discussion_posts WHERE thread_id = t.id AND is_endorsed = true)");
            }
            _ => {} // 'all' or unknown
        }
    }

    query.push_str(" GROUP BY t.id, u.full_name, u.avatar_url ORDER BY t.is_pinned DESC, t.updated_at DESC LIMIT $");
    bind_count += 1;
    query.push_str(&bind_count.to_string());
    query.push_str(" OFFSET $");
    bind_count += 1;
    query.push_str(&bind_count.to_string());

    let mut sql_query = sqlx::query_as::<_, ThreadWithAuthor>(&query)
        .bind(course_id)
        .bind(org_ctx.id);

    if let Some(lesson_id) = params.lesson_id {
        sql_query = sql_query.bind(lesson_id);
    }

    if let Some(filter) = &params.filter {
        if filter == "my_threads" {
            sql_query = sql_query.bind(claims.sub);
        }
    }

    sql_query = sql_query.bind(limit).bind(offset);

    let threads = sql_query
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(threads))
}

pub async fn create_thread(
    Org(org_ctx): Org,
    claims: Claims,
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateThreadPayload>,
) -> Result<Json<DiscussionThread>, (StatusCode, String)> {
    let thread = sqlx::query_as::<_, DiscussionThread>(
        "INSERT INTO discussion_threads (organization_id, course_id, lesson_id, author_id, title, content)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *"
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .bind(payload.lesson_id)
    .bind(claims.sub)
    .bind(payload.title)
    .bind(payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Auto-subscribe author to thread
    let _ = sqlx::query(
        "INSERT INTO discussion_subscriptions (organization_id, thread_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING",
    )
    .bind(org_ctx.id)
    .bind(thread.id)
    .bind(claims.sub)
    .execute(&pool)
    .await;

    Ok(Json(thread))
}

pub async fn get_thread_detail(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Increment view count
    let _ = sqlx::query("UPDATE discussion_threads SET view_count = view_count + 1 WHERE id = $1")
        .bind(thread_id)
        .execute(&pool)
        .await;

    // Get thread with author info
    let thread = sqlx::query_as::<_, ThreadWithAuthor>(
        "SELECT 
            t.*, 
            u.full_name as author_name,
            u.avatar_url as author_avatar,
            COUNT(DISTINCT p.id) as post_count,
            BOOL_OR(p.is_endorsed) as has_endorsed_answer
        FROM discussion_threads t
        LEFT JOIN users u ON t.author_id = u.id
        LEFT JOIN discussion_posts p ON t.id = p.thread_id
        WHERE t.id = $1 AND t.organization_id = $2
        GROUP BY t.id, u.full_name, u.avatar_url",
    )
    .bind(thread_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::NOT_FOUND, "Thread not found".to_string()))?;

    // Get all posts with author info and user votes
    let posts = get_thread_posts_recursive(&pool, thread_id, None, claims.sub, org_ctx.id).await?;

    Ok(Json(serde_json::json!({
        "thread": thread,
        "posts": posts
    })))
}

// Recursive function to build nested post tree
fn get_thread_posts_recursive<'a>(
    pool: &'a PgPool,
    thread_id: Uuid,
    parent_id: Option<Uuid>,
    user_id: Uuid,
    org_id: Uuid,
) -> std::pin::Pin<
    Box<
        dyn std::future::Future<Output = Result<Vec<PostWithAuthor>, (StatusCode, String)>>
            + Send
            + 'a,
    >,
> {
    Box::pin(async move {
        let parent_filter = match parent_id {
            Some(_) => "parent_post_id = $2",
            None => "parent_post_id IS NULL",
        };

        let query = format!(
            "SELECT 
                p.*,
                u.full_name as author_name,
                u.avatar_url as author_avatar,
                v.vote_type as user_vote
            FROM discussion_posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN discussion_votes v ON p.id = v.post_id AND v.user_id = $3
            WHERE p.thread_id = $1 AND p.organization_id = $4 AND {}
            ORDER BY p.is_endorsed DESC, p.upvotes DESC, p.created_at ASC",
            parent_filter
        );

        let mut sql_query = sqlx::query_as::<_, PostWithAuthor>(&query).bind(thread_id);

        if let Some(pid) = parent_id {
            sql_query = sql_query.bind(pid);
        }

        sql_query = sql_query.bind(user_id).bind(org_id);

        let mut posts = sql_query
            .fetch_all(pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Recursively fetch replies for each post
        for post in &mut posts {
            post.replies =
                get_thread_posts_recursive(pool, thread_id, Some(post.id), user_id, org_id).await?;
        }

        Ok(posts)
    })
}

pub async fn pin_thread(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check if user is instructor
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Only instructors can pin threads".to_string(),
        ));
    }

    sqlx::query("UPDATE discussion_threads SET is_pinned = NOT is_pinned WHERE id = $1 AND organization_id = $2")
        .bind(thread_id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

pub async fn lock_thread(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check if user is instructor
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Only instructors can lock threads".to_string(),
        ));
    }

    sqlx::query("UPDATE discussion_threads SET is_locked = NOT is_locked WHERE id = $1 AND organization_id = $2")
        .bind(thread_id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

// ========== POST HANDLERS ==========

pub async fn create_post(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePostPayload>,
) -> Result<Json<DiscussionPost>, (StatusCode, String)> {
    // Check if thread is locked
    let thread =
        sqlx::query_as::<_, (bool,)>("SELECT is_locked FROM discussion_threads WHERE id = $1")
            .bind(thread_id)
            .fetch_one(&pool)
            .await
            .map_err(|_| (StatusCode::NOT_FOUND, "Thread not found".to_string()))?;

    if thread.0 {
        return Err((StatusCode::FORBIDDEN, "Thread is locked".to_string()));
    }

    let post = sqlx::query_as::<_, DiscussionPost>(
        "INSERT INTO discussion_posts (organization_id, thread_id, parent_post_id, author_id, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *"
    )
    .bind(org_ctx.id)
    .bind(thread_id)
    .bind(payload.parent_post_id)
    .bind(claims.sub)
    .bind(payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // TODO: Send notifications to subscribed users

    Ok(Json(post))
}

pub async fn endorse_post(
    Org(org_ctx): Org,
    claims: Claims,
    Path(post_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check if user is instructor
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Only instructors can endorse posts".to_string(),
        ));
    }

    sqlx::query("UPDATE discussion_posts SET is_endorsed = NOT is_endorsed WHERE id = $1 AND organization_id = $2")
        .bind(post_id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

pub async fn vote_post(
    Org(org_ctx): Org,
    claims: Claims,
    Path(post_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<VotePayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    if payload.vote_type != "upvote" && payload.vote_type != "downvote" {
        return Err((StatusCode::BAD_REQUEST, "Invalid vote type".to_string()));
    }

    // Upsert vote
    sqlx::query(
        "INSERT INTO discussion_votes (organization_id, post_id, user_id, vote_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (post_id, user_id) 
         DO UPDATE SET vote_type = EXCLUDED.vote_type",
    )
    .bind(org_ctx.id)
    .bind(post_id)
    .bind(claims.sub)
    .bind(&payload.vote_type)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Recalculate upvotes
    let upvote_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM discussion_votes WHERE post_id = $1 AND vote_type = 'upvote'",
    )
    .bind(post_id)
    .fetch_one(&pool)
    .await
    .unwrap_or(0);

    sqlx::query("UPDATE discussion_posts SET upvotes = $1 WHERE id = $2")
        .bind(upvote_count as i32)
        .bind(post_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

// ========== SUBSCRIPTION HANDLERS ==========

pub async fn subscribe_thread(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query(
        "INSERT INTO discussion_subscriptions (organization_id, thread_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING",
    )
    .bind(org_ctx.id)
    .bind(thread_id)
    .bind(claims.sub)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

pub async fn unsubscribe_thread(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query(
        "DELETE FROM discussion_subscriptions 
         WHERE thread_id = $1 AND user_id = $2 AND organization_id = $3",
    )
    .bind(thread_id)
    .bind(claims.sub)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}
