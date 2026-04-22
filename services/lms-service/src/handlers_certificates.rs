use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use crate::progress_tracking::{CourseCompletionMetrics, calculate_course_completion};
use common::auth::Claims;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use sqlx::{PgPool, Row};
use std::env;
use uuid::Uuid;

// Macro para usar json!() sin importar serde_json
use serde_json::json;

// ============= Structs =============

#[derive(Serialize)]
pub struct CertificateResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_title: String,
    pub student_name: String,
    pub certificate_html: String,
    pub issued_at: String,
    pub verification_code: String,
    pub metadata: serde_json::Value,
}

#[derive(Serialize)]
pub struct CertificateVerificationResponse {
    pub valid: bool,
    pub certificate: Option<CertificateResponse>,
    pub message: String,
}

#[derive(Deserialize)]
pub struct IssueCertificateRequest {
    pub force_reissue: Option<bool>, // Para re-emitir si ya existe
}

#[derive(sqlx::FromRow)]
struct CertificateRecord {
    id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
    certificate_html: String,
    issued_at: chrono::DateTime<chrono::Utc>,
    verification_code: String,
    metadata: serde_json::Value,
}

fn resolve_certificate_asset_url(path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }

    let cms_base_url = env::var("NEXT_PUBLIC_CMS_API_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "/cms-api".to_string());
    let cms_base_url = cms_base_url.trim_end_matches('/');

    if let Some(without_scheme) = path.strip_prefix("s3://") {
        if let Some((bucket, key)) = without_scheme.split_once('/') {
            return format!(
                "{}/api/assets/s3-proxy/{}/{}",
                cms_base_url,
                bucket,
                key
            );
        }
    }

    let normalized = if let Some(stripped) = path.strip_prefix("uploads/") {
        format!("/assets/{}", stripped)
    } else if let Some(stripped) = path.strip_prefix("/uploads/") {
        format!("/assets/{}", stripped)
    } else if path.starts_with("/assets/") {
        path.to_string()
    } else if path.starts_with("assets/") {
        format!("/{}", path)
    } else if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };

    format!("{}{}", cms_base_url, normalized)
}

// ============= Handlers =============

/// GET /courses/{id}/certificate
/// Obtiene el certificado emitido para el usuario actual en este curso.
/// Si no existe, lo genera automáticamente si el usuario completó el curso.
pub async fn get_certificate(
    claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<CertificateResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = claims.sub;

    // 1. Verificar si la organización tiene certificados habilitados
    let org_certificates_enabled = sqlx::query(
        "SELECT certificates_enabled FROM organizations WHERE id = (
            SELECT organization_id FROM courses WHERE id = $1
        )"
    )
    .bind(course_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Error al verificar configuración de certificados: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?;

    if let Some(org_config) = org_certificates_enabled {
        if !org_config.get::<bool, _>("certificates_enabled") {
            return Err((
                StatusCode::NOT_IMPLEMENTED,
                Json(json!({
                    "error": "La generación de certificados está deshabilitada por el administrador",
                    "hint": "Contacta al administrador de la plataforma para más información"
                })),
            ));
        }
    }

    // 2. Verificar si ya existe un certificado emitido
    let existing_cert = sqlx::query_as::<_, CertificateRecord>(
        r#"
        SELECT 
            ic.id,
            ic.user_id,
            ic.course_id,
            ic.certificate_html,
            ic.issued_at,
            ic.verification_code,
            ic.metadata
        FROM issued_certificates ic
        WHERE ic.user_id = $1 AND ic.course_id = $2
        "#
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Error al consultar certificado: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?;

    if let Some(cert) = existing_cert {
        // Obtener título del curso y nombre del estudiante
        let course_info = sqlx::query(
            "SELECT title FROM courses WHERE id = $1"
        )
        .bind(course_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e: sqlx::Error| {
            tracing::error!("Error al obtener info del curso: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Error interno del servidor"})),
            )
        })?;

        let user_info = sqlx::query(
            "SELECT full_name FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e: sqlx::Error| {
            tracing::error!("Error al obtener info del usuario: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Error interno del servidor"})),
            )
        })?;

        return Ok(Json(CertificateResponse {
            id: cert.id,
            user_id: cert.user_id,
            course_id: cert.course_id,
            course_title: course_info.map(|c| c.get::<String, _>("title")).unwrap_or_default(),
            student_name: user_info.map(|u| u.get::<String, _>("full_name")).unwrap_or_default(),
            certificate_html: cert.certificate_html,
            issued_at: cert.issued_at.to_string(),
            verification_code: cert.verification_code,
            metadata: cert.metadata,
        }));
    }

    // 2. Si no existe, verificar si el usuario completó el curso y generar certificado
    let course_completion = check_course_completion(user_id, course_id, &pool).await
        .map_err(|e| e)?;

    if !course_completion.completed {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "No has completado este curso aún",
                "progress": course_completion.progress_percentage,
                "required": 100.0
            })),
        ));
    }

    // 3. Generar el certificado
    issue_certificate_internal(user_id, course_id, &pool, None).await
        .map_err(|e| e)
}

