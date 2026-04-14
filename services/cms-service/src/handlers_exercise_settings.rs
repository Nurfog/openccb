use axum::{
    Json,
    extract::State,
    http::StatusCode,
};
use common::auth::Claims;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::handlers::{log_action, Org};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct OrganizationExerciseSettings {
    pub organization_id: Uuid,
    pub audio_response_enabled: bool,
    pub hotspot_enabled: bool,
    pub memory_match_enabled: bool,
    pub peer_review_enabled: bool,
    pub role_playing_enabled: bool,
    pub mermaid_enabled: bool,
    pub code_lab_enabled: bool,
    pub certificates_enabled: bool,
}

impl OrganizationExerciseSettings {
    pub fn defaults(organization_id: Uuid) -> Self {
        Self {
            organization_id,
            audio_response_enabled: true,
            hotspot_enabled: true,
            memory_match_enabled: true,
            peer_review_enabled: true,
            role_playing_enabled: true,
            mermaid_enabled: false,
            code_lab_enabled: true,
            certificates_enabled: true,
        }
    }

    pub fn is_enabled(&self, feature: &str) -> bool {
        match feature {
            "audio-response" => self.audio_response_enabled,
            "hotspot" => self.hotspot_enabled,
            "memory-match" => self.memory_match_enabled,
            "peer-review" => self.peer_review_enabled,
            "role-playing" => self.role_playing_enabled,
            "mermaid" => self.mermaid_enabled,
            "code-lab" => self.code_lab_enabled,
            "certificates" => self.certificates_enabled,
            _ => true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateOrganizationExerciseSettingsPayload {
    pub audio_response_enabled: bool,
    pub hotspot_enabled: bool,
    pub memory_match_enabled: bool,
    pub peer_review_enabled: bool,
    pub role_playing_enabled: bool,
    pub mermaid_enabled: bool,
    pub code_lab_enabled: bool,
    pub certificates_enabled: bool,
}

pub async fn load_organization_exercise_settings(
    pool: &PgPool,
    organization_id: Uuid,
) -> Result<OrganizationExerciseSettings, sqlx::Error> {
    let settings = sqlx::query_as::<_, OrganizationExerciseSettings>(
        r#"
        SELECT
            organization_id,
            audio_response_enabled,
            hotspot_enabled,
            memory_match_enabled,
            peer_review_enabled,
            role_playing_enabled,
            mermaid_enabled,
            code_lab_enabled,
            certificates_enabled
        FROM organization_exercise_settings
        WHERE organization_id = $1
        "#,
    )
    .bind(organization_id)
    .fetch_optional(pool)
    .await?;

    Ok(settings.unwrap_or_else(|| OrganizationExerciseSettings::defaults(organization_id)))
}

async fn upsert_organization_exercise_settings(
    pool: &PgPool,
    organization_id: Uuid,
    payload: &UpdateOrganizationExerciseSettingsPayload,
) -> Result<OrganizationExerciseSettings, sqlx::Error> {
    sqlx::query_as::<_, OrganizationExerciseSettings>(
        r#"
        INSERT INTO organization_exercise_settings (
            organization_id,
            audio_response_enabled,
            hotspot_enabled,
            memory_match_enabled,
            peer_review_enabled,
            role_playing_enabled,
            mermaid_enabled,
            code_lab_enabled,
            certificates_enabled,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (organization_id) DO UPDATE SET
            audio_response_enabled = EXCLUDED.audio_response_enabled,
            hotspot_enabled = EXCLUDED.hotspot_enabled,
            memory_match_enabled = EXCLUDED.memory_match_enabled,
            peer_review_enabled = EXCLUDED.peer_review_enabled,
            role_playing_enabled = EXCLUDED.role_playing_enabled,
            mermaid_enabled = EXCLUDED.mermaid_enabled,
            code_lab_enabled = EXCLUDED.code_lab_enabled,
            certificates_enabled = EXCLUDED.certificates_enabled,
            updated_at = NOW()
        RETURNING
            organization_id,
            audio_response_enabled,
            hotspot_enabled,
            memory_match_enabled,
            peer_review_enabled,
            role_playing_enabled,
            mermaid_enabled,
            code_lab_enabled,
            certificates_enabled
        "#,
    )
    .bind(organization_id)
    .bind(payload.audio_response_enabled)
    .bind(payload.hotspot_enabled)
    .bind(payload.memory_match_enabled)
    .bind(payload.peer_review_enabled)
    .bind(payload.role_playing_enabled)
    .bind(payload.mermaid_enabled)
    .bind(payload.code_lab_enabled)
    .bind(payload.certificates_enabled)
    .fetch_one(pool)
    .await
}

pub async fn get_organization_exercise_settings(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<OrganizationExerciseSettings>, (StatusCode, String)> {
    let settings = load_organization_exercise_settings(&pool, org_ctx.id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al cargar configuración de ejercicios: {}", e),
            )
        })?;

    Ok(Json(settings))
}

pub async fn update_organization_exercise_settings(
    claims: Claims,
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateOrganizationExerciseSettingsPayload>,
) -> Result<Json<OrganizationExerciseSettings>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Se requiere acceso de administrador".into()));
    }

    let settings = upsert_organization_exercise_settings(&pool, org_ctx.id, &payload)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al guardar configuración de ejercicios: {}", e),
            )
        })?;

    log_action(
        &pool,
        claims.org,
        claims.sub,
        "UPDATE_EXERCISE_SETTINGS",
        "Organization",
        org_ctx.id,
        json!({
            "audio_response_enabled": settings.audio_response_enabled,
            "hotspot_enabled": settings.hotspot_enabled,
            "memory_match_enabled": settings.memory_match_enabled,
            "peer_review_enabled": settings.peer_review_enabled,
            "role_playing_enabled": settings.role_playing_enabled,
            "mermaid_enabled": settings.mermaid_enabled,
            "code_lab_enabled": settings.code_lab_enabled,
            "certificates_enabled": settings.certificates_enabled,
        }),
    )
    .await;

    Ok(Json(settings))
}
