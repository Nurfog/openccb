use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use common::{
    auth::Claims,
    middleware::Org,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use hmac::{Hmac, Mac};
use sha2::Sha256;

#[derive(Debug, Serialize)]
pub struct LtiExternalTool {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub name: String,
    pub launch_url: String,
    pub enabled: bool,
    pub config: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLtiToolPayload {
    pub name: String,
    pub launch_url: String,
    pub shared_secret: String,
    pub enabled: Option<bool>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLtiToolPayload {
    pub name: Option<String>,
    pub launch_url: Option<String>,
    pub shared_secret: Option<String>,
    pub enabled: Option<bool>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct LtiGradePassbackPayload {
    pub user_id: Uuid,
    pub lesson_id: Option<Uuid>,
    pub score: f32,
    pub max_score: Option<f32>,
    pub status: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct LtiGradePassbackResponse {
    pub success: bool,
    pub tool_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Option<Uuid>,
    pub normalized_score: f32,
}

pub async fn list_course_lti_tools(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<LtiExternalTool>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"
        SELECT id, organization_id, course_id, name, launch_url, enabled, config, created_at, updated_at
        FROM lti_external_tools
        WHERE organization_id = $1 AND course_id = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let tools = rows
        .into_iter()
        .map(|r| LtiExternalTool {
            id: r.get("id"),
            organization_id: r.get("organization_id"),
            course_id: r.get("course_id"),
            name: r.get("name"),
            launch_url: r.get("launch_url"),
            enabled: r.get("enabled"),
            config: r.get("config"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect();

    Ok(Json(tools))
}

pub async fn create_course_lti_tool(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
    Json(payload): Json<CreateLtiToolPayload>,
) -> Result<(StatusCode, Json<LtiExternalTool>), (StatusCode, String)> {
    if !payload.launch_url.starts_with("https://") {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            "launch_url debe usar HTTPS".to_string(),
        ));
    }

    if payload.shared_secret.trim().len() < 16 {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            "shared_secret debe tener al menos 16 caracteres".to_string(),
        ));
    }

    let row = sqlx::query(
        r#"
        INSERT INTO lti_external_tools (organization_id, course_id, name, launch_url, shared_secret, enabled, config)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, organization_id, course_id, name, launch_url, enabled, config, created_at, updated_at
        "#,
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .bind(&payload.name)
    .bind(&payload.launch_url)
    .bind(&payload.shared_secret)
    .bind(payload.enabled.unwrap_or(true))
    .bind(payload.config.unwrap_or(serde_json::json!({})))
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(LtiExternalTool {
            id: row.get("id"),
            organization_id: row.get("organization_id"),
            course_id: row.get("course_id"),
            name: row.get("name"),
            launch_url: row.get("launch_url"),
            enabled: row.get("enabled"),
            config: row.get("config"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }),
    ))
}

pub async fn update_course_lti_tool(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, tool_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateLtiToolPayload>,
) -> Result<Json<LtiExternalTool>, (StatusCode, String)> {
    if let Some(url) = &payload.launch_url {
        if !url.starts_with("https://") {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                "launch_url debe usar HTTPS".to_string(),
            ));
        }
    }

    if let Some(secret) = &payload.shared_secret {
        if secret.trim().len() < 16 {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                "shared_secret debe tener al menos 16 caracteres".to_string(),
            ));
        }
    }

    let row = sqlx::query(
        r#"
        UPDATE lti_external_tools
        SET
            name          = COALESCE($4, name),
            launch_url    = COALESCE($5, launch_url),
            shared_secret = COALESCE($6, shared_secret),
            enabled       = COALESCE($7, enabled),
            config        = COALESCE($8, config),
            updated_at    = NOW()
        WHERE id = $1 AND organization_id = $2 AND course_id = $3
        RETURNING id, organization_id, course_id, name, launch_url, enabled, config, created_at, updated_at
        "#,
    )
    .bind(tool_id)
    .bind(org_ctx.id)
    .bind(course_id)
    .bind(payload.name)
    .bind(payload.launch_url)
    .bind(payload.shared_secret)
    .bind(payload.enabled)
    .bind(payload.config)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Herramienta LTI no encontrada".to_string()))?;

    Ok(Json(LtiExternalTool {
        id: row.get("id"),
        organization_id: row.get("organization_id"),
        course_id: row.get("course_id"),
        name: row.get("name"),
        launch_url: row.get("launch_url"),
        enabled: row.get("enabled"),
        config: row.get("config"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

pub async fn delete_course_lti_tool(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, tool_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let res = sqlx::query(
        "DELETE FROM lti_external_tools WHERE id = $1 AND organization_id = $2 AND course_id = $3",
    )
    .bind(tool_id)
    .bind(org_ctx.id)
    .bind(course_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Herramienta LTI no encontrada".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn lti_grade_passback(
    State(pool): State<PgPool>,
    Path(tool_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<LtiGradePassbackPayload>,
) -> Result<Json<LtiGradePassbackResponse>, (StatusCode, String)> {
    let signature_hex = headers
        .get("x-openccb-lti-signature")
        .and_then(|h| h.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Falta header x-openccb-lti-signature".to_string()))?;

    let timestamp = headers
        .get("x-openccb-lti-timestamp")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse::<i64>().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Falta header x-openccb-lti-timestamp válido".to_string()))?;

    let now = chrono::Utc::now().timestamp();
    if (now - timestamp).abs() > 300 {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Timestamp fuera de ventana permitida (5 minutos)".to_string(),
        ));
    }

    let tool_row = sqlx::query(
        "SELECT organization_id, course_id, shared_secret, enabled FROM lti_external_tools WHERE id = $1",
    )
    .bind(tool_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Herramienta LTI no encontrada".to_string()))?;

    let organization_id: Uuid = tool_row.get("organization_id");
    let course_id: Uuid = tool_row.get("course_id");
    let shared_secret: String = tool_row.get("shared_secret");
    let enabled: bool = tool_row.get("enabled");

    if !enabled {
        return Err((StatusCode::FORBIDDEN, "La herramienta está deshabilitada".to_string()));
    }

    let max_score_for_sig = payload.max_score.unwrap_or(1.0).max(0.0001);
    let lesson_marker = payload
        .lesson_id
        .map(|id| id.to_string())
        .unwrap_or_else(|| "-".to_string());
    let canonical = format!(
        "{}:{}:{}:{}:{}:{}",
        timestamp,
        tool_id,
        payload.user_id,
        lesson_marker,
        payload.score.to_bits(),
        max_score_for_sig.to_bits(),
    );

    let provided_sig_bytes = hex::decode(signature_hex)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Firma inválida (hex)".to_string()))?;

    type HmacSha256 = Hmac<Sha256>;
    let mut verifier = HmacSha256::new_from_slice(shared_secret.as_bytes())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno de firma".to_string()))?;
    verifier.update(canonical.as_bytes());

    if verifier.verify_slice(&provided_sig_bytes).is_err() {
        return Err((StatusCode::UNAUTHORIZED, "Firma de passback inválida".to_string()));
    }

    // Asegurar que el usuario existe y pertenece a la misma organización
    let user_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND organization_id = $2)",
    )
    .bind(payload.user_id)
    .bind(organization_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !user_exists {
        return Err((StatusCode::UNPROCESSABLE_ENTITY, "user_id inválido para esta organización".to_string()));
    }

    // Si viene lesson_id, validar que pertenece al curso
    if let Some(lesson_id) = payload.lesson_id {
        let lesson_ok: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM lessons l
                JOIN modules m ON m.id = l.module_id
                WHERE l.id = $1
                  AND m.course_id = $2
                  AND l.organization_id = $3
            )
            "#,
        )
        .bind(lesson_id)
        .bind(course_id)
        .bind(organization_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if !lesson_ok {
            return Err((StatusCode::UNPROCESSABLE_ENTITY, "lesson_id no pertenece al curso".to_string()));
        }
    }

    let max_score = payload.max_score.unwrap_or(1.0).max(0.0001);
    let mut normalized = payload.score / max_score;
    if normalized.is_nan() || !normalized.is_finite() {
        normalized = 0.0;
    }
    normalized = normalized.clamp(0.0, 1.0);

    // Persistir evento de passback para auditoría
    let status_for_event = payload.status.clone();

    sqlx::query(
        r#"
        INSERT INTO lti_grade_passback_events
        (organization_id, tool_id, user_id, course_id, lesson_id, raw_score, max_score, normalized_score, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(organization_id)
    .bind(tool_id)
    .bind(payload.user_id)
    .bind(course_id)
    .bind(payload.lesson_id)
    .bind(payload.score)
    .bind(max_score)
    .bind(normalized)
    .bind(status_for_event)
    .bind(payload.metadata.clone().unwrap_or(serde_json::json!({})))
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Sincronizar con gradebook solo cuando hay lesson_id
    if let Some(lesson_id) = payload.lesson_id {
        let metadata = serde_json::json!({
            "lti_passback": {
                "tool_id": tool_id,
                "status": payload.status,
                "raw_score": payload.score,
                "max_score": max_score,
                "normalized": normalized,
                "at": chrono::Utc::now(),
                "extra": payload.metadata
            }
        });

        sqlx::query(
            r#"
            INSERT INTO user_grades (organization_id, user_id, course_id, lesson_id, score, metadata, attempts_count)
            VALUES ($1, $2, $3, $4, $5, $6, 1)
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET
                score = EXCLUDED.score,
                metadata = COALESCE(user_grades.metadata, '{}'::jsonb) || EXCLUDED.metadata,
                attempts_count = user_grades.attempts_count + 1
            "#,
        )
        .bind(organization_id)
        .bind(payload.user_id)
        .bind(course_id)
        .bind(lesson_id)
        .bind(normalized)
        .bind(metadata)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(LtiGradePassbackResponse {
        success: true,
        tool_id,
        user_id: payload.user_id,
        course_id,
        lesson_id: payload.lesson_id,
        normalized_score: normalized,
    }))
}

// ─── Rotación de Secreto LTI (Fase 37) ───────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RotateSecretResponse {
    pub tool_id: Uuid,
    pub new_secret: String,
    pub rotated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn rotate_lti_tool_secret(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, tool_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<RotateSecretResponse>, (StatusCode, String)> {
    use rand::Rng;

    // Verificar que la herramienta pertenece al curso y organización
    let tool_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM lti_external_tools WHERE id = $1 AND course_id = $2 AND organization_id = $3)",
    )
    .bind(tool_id)
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !tool_exists {
        return Err((StatusCode::NOT_FOUND, "Herramienta LTI no encontrada".to_string()));
    }

    // Generar nuevo secreto aleatorio de 32 caracteres alfanuméricos
    let new_secret: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    let now = chrono::Utc::now();

    sqlx::query(
        "UPDATE lti_external_tools SET shared_secret = $1, updated_at = $2 WHERE id = $3",
    )
    .bind(&new_secret)
    .bind(now)
    .bind(tool_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!(
        "rotate_lti_tool_secret: rotated secret for tool {} in course {} org {}",
        tool_id, course_id, org_ctx.id
    );

    Ok(Json(RotateSecretResponse {
        tool_id,
        new_secret,
        rotated_at: now,
    }))
}
