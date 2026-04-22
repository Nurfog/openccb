use axum::{
    Json,
    extract::State,
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct XapiStatementPayload {
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub verb: String,
    pub object_id: String,
    pub score: Option<f64>,
    pub progress: Option<f64>,
    pub completed: Option<bool>,
    pub raw_statement: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct XapiStatementResponse {
    pub id: Uuid,
    pub message: String,
}

pub async fn track_xapi_statement(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<XapiStatementPayload>,
) -> Result<Json<XapiStatementResponse>, (StatusCode, String)> {
    if payload.verb.trim().is_empty() || payload.object_id.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "verb y object_id son requeridos".to_string(),
        ));
    }

    let statement_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO xapi_statements (
            id,
            organization_id,
            user_id,
            course_id,
            lesson_id,
            verb,
            object_id,
            score,
            progress,
            completed,
            raw_statement
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        "#,
    )
    .bind(statement_id)
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(payload.course_id)
    .bind(payload.lesson_id)
    .bind(payload.verb.trim())
    .bind(payload.object_id.trim())
    .bind(payload.score)
    .bind(payload.progress)
    .bind(payload.completed)
    .bind(payload.raw_statement)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(XapiStatementResponse {
        id: statement_id,
        message: "xAPI statement registrado".to_string(),
    }))
}