/// POST /courses/{id}/certificate/issue
/// Emite un certificado para el usuario actual si completó el curso.
/// Permite re-emisión si force_reissue = true.
pub async fn issue_certificate(
    claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
    Json(payload): Json<Option<IssueCertificateRequest>>,
) -> Result<Json<CertificateResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = claims.sub;
    let force_reissue = payload.and_then(|p| p.force_reissue).unwrap_or(false);

    // Verificar si la organización tiene certificados habilitados
    let org_certificates_enabled = sqlx::query(
        "SELECT certificates_enabled FROM organizations WHERE id = (
            SELECT organization_id FROM courses WHERE id = $1
        )"
    )
    .bind(course_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al verificar configuración de certificados: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?;

    if let Some(org_config) = org_certificates_enabled {
        if !org_config.get::<bool, _>("certificates_enabled") {
            return Err((
                StatusCode::NOT_IMPLEMENTED,
                Json(json!({
                    "error": "La generación de certificados está deshabilitada por el administrador",
                    "hint": "Contacta al administrador de la plataforma para más información"
                })),
            ));
        }
    }

    // Verificar si ya existe
    let existing = sqlx::query(
        "SELECT id FROM issued_certificates WHERE user_id = $1 AND course_id = $2"
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al verificar certificado existente: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?;

    if existing.is_some() && !force_reissue {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({
                "error": "Ya tienes un certificado emitido para este curso",
                "hint": "Usa force_reissue=true para re-emitir"
            })),
        ));
    }

    // Verificar completitud del curso
    let course_completion = check_course_completion(user_id, course_id, &pool).await
        .map_err(|e| e)?;

    if !course_completion.completed {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "No has completado este curso aún",
                "progress": course_completion.progress_percentage,
                "required": 100.0
            })),
        ));
    }

    // Emitir certificado
    issue_certificate_internal(user_id, course_id, &pool, None).await
        .map_err(|e| e)
}

/// GET /certificates/verify/{code}
/// Verifica la autenticidad de un certificado por su código público.
pub async fn verify_certificate(
    Path(code): Path<String>,
    State(pool): State<PgPool>,
) -> Result<Json<CertificateVerificationResponse>, StatusCode> {
    let cert = sqlx::query(
        r#"
        SELECT 
            ic.id,
            ic.user_id,
            ic.course_id,
            ic.certificate_html,
            ic.issued_at,
            ic.verification_code,
            ic.metadata,
            c.title as course_title,
            u.full_name as student_name
        FROM issued_certificates ic
        JOIN courses c ON c.id = ic.course_id
        JOIN users u ON u.id = ic.user_id
        WHERE ic.verification_code = $1
        "#
    )
    .bind(code)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al verificar certificado: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match cert {
        Some(row) => Ok(Json(CertificateVerificationResponse {
            valid: true,
            certificate: Some(CertificateResponse {
                id: row.get("id"),
                user_id: row.get("user_id"),
                course_id: row.get("course_id"),
                course_title: row.get("course_title"),
                student_name: row.get("student_name"),
                certificate_html: row.get("certificate_html"),
                issued_at: row.get::<chrono::DateTime<chrono::Utc>, _>("issued_at").to_string(),
                verification_code: row.get("verification_code"),
                metadata: row.get("metadata"),
            }),
            message: "Certificado válido".to_string(),
        })),
        None => Ok(Json(CertificateVerificationResponse {
            valid: false,
            certificate: None,
            message: "Certificado no encontrado o inválido".to_string(),
        })),
    }
}

