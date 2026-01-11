use common::models::Webhook;
use hex;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::PgPool;
use uuid::Uuid;

pub struct WebhookService {
    pool: PgPool,
}

impl WebhookService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn dispatch(&self, org_id: Uuid, event_type: &str, payload: &serde_json::Value) {
        // 1. Fetch active webhooks for this org that are interested in this event
        let webhooks = match sqlx::query_as::<_, Webhook>(
            "SELECT * FROM webhooks WHERE organization_id = $1 AND is_active = TRUE AND $2 = ANY(events)"
        )
        .bind(org_id)
        .bind(event_type)
        .fetch_all(&self.pool)
        .await {
            Ok(w) => w,
            Err(e) => {
                tracing::error!("Failed to fetch webhooks for org {}: {}", org_id, e);
                return;
            }
        };

        if webhooks.is_empty() {
            return;
        }

        let client = reqwest::Client::new();
        let payload_str = payload.to_string();

        for webhook in webhooks {
            let mut request = client
                .post(&webhook.url)
                .header("Content-Type", "application/json")
                .header("X-OpenCCB-Event", event_type)
                .header("X-OpenCCB-Delivery", Uuid::new_v4().to_string());

            // Add signature if secret exists
            if let Some(secret) = &webhook.secret {
                let signature = generate_signature(secret, &payload_str);
                request = request.header("X-OpenCCB-Signature", signature);
            }

            let url = webhook.url.clone();
            let res = request.body(payload_str.clone()).send().await;

            match res {
                Ok(response) => {
                    if !response.status().is_success() {
                        tracing::warn!(
                            "Webhook delivery to {} (event: {}) failed with status {}",
                            url,
                            event_type,
                            response.status()
                        );
                    } else {
                        tracing::info!(
                            "Successfully delivered webhook to {} (event: {})",
                            url,
                            event_type
                        );
                    }
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to deliver webhook to {} (event: {}): {}",
                        url,
                        event_type,
                        e
                    );
                }
            }
        }
    }
}

fn generate_signature(secret: &str, payload: &str) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}
