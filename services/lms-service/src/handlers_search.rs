use axum::{Json, extract::{Query, State}, http::StatusCode};
use common::auth::Claims;
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct GlobalSearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct SearchResultItem {
    pub id: Uuid,
    pub kind: String,       // "course", "lesson", "discussion", "announcement"
    pub title: String,
    pub snippet: Option<String>,
    pub url: String,        // ruta relativa para el frontend
    pub course_id: Option<Uuid>,
    pub course_title: Option<String>,
}

#[derive(Serialize)]
pub struct GlobalSearchResponse {
    pub query: String,
    pub total: usize,
    pub results: Vec<SearchResultItem>,
}

pub async fn global_search(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Query(params): Query<GlobalSearchQuery>,
) -> Result<Json<GlobalSearchResponse>, (StatusCode, String)> {
    let q = params.q.trim().to_string();
    if q.is_empty() {
        return Ok(Json(GlobalSearchResponse {
            query: q,
            total: 0,
            results: vec![],
        }));
    }

    let limit = params.limit.unwrap_or(20).min(50);
    let org_id = org_ctx.id;
    let like_q = format!("%{}%", q.to_lowercase());

    let mut results: Vec<SearchResultItem> = Vec::new();

    // ── 1. Cursos ──────────────────────────────────────────────────────────────
    let courses = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
        r#"
        SELECT id, title, description
        FROM courses
        WHERE organization_id = $1
          AND (LOWER(title) LIKE $2 OR LOWER(COALESCE(description,'')) LIKE $2)
        ORDER BY title
        LIMIT $3
        "#,
    )
    .bind(org_id)
    .bind(&like_q)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    for (id, title, description) in courses {
        let snippet = description.map(|d| truncate(&d, 150));
        results.push(SearchResultItem {
            id,
            kind: "course".to_string(),
            title: title.clone(),
            snippet,
            url: format!("/courses/{}", id),
            course_id: Some(id),
            course_title: Some(title),
        });
    }

    // ── 2. Lecciones ───────────────────────────────────────────────────────────
    let lessons = sqlx::query_as::<_, (Uuid, String, Option<String>, Uuid, String)>(
        r#"
        SELECT l.id, l.title, l.summary, c.id AS course_id, c.title AS course_title
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        JOIN courses c ON m.course_id = c.id
        WHERE l.organization_id = $1
          AND (LOWER(l.title) LIKE $2 OR LOWER(COALESCE(l.summary,'')) LIKE $2)
        ORDER BY l.title
        LIMIT $3
        "#,
    )
    .bind(org_id)
    .bind(&like_q)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    for (id, title, summary, course_id, course_title) in lessons {
        let snippet = summary.map(|s| truncate(&s, 150));
        results.push(SearchResultItem {
            id,
            kind: "lesson".to_string(),
            title,
            snippet,
            url: format!("/courses/{}/lessons/{}", course_id, id),
            course_id: Some(course_id),
            course_title: Some(course_title),
        });
    }

    // ── 3. Hilos de discusión ──────────────────────────────────────────────────
    let threads = sqlx::query_as::<_, (Uuid, String, Option<String>, Uuid, String)>(
        r#"
                SELECT t.id, t.title, t.content AS body, c.id AS course_id, c.title AS course_title
        FROM discussion_threads t
        JOIN courses c ON t.course_id = c.id
        WHERE t.organization_id = $1
                    AND (LOWER(t.title) LIKE $2 OR LOWER(COALESCE(t.content,'')) LIKE $2)
        ORDER BY t.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(org_id)
    .bind(&like_q)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();   // silenciamos si la tabla no tiene columna "body"

    for (id, title, body, course_id, course_title) in threads {
        let snippet = body.map(|b| truncate(&b, 150));
        results.push(SearchResultItem {
            id,
            kind: "discussion".to_string(),
            title,
            snippet,
            url: format!("/courses/{}/discussions/{}", course_id, id),
            course_id: Some(course_id),
            course_title: Some(course_title),
        });
    }

    // ── 4. Anuncios ────────────────────────────────────────────────────────────
    let announcements = sqlx::query_as::<_, (Uuid, String, String, Uuid, String)>(
        r#"
                SELECT a.id, a.title, a.content, c.id AS course_id, c.title AS course_title
        FROM course_announcements a
        JOIN courses c ON a.course_id = c.id
        WHERE a.organization_id = $1
                    AND (LOWER(a.title) LIKE $2 OR LOWER(a.content) LIKE $2)
        ORDER BY a.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(org_id)
    .bind(&like_q)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    for (id, title, body, course_id, course_title) in announcements {
        results.push(SearchResultItem {
            id,
            kind: "announcement".to_string(),
            title,
            snippet: Some(truncate(&body, 150)),
            url: format!("/courses/{}", course_id),
            course_id: Some(course_id),
            course_title: Some(course_title),
        });
    }

    // Ordenar: primero cursos, luego agrupados por relevancia textual básica
    results.sort_by(|a, b| {
        let a_exact = a.title.to_lowercase().contains(&q.to_lowercase()) as u8;
        let b_exact = b.title.to_lowercase().contains(&q.to_lowercase()) as u8;
        b_exact.cmp(&a_exact).then(a.kind.cmp(&b.kind))
    });

    results.truncate(limit as usize);
    let total = results.len();

    Ok(Json(GlobalSearchResponse {
        query: q,
        total,
        results,
    }))
}

fn truncate(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        let t: String = s.chars().take(max_chars).collect();
        format!("{}...", t.trim_end())
    }
}