// ============= Funciones Internas =============

async fn check_course_completion(
    user_id: Uuid,
    course_id: Uuid,
    pool: &PgPool,
) -> Result<CourseCompletionMetrics, (StatusCode, Json<serde_json::Value>)> {
    calculate_course_completion(pool, user_id, course_id)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al calcular completitud del curso: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })
}

async fn issue_certificate_internal(
    user_id: Uuid,
    course_id: Uuid,
    pool: &PgPool,
    _certificate_template_override: Option<&str>,
) -> Result<Json<CertificateResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Obtener datos necesarios
    let course_row = sqlx::query(
        r#"
        SELECT title, certificate_template, organization_id
        FROM courses
        WHERE id = $1
        "#
    )
    .bind(course_id)
    .fetch_optional(pool)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al obtener datos del curso: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?;

    let course_row = course_row.ok_or((
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Curso no encontrado"})),
    ))?;

    let user_name = sqlx::query(
        "SELECT full_name FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al obtener nombre del usuario: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?
    .get::<String, _>("full_name");

    let organization_id: Uuid = course_row.get("organization_id");
    let org_data = sqlx::query(
        r#"
        SELECT name, platform_name, logo_url, primary_color, secondary_color, certificate_template
        FROM organizations
        WHERE id = $1
        "#
    )
    .bind(organization_id)
    .fetch_optional(pool)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al obtener datos de la organización: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?;

    // Determinar template a usar (curso > organización > default)
    let course_title = course_row.get::<String, _>("title");
    let template = course_row
        .get::<Option<String>, _>("certificate_template")
        .or_else(|| org_data.as_ref().and_then(|o| o.get::<Option<String>, _>("certificate_template")))
        .unwrap_or_else(|| get_default_certificate_template());

    let organization_name = org_data
        .as_ref()
        .map(|o| o.get::<String, _>("name"))
        .unwrap_or_else(|| "OpenCCB".to_string());
    let platform_name = org_data
        .as_ref()
        .and_then(|o| o.get::<Option<String>, _>("platform_name"))
        .unwrap_or_else(|| organization_name.clone());
    let logo_url = org_data
        .as_ref()
        .and_then(|o| o.get::<Option<String>, _>("logo_url"))
        .map(|value| resolve_certificate_asset_url(&value))
        .unwrap_or_default();
    let primary_color = org_data
        .as_ref()
        .and_then(|o| o.get::<Option<String>, _>("primary_color"))
        .unwrap_or_else(|| "#2563eb".to_string());
    let secondary_color = org_data
        .as_ref()
        .and_then(|o| o.get::<Option<String>, _>("secondary_color"))
        .unwrap_or_else(|| "#7c3aed".to_string());

    // Reemplazar variables en el template
    let now = chrono::Utc::now();
    let certificate_html = template
        .replace("{{student_name}}", &user_name)
        .replace("{{course_title}}", &course_title)
        .replace("{{date}}", &now.format("%d/%m/%Y").to_string())
        .replace("{{score}}", "Aprobado")
        .replace("{{organization_name}}", &organization_name)
        .replace("{{platform_name}}", &platform_name)
        .replace("{{logo_url}}", &logo_url)
        .replace("{{primary_color}}", &primary_color)
        .replace("{{secondary_color}}", &secondary_color)
        .replace("{{verification_code}}", "VER-PLACEHOLDER");

    // Generar código de verificación único
    let verification_code = format!(
        "VER-{}-{}",
        now.format("%Y%m%d"),
        &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()
    );

    // Reemplazar placeholder con código real
    let certificate_html = certificate_html.replace("VER-PLACEHOLDER", &verification_code);

    // Generar hash para verificación
    let mut hasher = Sha256::new();
    hasher.update(certificate_html.as_bytes());
    let certificate_hash = format!("{:x}", hasher.finalize());

    // Obtener progreso final para metadata
    let course_completion = check_course_completion(user_id, course_id, pool).await?;

    // Insertar certificado en BD
    let metadata = serde_json::json!({
        "completion_date": now.to_rfc3339(),
        "final_score": course_completion.progress_percentage,
        "organization_id": organization_id.to_string(),
    });

    let issued_cert = sqlx::query(
        r#"
        INSERT INTO issued_certificates 
            (user_id, course_id, certificate_html, certificate_hash, verification_code, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, issued_at
        "#
    )
    .bind(user_id.clone())
    .bind(course_id.clone())
    .bind(certificate_html.clone())
    .bind(certificate_hash.clone())
    .bind(verification_code.clone())
    .bind(metadata.clone())
    .fetch_one(pool)
    .await
    .map_err(|e: sqlx::Error| {
        tracing::error!("Error al emitir certificado: {}", e);
        // Manejar unique constraint violation
        if e.to_string().contains("issued_certificates_user_course_unique") {
            return (
                StatusCode::CONFLICT,
                Json(json!({"error": "Ya existe un certificado para este usuario y curso"})),
            );
        }
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Error interno del servidor"})),
        )
    })?;

    Ok(Json(CertificateResponse {
        id: issued_cert.get("id"),
        user_id,
        course_id,
        course_title: course_title,
        student_name: user_name,
        certificate_html,
        issued_at: issued_cert.get::<chrono::DateTime<chrono::Utc>, _>("issued_at").to_string(),
        verification_code,
        metadata,
    }))
}

