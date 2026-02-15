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

    // 3. Call Mercado Pago API
    let mp_access_token = std::env::var("MP_ACCESS_TOKEN").unwrap_or_default();
    let back_url_success = std::env::var("MP_BACK_URL_SUCCESS").unwrap_or_default();
    let back_url_failure = std::env::var("MP_BACK_URL_FAILURE").unwrap_or_default();
    let notification_url = std::env::var("MP_NOTIFICATION_URL").unwrap_or_default();

    let client = reqwest::Client::new();
    let preference_payload = serde_json::json!({
        "items": [
            {
                "id": course_id.to_string(),
                "title": course.title,
                "quantity": 1,
                "unit_price": course.price,
                "currency_id": course.currency
            }
        ],
        "back_urls": {
            "success": back_url_success,
            "failure": back_url_failure,
            "pending": back_url_failure
        },
        "auto_return": "approved",
        "notification_url": notification_url,
        "external_reference": transaction_id.to_string(),
        "metadata": {
            "course_id": course_id,
            "user_id": user_id,
            "transaction_id": transaction_id
        }
    });

    let mp_response = client
        .post("https://api.mercadopago.com/checkout/preferences")
        .header("Authorization", format!("Bearer {}", mp_access_token))
        .json(&preference_payload)
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("MP Error: {}", e),
            )
        })?;

    if !mp_response.status().is_success() {
        let err_text = mp_response.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("MP API Error: {}", err_text),
        ));
    }

    let mp_data: serde_json::Value = mp_response.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to parse MP response: {}", e),
        )
    })?;

    let preference_id = mp_data["id"].as_str().unwrap_or_default().to_string();
    let init_point = mp_data["init_point"]
        .as_str()
        .unwrap_or_default()
        .to_string();

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
    let mp_access_token = std::env::var("MP_ACCESS_TOKEN").unwrap_or_default();

    // 1. Fetch payment details from Mercado Pago to verify status
    let client = reqwest::Client::new();
    let mp_response = client
        .get(format!(
            "https://api.mercadopago.com/v1/payments/{}",
            payment_id
        ))
        .header("Authorization", format!("Bearer {}", mp_access_token))
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !mp_response.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let payment_data: serde_json::Value = mp_response
        .json()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let status = payment_data["status"].as_str().unwrap_or("pending");
    let external_reference = payment_data["external_reference"]
        .as_str()
        .unwrap_or_default();

    if status != "approved" {
        return Ok(StatusCode::OK); // Payment not yet approved, wait for next notification
    }

    // 2. Find transaction by external reference (transaction_id)
    let transaction: Option<(Uuid, Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, user_id, course_id FROM transactions WHERE id = $1 OR provider_reference = $1",
    )
    .bind(&external_reference) // Try by external reference first
    .fetch_optional(&pool)
    .await
    .unwrap_or(None);

    if let Some((trans_id, user_id, course_id)) = transaction {
        // Mark transaction as success
        sqlx::query("UPDATE transactions SET status = 'success', updated_at = NOW() WHERE id = $1")
            .bind(trans_id)
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
