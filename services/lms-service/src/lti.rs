use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Redirect},
    Form,
};
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, DecodingKey, Validation};
use serde::{Deserialize};
use sqlx::{PgPool};
use uuid::Uuid;
use common::models::{LtiLaunchClaims, LtiRegistration, User};
use common::auth::Claims;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

#[derive(Deserialize)]
pub struct LtiLoginParams {
    pub iss: String,
    pub login_hint: String,
    pub target_link_uri: String,
    pub lti_message_hint: Option<String>,
    pub client_id: Option<String>,
}

pub async fn lti_login_initiation(
    State(pool): State<PgPool>,
    Query(params): Query<LtiLoginParams>,
) -> Result<Redirect, (StatusCode, String)> {
    // 1. Find registration
    let registration = sqlx::query_as::<_, LtiRegistration>(
        "SELECT * FROM lti_registrations WHERE issuer = $1 AND ($2::text IS NULL OR client_id = $2)"
    )
    .bind(&params.iss)
    .bind(&params.client_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::BAD_REQUEST, "LTI Registration not found".to_string()))?;

    // 2. Generate state and nonce
    let state = Uuid::new_v4().to_string();
    let nonce = Uuid::new_v4().to_string();

    // 3. Store nonce
    sqlx::query("INSERT INTO lti_nonces (nonce) VALUES ($1)")
        .bind(&nonce)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 4. Construct redirect URL
    let mut url = format!(
        "{}?scope=openid&response_type=id_token&client_id={}&redirect_uri={}&login_hint={}&state={}&nonce={}&response_mode=form_post",
        registration.auth_login_url,
        registration.client_id,
        urlencoding::encode(&params.target_link_uri),
        urlencoding::encode(&params.login_hint),
        state,
        nonce
    );

    if let Some(hint) = params.lti_message_hint {
        url.push_str(&format!("&lti_message_hint={}", urlencoding::encode(&hint)));
    }

    Ok(Redirect::to(&url))
}

#[derive(Deserialize)]
pub struct LtiLaunchParams {
    pub id_token: String,
}