/// Template de certificado por defecto
fn get_default_certificate_template() -> String {
    r#"<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Georgia', serif;
            text-align: center;
            padding: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        .certificate {
            background: white;
            padding: 50px;
            border: 20px solid #f0f0f0;
            border-radius: 10px;
            max-width: 800px;
            margin: 0 auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #667eea;
            font-size: 42px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 3px;
        }
        .subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 40px;
        }
        .recipient {
            font-size: 16px;
            margin-bottom: 10px;
        }
        .student-name {
            font-size: 36px;
            color: #764ba2;
            font-weight: bold;
            margin: 20px 0;
            font-style: italic;
        }
        .course-name {
            font-size: 28px;
            color: #667eea;
            font-weight: bold;
            margin: 20px 0;
            padding: 15px;
            border-top: 2px solid #667eea;
            border-bottom: 2px solid #667eea;
            display: inline-block;
        }
        .date {
            margin-top: 40px;
            font-size: 16px;
            color: #666;
        }
        .verification {
            margin-top: 30px;
            font-size: 12px;
            color: #999;
        }
        .seal {
            width: 100px;
            height: 100px;
            border: 4px solid #667eea;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 30px auto;
            font-size: 40px;
            color: #667eea;
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="seal">🎓</div>
        <h1>Certificado</h1>
        <p class="subtitle">Se otorga este certificado a</p>
        <p class="student-name">{{student_name}}</p>
        <p class="recipient">Por haber completado exitosamente el curso</p>
        <p class="course-name">{{course_title}}</p>
        <p class="date">Fecha: {{date}}</p>
        <p class="date">Estado: {{score}}</p>
        <p class="verification">Código de verificación: {{verification_code}}</p>
    </div>
</body>
</html>"#.to_string()
}
