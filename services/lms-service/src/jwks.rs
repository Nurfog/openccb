use jsonwebtoken::jwk::{JwkSet, Jwk, CommonParameters, RSAKeyParameters, AlgorithmParameters};
use serde_json::json;
use std::env;

pub fn get_lti_private_key() -> jsonwebtoken::EncodingKey {
    let key_str = env::var("LTI_PRIVATE_KEY").unwrap_or_else(|_| {
        // Fallback for development (DO NOT USE IN PRODUCTION)
        include_str!("../dev_keys/lti_private.pem").to_string()
    });
    
    jsonwebtoken::EncodingKey::from_rsa_pem(key_str.as_bytes()).expect("Invalid LTI private key")
}

pub fn get_lti_jwks() -> JwkSet {
    let n = env::var("LTI_JWK_N").unwrap_or_else(|_| {
        "weIdo6QklIJW77oEAd0NvX_L1e6mFRpHbSrhWjEJTfQDzLdNV84zPfu-rP-IJdWlvrtO2F_dHHah0ilNRZCaAwPXNqS6L57OrYJjxeDXKWnnfaVw4uUT1aDGFcXQ55Bbf05-N28aj26NEXh9WQVqO6L8XRrleRUgJtb8MBAWovxKi3CBJ_lFVYe31cPeAOCaEF_xzeMVEmJt3fbSewsUIrB7jD8F3YOcu8h_QGAc9tn9uxMfBJv2XZoGHCtMQUGG07iZtoSKBYGrWf5rBc7PsCF_VuQzlO9cf13jgQ2rcfcU3LwC_gp4A9RYnv_ymaHELz0kALKBtBxj1XU7QdLrsw".to_string() 
    });

    let jwk = Jwk {
        common: CommonParameters {
            public_key_use: Some(jsonwebtoken::jwk::PublicKeyUse::Signature),
            key_operations: None,
            key_algorithm: Some(jsonwebtoken::jwk::KeyAlgorithm::RS256),
            key_id: Some("openccb-lti-key-1".to_string()),
            x509_url: None,
            x509_chain: None,
            x509_sha1_fingerprint: None,
            x509_sha256_fingerprint: None,
        },
        algorithm: AlgorithmParameters::RSA(RSAKeyParameters {
            key_type: jsonwebtoken::jwk::RSAKeyType::RSA,
            n,
            e: "AQAB".to_string(),
        }),
    };

    JwkSet { keys: vec![jwk] }
}

pub async fn lti_jwks_handler() -> axum::Json<serde_json::Value> {
    let jwks = get_lti_jwks();
    axum::Json(json!(jwks))
}
