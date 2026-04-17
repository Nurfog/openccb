use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use common::auth::Claims;
use common::middleware::Org;
use common::models::{DiscussionPost, DiscussionThread, PostWithAuthor, ThreadWithAuthor};
use serde::Deserialize;
use sqlx::PgPool;
use std::env;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
struct ForumEmailRecipient {
    user_id: Uuid,
    email: String,
    full_name: Option<String>,
}

#[derive(Debug, Clone)]
struct EmailTemplate {
    subject_template: String,
    body_template: String,
    is_enabled: bool,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct OrganizationEmailSettingsRow {
    service_type: String,
    smtp_enabled: bool,
    smtp_host: Option<String>,
    smtp_port: i32,
    smtp_from: Option<String>,
    smtp_username: Option<String>,
    smtp_password: Option<String>,
    smtp_starttls: bool,
}

#[derive(Debug, Clone)]
struct SmtpConfig {
    enabled: bool,
    host: String,
    from: String,
    port: u16,
    starttls: bool,
    username: Option<String>,
    password: Option<String>,
}

fn parse_bool(value: &str) -> bool {
    let normalized = value.trim().to_lowercase();
    normalized == "1" || normalized == "true" || normalized == "yes"
}

fn load_env_smtp_config() -> Result<SmtpConfig, String> {
    let enabled = env::var("SMTP_ENABLED").map(|v| parse_bool(&v)).unwrap_or(false);
    let host = env::var("SMTP_HOST").map_err(|_| "SMTP_HOST no está configurado".to_string())?;
    let from = env::var("SMTP_FROM")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| "OpenCCB <no-reply@openccb.local>".to_string());
    let port = env::var("SMTP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(587);
    let starttls = env::var("SMTP_STARTTLS")
        .map(|v| {
            let normalized = v.trim().to_lowercase();
            normalized == "1" || normalized == "true" || normalized == "yes"
        })
        .unwrap_or(false);
    let username = env::var("SMTP_USERNAME").ok().filter(|v| !v.trim().is_empty());
    let password = env::var("SMTP_PASSWORD").ok().filter(|v| !v.trim().is_empty());

    Ok(SmtpConfig {
        enabled,
        host,
        from,
        port,
        starttls,
        username,
        password,
    })
}

async fn load_org_smtp_config(pool: &PgPool, organization_id: Uuid) -> Option<SmtpConfig> {
    let row = sqlx::query_as::<_, OrganizationEmailSettingsRow>(
        r#"
        SELECT
            service_type,
            smtp_enabled,
            smtp_host,
            smtp_port,
            smtp_from,
            smtp_username,
            smtp_password,
            smtp_starttls
        FROM organization_email_services
        WHERE organization_id = $1
        ORDER BY is_default DESC, created_at ASC
        LIMIT 1
        "#,
    )
    .bind(organization_id)
    .fetch_optional(pool)
    .await;

    let row = match row {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(
                "No se pudo cargar configuración SMTP por organización (fallback a entorno): {}",
                e
            );
            return None;
        }
    }?;

    if row.service_type.trim().to_lowercase() != "smtp" {
        tracing::warn!(
            "El servicio de email por defecto no es SMTP ({}), se usa fallback de entorno",
            row.service_type
        );
        return None;
    }

    let host = row.smtp_host.unwrap_or_default().trim().to_string();
    if host.is_empty() {
        return None;
    }

    let from = row
        .smtp_from
        .unwrap_or_else(|| "OpenCCB <no-reply@openccb.local>".to_string())
        .trim()
        .to_string();

    let port = u16::try_from(row.smtp_port).ok().filter(|v| *v > 0).unwrap_or(587);

    Some(SmtpConfig {
        enabled: row.smtp_enabled,
        host,
        from,
        port,
        starttls: row.smtp_starttls,
        username: row.smtp_username.filter(|v| !v.trim().is_empty()),
        password: row.smtp_password.filter(|v| !v.trim().is_empty()),
    })
}

async fn load_email_template(
    _organization_id: Uuid,
    template_key: &str,
) -> Option<EmailTemplate> {
    // Para simplificar, por ahora devolvemos plantillas hardcoded
    // En producción, haríamos la llamada HTTP con autenticación
    match template_key {
        "forum_reply" => Some(EmailTemplate {
            subject_template: "Nueva respuesta en {{thread_title}}".to_string(),
            body_template: "Hola {{recipient_name}},

Ha recibido una nueva respuesta en el hilo \"{{thread_title}}\" por {{author_name}}.

Mensaje:
{{message_content}}

Ver hilo completo: {{thread_url}}

Saludos,
El equipo de {{organization_name}}".to_string(),
            is_enabled: true,
        }),
        "forum_thread" => Some(EmailTemplate {
            subject_template: "Nuevo hilo en foro: {{thread_title}}".to_string(),
            body_template: "Hola {{recipient_name}},

Se ha creado un nuevo hilo en el foro: \"{{thread_title}}\" por {{author_name}}.

Mensaje inicial:
{{message_content}}

Ver hilo: {{thread_url}}

Saludos,
El equipo de {{organization_name}}".to_string(),
            is_enabled: true,
        }),
        _ => None,
    }
}

