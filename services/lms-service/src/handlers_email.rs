use axum::{Json, extract::State, http::StatusCode};
use bcrypt::hash;
use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use rand::distributions::Alphanumeric;
use rand::{Rng, thread_rng};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

// ─── Helpers SMTP compartidos ─────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct SmtpConfig {
    pub enabled: bool,
    pub host: String,
    pub from: String,
    pub port: u16,
    pub starttls: bool,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct OrgEmailServiceRow {
    service_type: String,
    smtp_enabled: bool,
    smtp_host: Option<String>,
    smtp_port: i32,
    smtp_from: Option<String>,
    smtp_username: Option<String>,
    smtp_password: Option<String>,
    smtp_starttls: bool,
}

pub async fn load_smtp_config(pool: &PgPool, organization_id: Uuid) -> Option<SmtpConfig> {
    // Intentar cargar config desde la BD
    let row = sqlx::query_as::<_, OrgEmailServiceRow>(
        r#"
        SELECT service_type, smtp_enabled, smtp_host, smtp_port, smtp_from,
               smtp_username, smtp_password, smtp_starttls
        FROM organization_email_services
        WHERE organization_id = $1
        ORDER BY is_default DESC, created_at ASC
        LIMIT 1
        "#,
    )
    .bind(organization_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    if let Some(row) = row {
        if row.service_type.trim().to_lowercase() == "smtp" {
            let host = row.smtp_host.unwrap_or_default().trim().to_string();
            if !host.is_empty() {
                return Some(SmtpConfig {
                    enabled: row.smtp_enabled,
                    host,
                    from: row.smtp_from.unwrap_or_else(|| "OpenCCB <no-reply@openccb.local>".to_string()),
                    port: u16::try_from(row.smtp_port).unwrap_or(587),
                    starttls: row.smtp_starttls,
                    username: row.smtp_username.filter(|v| !v.trim().is_empty()),
                    password: row.smtp_password.filter(|v| !v.trim().is_empty()),
                });
            }
        }
    }

    // Fallback a variables de entorno
    let host = env::var("SMTP_HOST").ok().filter(|v| !v.trim().is_empty())?;
    let enabled = env::var("SMTP_ENABLED")
        .map(|v| matches!(v.trim().to_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);
    let from = env::var("SMTP_FROM")
        .unwrap_or_else(|_| "OpenCCB <no-reply@openccb.local>".to_string());
    let port = env::var("SMTP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(587);
    let starttls = env::var("SMTP_STARTTLS")
        .map(|v| matches!(v.trim().to_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);

    Some(SmtpConfig {
        enabled,
        host,
        from,
        port,
        starttls,
        username: env::var("SMTP_USERNAME").ok().filter(|v| !v.trim().is_empty()),
        password: env::var("SMTP_PASSWORD").ok().filter(|v| !v.trim().is_empty()),
    })
}

pub fn build_mailer(config: &SmtpConfig) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let mut builder = if config.starttls {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
            .map_err(|e| format!("SMTP relay error: {}", e))?
            .port(config.port)
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host).port(config.port)
    };

    if let (Some(user), Some(pass)) = (&config.username, &config.password) {
        builder = builder.credentials(Credentials::new(user.trim().to_string(), pass.trim().to_string()));
    }

    Ok(builder.build())
}

pub async fn send_email(
    config: &SmtpConfig,
    to_email: &str,
    to_name: &str,
    subject: &str,
    body_html: &str,
) -> Result<(), String> {
    if !config.enabled {
        tracing::debug!("SMTP deshabilitado — email no enviado a {}", to_email);
        return Ok(());
    }

    let from: Mailbox = config
        .from
        .parse()
        .map_err(|e| format!("From inválido: {}", e))?;

    let to_str = if to_name.is_empty() {
        to_email.to_string()
    } else {
        format!("{} <{}>", to_name, to_email)
    };
    let to: Mailbox = to_str.parse().map_err(|e| format!("To inválido: {}", e))?;

    let email = Message::builder()
        .from(from)
        .to(to)
        .subject(subject)
        .header(lettre::message::header::ContentType::TEXT_HTML)
        .body(body_html.to_string())
        .map_err(|e| format!("Error construyendo email: {}", e))?;

    let mailer = build_mailer(config)?;
    mailer.send(email).await.map_err(|e| format!("Error enviando email: {}", e))?;
    Ok(())
}

// ─── Password Reset ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ForgotPasswordPayload {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordPayload {
    pub token: String,
    pub new_password: String,
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub message: String,
}

#[derive(sqlx::FromRow)]
struct UserForReset {
    id: Uuid,
    email: String,
    full_name: Option<String>,
    organization_id: Uuid,
}

pub async fn forgot_password(
    State(pool): State<PgPool>,
    Json(payload): Json<ForgotPasswordPayload>,
) -> Result<Json<MessageResponse>, (StatusCode, String)> {
    let email = payload.email.trim().to_lowercase();

    // Buscar usuario (respuesta genérica para no revelar si existe)
    let user = sqlx::query_as::<_, UserForReset>(
        "SELECT id, email, full_name, organization_id FROM users WHERE LOWER(email) = $1",
    )
    .bind(&email)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(user) = user else {
        // Respuesta genérica — no revelar si el email existe
        return Ok(Json(MessageResponse {
            message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña."
                .to_string(),
        }));
    };

    // Generar token seguro de 48 caracteres
    let token: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();

    // Invalidar tokens anteriores del mismo usuario
    sqlx::query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL")
        .bind(user.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Insertar nuevo token (expira en 1 hora)
    sqlx::query(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')",
    )
    .bind(user.id)
    .bind(&token)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Intentar enviar email (fire-and-forget en caso de error SMTP)
    let base_url = env::var("EXPERIENCE_URL").unwrap_or_else(|_| "https://openccb.local".to_string());
    let reset_url = format!("{}/reset-password?token={}", base_url, token);
    let full_name = user.full_name.as_deref().unwrap_or("Estudiante");

    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2>Restablecer contraseña</h2>
  <p>Hola {full_name},</p>
  <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
  <p style="text-align:center;margin:30px 0">
    <a href="{reset_url}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
      Restablecer contraseña
    </a>
  </p>
  <p>Este enlace expira en <strong>1 hora</strong>.</p>
  <p>Si no solicitaste esto, ignora este mensaje.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
  <p style="color:#888;font-size:12px">OpenCCB — Plataforma de Aprendizaje</p>
</body>
</html>"#,
        full_name = full_name,
        reset_url = reset_url
    );

    if let Some(smtp) = load_smtp_config(&pool, user.organization_id).await {
        if let Err(e) = send_email(&smtp, &user.email, full_name, "Restablecer contraseña", &body).await {
            tracing::warn!("No se pudo enviar email de reset a {}: {}", user.email, e);
        }
    }

    Ok(Json(MessageResponse {
        message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña.".to_string(),
    }))
}

pub async fn reset_password(
    State(pool): State<PgPool>,
    Json(payload): Json<ResetPasswordPayload>,
) -> Result<Json<MessageResponse>, (StatusCode, String)> {
    let token = payload.token.trim().to_string();

    if token.is_empty() || payload.new_password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Token o contraseña inválidos (mínimo 8 caracteres)".to_string(),
        ));
    }

    // Buscar token válido
    let row = sqlx::query_as::<_, (Uuid,)>(
        r#"SELECT user_id FROM password_reset_tokens
           WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()"#,
    )
    .bind(&token)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some((user_id,)) = row else {
        return Err((
            StatusCode::BAD_REQUEST,
            "Token inválido o expirado".to_string(),
        ));
    };

    // Hashear nueva contraseña
    let password_hash = hash(&payload.new_password, 13).map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Error al procesar contraseña".to_string())
    })?;

    // Actualizar contraseña
    sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
        .bind(&password_hash)
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Marcar token como usado
    sqlx::query("UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1")
        .bind(&token)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(MessageResponse {
        message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión.".to_string(),
    }))
}