pub async fn validate_lti_jwt(
    id_token: &str,
    jwks_url: &str,
    client_id: &str,
) -> Result<LtiLaunchClaims, String> {
    let header = decode_header(id_token).map_err(|e| e.to_string())?;
    let kid = header.kid.ok_or("Missing kid in JWT header")?;

    // Fetch JWKS
    let jwks: JwkSet = reqwest::get(jwks_url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let jwk = jwks.find(&kid).ok_or("JWK not found for kid")?;
    let decoding_key = DecodingKey::from_jwk(jwk).map_err(|e| e.to_string())?;

    let mut validation = Validation::new(jsonwebtoken::Algorithm::RS256);
    validation.set_audience(&[client_id]);

    let token_data = decode::<LtiLaunchClaims>(id_token, &decoding_key, &validation)
        .map_err(|e| e.to_string())?;

    Ok(token_data.claims)
}

pub async fn lti_launch(
    State(pool): State<PgPool>,
    Form(payload): Form<LtiLaunchParams>,
) -> Result<Redirect, (StatusCode, String)> {
    // 1. Decode claims manually to find registration (since we don't have the key yet)
    let parts: Vec<&str> = payload.id_token.split('.').collect();
    if parts.len() != 3 {
        return Err((StatusCode::BAD_REQUEST, "Invalid JWT format".to_string()));
    }
    
    let decoded_claims = URL_SAFE_NO_PAD.decode(parts[1])
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid base64 in JWT payload: {}", e)))?;
    
    let claims: serde_json::Value = serde_json::from_slice(&decoded_claims)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid JSON in JWT payload: {}", e)))?;

    let iss = claims["iss"].as_str().ok_or((StatusCode::BAD_REQUEST, "Missing iss claim".to_string()))?;
    let aud_val = &claims["aud"];
    let aud = match aud_val {
        serde_json::Value::String(s) => s.as_str(),
        serde_json::Value::Array(arr) => arr[0].as_str().ok_or((StatusCode::BAD_REQUEST, "Invalid aud in array".to_string()))?,
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid aud claim".to_string())),
    };

    // 2. Find registration
    let registration = sqlx::query_as::<_, LtiRegistration>(
        "SELECT * FROM lti_registrations WHERE issuer = $1 AND client_id = $2"
    )
    .bind(iss)
    .bind(aud)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "LTI Registration not found for issuer/aud".to_string()))?;

    // 3. Validate JWT
    let lti_claims = validate_lti_jwt(&payload.id_token, &registration.jwks_url, &registration.client_id)
        .await
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("JWT validation failed: {}", e)))?;

    // 4. Verify nonce
    let nonce_exists = sqlx::query("DELETE FROM lti_nonces WHERE nonce = $1")
        .bind(&lti_claims.nonce)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .rows_affected() > 0;

    if !nonce_exists {
        return Err((StatusCode::BAD_REQUEST, "Invalid or expired nonce".to_string()));
    }

    // 5. Find or create user
    let email = lti_claims.email.clone().unwrap_or_else(|| format!("lti_{}@{}", lti_claims.subject, iss.replace("http://", "").replace("https://", "")));
    let full_name = lti_claims.name.clone().unwrap_or_else(|| "LTI User".to_string());

    let mut user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1 AND organization_id = $2"
    )
    .bind(&email)
    .bind(registration.organization_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if user.is_none() {
        let new_user_id = Uuid::new_v4();
        let role = if lti_claims.roles.iter().any(|r| r.contains("Instructor") || r.contains("Administrator")) {
            "instructor"
        } else {
            "student"
        };

        sqlx::query(
            "INSERT INTO users (id, organization_id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(new_user_id)
        .bind(registration.organization_id)
        .bind(&email)
        .bind("") 
        .bind(&full_name)
        .bind(role)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        user = Some(User {
            id: new_user_id,
            organization_id: registration.organization_id,
            email: email.clone(),
            password_hash: "".to_string(),
            full_name: full_name.clone(),
            role: role.to_string(),
            xp: 0,
            level: 1,
            avatar_url: None,
            bio: None,
            language: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        });
    }

    let user = user.unwrap();

    // 8. Redirect based on message type
    let experience_url = std::env::var("NEXT_PUBLIC_EXPERIENCE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let studio_url = std::env::var("NEXT_PUBLIC_STUDIO_URL").unwrap_or_else(|_| "http://localhost:3001".to_string());

    let token = common::auth::create_jwt(user.id, user.organization_id, &user.role)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create token: {}", e)))?;
    let redirect_target = lti_claims.resource_link.as_ref().map(|rl| rl.id.clone()).unwrap_or_default();

    if lti_claims.message_type == "LtiDeepLinkingRequest" {
        let settings = lti_claims.deep_linking_settings.ok_or((StatusCode::BAD_REQUEST, "Missing deep_linking_settings".to_string()))?;
        
        let dl_request_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO lti_deep_linking_requests (id, registration_id, deployment_id, return_url, data) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(dl_request_id)
        .bind(registration.id)
        .bind(&lti_claims.deployment_id)
        .bind(&settings.deep_link_return_url)
        .bind(&settings.data)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        Ok(Redirect::to(&format!("{}/lti/deep-linking?token={}&dl_token={}", studio_url, token, dl_request_id)))
    } else {
        Ok(Redirect::to(&format!("{}/lti/launch?token={}&target={}", experience_url, token, urlencoding::encode(&redirect_target))))
    }
}

use serde_json::json;

#[derive(Deserialize)]
pub struct LtiDeepLinkingResponsePayload {
    pub dl_token: String,
    pub items: Vec<common::models::LtiDeepLinkingContentItem>,
}

pub async fn lti_deep_linking_response(
    State(pool): State<PgPool>,
    claims: Claims, 
    Json(payload): Json<LtiDeepLinkingResponsePayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // 1. Retrieve and delete DL request
    let dl_id = Uuid::parse_str(&payload.dl_token).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid DL token".to_string()))?;
    
    let dl_request = sqlx::query(
        "DELETE FROM lti_deep_linking_requests WHERE id = $1 RETURNING registration_id, deployment_id, return_url, data"
    )
    .bind(dl_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::UNAUTHORIZED, "Invalid or expired DL request".to_string()))?;

    // Manual mapping since we can't use query!/query_as! easily for RETURNING without a struct
    let registration_id: Uuid = dl_request.get("registration_id");
    let deployment_id: String = dl_request.get("deployment_id");
    let _return_url: String = dl_request.get::<String, _>("return_url");
    let dl_data: Option<String> = dl_request.get("data");

    // 2. Find registration
    let registration = sqlx::query_as::<_, LtiRegistration>(
        "SELECT * FROM lti_registrations WHERE id = $1",
    )
    .bind(registration_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let now = chrono::Utc::now().timestamp();
    let response_claims = common::models::LtiDeepLinkingResponseClaims {
        issuer: registration.client_id, 
        subject: claims.sub.to_string(),
        audience: registration.issuer, 
        expires_at: now + 3600,
        issued_at: now,
        nonce: Uuid::new_v4().to_string(),
        message_type: "LtiDeepLinkingResponse".to_string(),
        version: "1.3.0".to_string(),
        deployment_id,
        content_items: payload.items,
        data: dl_data,
    };

    let private_key = crate::jwks::get_lti_private_key();
    let response_jwt = jsonwebtoken::encode(
        &jsonwebtoken::Header {
            kid: Some("openccb-lti-key-1".to_string()),
            alg: jsonwebtoken::Algorithm::RS256,
            ..Default::default()
        },
        &response_claims,
        &private_key,
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "jwt": response_jwt,
        "return_url": dl_request.get::<String, _>("return_url")
    })))
}

use axum::Json;
use sqlx::Row;