fn render_template(template: &str, variables: &HashMap<&str, String>) -> String {
    let mut result = template.to_string();
    for (key, value) in variables {
        let placeholder = format!("{{{{{}}}}}", key);
        result = result.replace(&placeholder, value);
    }
    result
}

fn build_smtp_mailer(config: &SmtpConfig) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let mut builder = if config.starttls {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
            .map_err(|e| format!("Error al crear relay SMTP con STARTTLS: {}", e))?
            .port(config.port)
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host).port(config.port)
    };

    if let (Some(user), Some(pass)) = (&config.username, &config.password) {
        let user = user.trim().to_string();
        let pass = pass.trim().to_string();
        builder = builder.credentials(Credentials::new(user, pass));
    }

    Ok(builder.build())
}

async fn send_forum_email_notifications(
    pool: &PgPool,
    organization_id: Uuid,
    recipients: &[ForumEmailRecipient],
    template_key: &str,
    variables: &HashMap<&str, String>,
) {
    if recipients.is_empty() {
        return;
    }

    let template = match load_email_template(organization_id, template_key).await {
        Some(t) if t.is_enabled => t,
        _ => {
            tracing::warn!("Plantilla de email '{}' no encontrada o deshabilitada", template_key);
            return;
        }
    };

    let smtp_config = match load_org_smtp_config(pool, organization_id).await {
        Some(config) => config,
        None => match load_env_smtp_config() {
            Ok(config) => config,
            Err(e) => {
                tracing::warn!("SMTP deshabilitado para foros: {}", e);
                return;
            }
        },
    };

    if !smtp_config.enabled {
        return;
    }

    let mailer = match build_smtp_mailer(&smtp_config) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("SMTP deshabilitado para foros: {}", e);
            return;
        }
    };

    let from_mailbox: Mailbox = match smtp_config.from.parse() {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("SMTP_FROM inválido ({}): {}", smtp_config.from, e);
            return;
        }
    };

    for recipient in recipients {
        let mut recipient_variables = variables.clone();
        recipient_variables.insert("recipient_name", recipient.full_name.clone().unwrap_or_else(|| "Usuario".to_string()));

        let subject = render_template(&template.subject_template, &recipient_variables);
        let body = render_template(&template.body_template, &recipient_variables);

        let to_mailbox: Mailbox = match recipient.email.parse() {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(
                    "Email inválido para notificación de foro ({}): {}",
                    recipient.email,
                    e
                );
                continue;
            }
        };

        let message = match Message::builder()
            .from(from_mailbox.clone())
            .to(to_mailbox)
            .subject(subject)
            .body(body)
        {
            Ok(msg) => msg,
            Err(e) => {
                tracing::warn!("No se pudo construir correo de foro: {}", e);
                continue;
            }
        };

        if let Err(e) = mailer.send(message).await {
            tracing::warn!(
                "Falló envío SMTP de foro para {}: {}",
                recipient.email,
                e
            );
        }
    }
}

// ========== DTOs de Solicitud/Respuesta ==========

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

// ========== MANEJADORES DE HILOS ==========

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
    let author_name: Option<String> = sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

    let thread = sqlx::query_as::<_, DiscussionThread>(
        "INSERT INTO discussion_threads (organization_id, course_id, lesson_id, author_id, title, content)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *"
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .bind(payload.lesson_id)
    .bind(claims.sub)
    .bind(&payload.title)
    .bind(&payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Suscribir automáticamente al autor al hilo
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

    // Notificar a instructores/administradores del curso (excepto autor)
    let instructor_recipients = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
        "SELECT DISTINCT u.id, u.email, u.full_name
         FROM course_instructors ci
         JOIN users u ON u.id = ci.user_id
         WHERE ci.course_id = $1
           AND ci.organization_id = $2
           AND u.id != $3
           AND u.email IS NOT NULL
           AND trim(u.email) != ''",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(user_id, email, full_name)| ForumEmailRecipient {
        user_id,
        email,
        full_name,
    })
    .collect::<Vec<_>>();

    for recipient in &instructor_recipients {
        let _ = sqlx::query(
            "INSERT INTO notifications (organization_id, user_id, title, message, notification_type, link_url)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(org_ctx.id)
        .bind(recipient.user_id)
        .bind(format!("Nuevo hilo en foro: {}", thread.title))
        .bind(if thread.content.len() > 140 {
            format!("{}...", &thread.content[..140])
        } else {
            thread.content.clone()
        })
        .bind("forum_thread")
        .bind(format!("/courses/{}#discussions", course_id))
        .execute(&pool)
        .await;
    }

    let author_display = author_name.unwrap_or_else(|| "Un estudiante".to_string());
    let mut variables = HashMap::new();
    variables.insert("thread_title", thread.title.clone());
    variables.insert("author_name", author_display.clone());
    variables.insert("message_content", thread.content.clone());
    variables.insert("thread_url", format!("/courses/{}#discussions", course_id));
    variables.insert("organization_name", "OpenCCB".to_string()); // TODO: obtener de org

    send_forum_email_notifications(&pool, org_ctx.id, &instructor_recipients, "forum_thread", &variables).await;

    Ok(Json(thread))
}