// ─── Emails transaccionales ────────────────────────────────────────────────────

/// Envía email de bienvenida al inscribirse en un curso.
/// Fire-and-forget (los errores se loguean, no bloquean la respuesta).
pub async fn send_enrollment_email(
    pool: &PgPool,
    organization_id: Uuid,
    user_email: &str,
    user_name: &str,
    course_title: &str,
) {
    let Some(smtp) = load_smtp_config(pool, organization_id).await else {
        return;
    };

    let base_url = env::var("EXPERIENCE_URL").unwrap_or_else(|_| "https://openccb.local".to_string());
    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2>¡Te has inscrito exitosamente!</h2>
  <p>Hola {user_name},</p>
  <p>Tu inscripción en <strong>{course_title}</strong> ha sido confirmada.</p>
  <p style="text-align:center;margin:30px 0">
    <a href="{base_url}/courses"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
      Ir a mis cursos
    </a>
  </p>
  <p>¡Mucho éxito en tu aprendizaje!</p>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
  <p style="color:#888;font-size:12px">OpenCCB — Plataforma de Aprendizaje</p>
</body>
</html>"#,
        user_name = user_name,
        course_title = course_title,
        base_url = base_url
    );

    if let Err(e) = send_email(&smtp, user_email, user_name, &format!("Inscripción confirmada: {}", course_title), &body).await {
        tracing::warn!("Email de inscripción no enviado a {}: {}", user_email, e);
    }
}

/// Envía email de felicitación al completar un curso.
pub async fn send_completion_email(
    pool: &PgPool,
    organization_id: Uuid,
    user_email: &str,
    user_name: &str,
    course_title: &str,
) {
    let Some(smtp) = load_smtp_config(pool, organization_id).await else {
        return;
    };

    let base_url = env::var("EXPERIENCE_URL").unwrap_or_else(|_| "https://openccb.local".to_string());
    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2>🎉 ¡Felicitaciones, completaste el curso!</h2>
  <p>Hola {user_name},</p>
  <p>Has completado exitosamente <strong>{course_title}</strong>.</p>
  <p>Puedes descargar tu certificado desde la plataforma.</p>
  <p style="text-align:center;margin:30px 0">
    <a href="{base_url}/courses"
       style="background:#16a34a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
      Ver mis certificados
    </a>
  </p>
  <p>Sigue aprendiendo — ¡el conocimiento no tiene límites!</p>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
  <p style="color:#888;font-size:12px">OpenCCB — Plataforma de Aprendizaje</p>
</body>
</html>"#,
        user_name = user_name,
        course_title = course_title,
        base_url = base_url
    );

    if let Err(e) = send_email(&smtp, user_email, user_name, &format!("¡Completaste: {}!", course_title), &body).await {
        tracing::warn!("Email de completitud no enviado a {}: {}", user_email, e);
    }
}
