use axum::{Json, extract::State, http::StatusCode};
use common::auth::Claims;
use common::middleware::Org;
use common::models::Course;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreatePaymentPayload {
    pub course_id: Uuid,
}

#[derive(Serialize)]
pub struct PaymentPreferenceResponse {
    pub preference_id: String,
    pub init_point: String,
}

pub async fn create_payment_preference(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePaymentPayload>,
) -> Result<Json<PaymentPreferenceResponse>, (StatusCode, String)> {
    let user_id = claims.sub;
    let course_id = payload.course_id;

    // 1. Get Course details
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
        .bind(course_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Course not found".into()))?;

    if course.price <= 0.0 {
        return Err((StatusCode::BAD_REQUEST, "Course is free".into()));
    }

    // 2. Create a pending transaction
    let transaction_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transactions (id, organization_id, user_id, course_id, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')"
    )
    .bind(transaction_id)
    .bind(org_ctx.id)
    .bind(user_id)
    .bind(course_id)
    .bind(course.price)
    .bind(&course.currency)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Call Mercado Pago API (Mocked for now as per plan)
    let preference_id = format!("pref_{}", Uuid::new_v4().simple());
    let init_point = format!(
        "https://www.mercadopago.cl/checkout/v1/redirect?pref_id={}",
        preference_id
    );

    // Update transaction with provider reference
    sqlx::query("UPDATE transactions SET provider_reference = $1 WHERE id = $2")
        .bind(&preference_id)
        .bind(transaction_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(PaymentPreferenceResponse {
        preference_id,
        init_point,
    }))
}

#[derive(Deserialize)]
pub struct MPWebhookPayload {
    pub action: String,
    pub data: MPWebhookData,
}

#[derive(Deserialize)]
pub struct MPWebhookData {
    pub id: String,
}

pub async fn mercadopago_webhook(
    State(pool): State<PgPool>,
    Json(payload): Json<MPWebhookPayload>,
) -> Result<StatusCode, StatusCode> {
    if payload.action != "payment.created" && payload.action != "payment.updated" {
        return Ok(StatusCode::OK);
    }

    let payment_id = payload.data.id;

    // Simplified success logic for the mock
    let transaction: Option<(Uuid, Uuid)> =
        sqlx::query_as("SELECT user_id, course_id FROM transactions WHERE provider_reference = $1")
            .bind(&payment_id)
            .fetch_optional(&pool)
            .await
            .unwrap_or(None);

    if let Some((user_id, course_id)) = transaction {
        sqlx::query("UPDATE transactions SET status = 'success', updated_at = NOW() WHERE provider_reference = $1")
            .bind(&payment_id)
            .execute(&pool)
            .await
            .ok();

        // Auto-enroll the user
        sqlx::query("INSERT INTO enrollments (id, user_id, course_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(course_id)
            .execute(&pool)
            .await
            .ok();
    }

    Ok(StatusCode::OK)
}
