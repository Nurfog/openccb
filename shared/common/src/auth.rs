use chrono::{Duration, Utc};
use jsonwebtoken::{EncodingKey, Header, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub org: Uuid,
    pub exp: i64,
    pub role: String,
    pub course_id: Option<Uuid>,
    pub token_type: Option<String>, // "access", "preview"
}

pub fn create_jwt(
    user_id: Uuid,
    organization_id: Uuid,
    role: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_id,
        org: organization_id,
        exp: expiration,
        role: role.to_string(),
        course_id: None,
        token_type: Some("access".to_string()),
    };

    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET env var must be set");
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}

pub fn create_preview_token(
    user_id: Uuid,
    organization_id: Uuid,
    course_id: Uuid,
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(1))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_id,
        org: organization_id,
        exp: expiration,
        role: "instructor".to_string(),
        course_id: Some(course_id),
        token_type: Some("preview".to_string()),
    };

    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET env var must be set");
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}