pub async fn get_thread_detail(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Incrementar el conteo de visualizaciones
    let _ = sqlx::query("UPDATE discussion_threads SET view_count = view_count + 1 WHERE id = $1")
        .bind(thread_id)
        .execute(&pool)
        .await;

    // Obtener el hilo con información del autor
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
    .map_err(|_| (StatusCode::NOT_FOUND, "Hilo no encontrado".to_string()))?;

    // Obtener todos los mensajes con información del autor y votos del usuario
    let posts = get_thread_posts_recursive(&pool, thread_id, None, claims.sub, org_ctx.id).await?;

    Ok(Json(serde_json::json!({
        "thread": thread,
        "posts": posts
    })))
}

// Función recursiva para construir el árbol de mensajes anidados
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

        // Obtener respuestas recursivamente para cada mensaje
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
    // Verificar si el usuario es instructor o administrador
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Usuario no encontrado".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los instructores pueden fijar hilos".to_string(),
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
    // Verificar si el usuario es instructor o administrador
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Usuario no encontrado".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los instructores pueden bloquear hilos".to_string(),
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

// ========== MANEJADORES DE MENSAJES ==========

pub async fn create_post(
    Org(org_ctx): Org,
    claims: Claims,
    Path(thread_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePostPayload>,
) -> Result<Json<DiscussionPost>, (StatusCode, String)> {
    // Verificar si el hilo está bloqueado
    let thread =
        sqlx::query_as::<_, (bool, String, Uuid, Uuid)>(
            "SELECT is_locked, title, course_id, author_id FROM discussion_threads WHERE id = $1 AND organization_id = $2",
        )
            .bind(thread_id)
            .bind(org_ctx.id)
            .fetch_one(&pool)
            .await
            .map_err(|_| (StatusCode::NOT_FOUND, "Hilo no encontrado".to_string()))?;

    if thread.0 {
        return Err((StatusCode::FORBIDDEN, "El hilo está bloqueado".to_string()));
    }

    let author_name: Option<String> = sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

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

    // Notificar a los suscritos al hilo (excepto autor de la respuesta)
    let mut recipients = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
        "SELECT DISTINCT u.id, u.email, u.full_name
         FROM discussion_subscriptions ds
         JOIN users u ON u.id = ds.user_id
         WHERE ds.thread_id = $1
           AND ds.organization_id = $2
           AND ds.user_id != $3
           AND u.email IS NOT NULL
           AND trim(u.email) != ''",
    )
    .bind(thread_id)
    .bind(org_ctx.id)
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(user_id, email, full_name)| ForumEmailRecipient {
        user_id,
        email,
        full_name,
    })
    .collect::<Vec<_>>();

    // Si el autor del hilo no está suscrito, añadirlo igualmente (si no es quien respondió)
    if thread.3 != claims.sub && !recipients.iter().any(|r| r.user_id == thread.3) {
        if let Ok(Some((email, full_name))) = sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT email, full_name FROM users WHERE id = $1 AND organization_id = $2",
        )
        .bind(thread.3)
        .bind(org_ctx.id)
        .fetch_optional(&pool)
        .await
        {
            if !email.trim().is_empty() {
                recipients.push(ForumEmailRecipient {
                    user_id: thread.3,
                    email,
                    full_name,
                });
            }
        }
    }

    for recipient in &recipients {
        let _ = sqlx::query(
            "INSERT INTO notifications (organization_id, user_id, title, message, notification_type, link_url)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(org_ctx.id)
        .bind(recipient.user_id)
        .bind(format!("Nueva respuesta en: {}", thread.1))
        .bind(if post.content.len() > 140 {
            format!("{}...", &post.content[..140])
        } else {
            post.content.clone()
        })
        .bind("forum_reply")
        .bind(format!("/courses/{}#discussions", thread.2))
        .execute(&pool)
        .await;
    }

    let author_display = author_name.unwrap_or_else(|| "Un usuario".to_string());
    let mut variables = HashMap::new();
    variables.insert("thread_title", thread.1.clone());
    variables.insert("author_name", author_display.clone());
    variables.insert("message_content", post.content.clone());
    variables.insert("thread_url", format!("/courses/{}#discussions", thread.2));
    variables.insert("organization_name", "OpenCCB".to_string()); // TODO: obtener de org

    send_forum_email_notifications(&pool, org_ctx.id, &recipients, "forum_reply", &variables).await;

    Ok(Json(post))
}

pub async fn endorse_post(
    Org(org_ctx): Org,
    claims: Claims,
    Path(post_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verificar si el usuario es instructor o administrador
    let user = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Usuario no encontrado".to_string()))?;

    if user.0 != "instructor" && user.0 != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            "Solo los instructores pueden recomendar mensajes".to_string(),
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
        return Err((StatusCode::BAD_REQUEST, "Tipo de voto inválido".to_string()));
    }

    // Upsert de voto
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

    // Recalcular votos positivos
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

// ========== MANEJADORES DE SUSCRIPCIONES ==========

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
