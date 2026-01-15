use axum::{
    extract::{FromRequestParts, Request},
    http::{request::Parts, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use uuid::Uuid;

use crate::auth::Claims;

/// Contexto de la organización extraído del JWT.
#[derive(Debug, Clone)]
pub struct OrgContext {
    pub id: Uuid,
}

/// Middleware que valida el token JWT y extrae el `organization_id`.
pub async fn org_extractor_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get("authorization")
        .and_then(|header: &axum::http::HeaderValue| header.to_str().ok());

    let token = if let Some(token_str) = auth_header.and_then(|s: &str| s.strip_prefix("Bearer ")) {
        token_str
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // NOTA: El secreto debe venir de una variable de entorno en producción.
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

    let mut claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?
    .claims;

    // Check for organization override header (only for admins)
    let org_id = if claims.role == "admin" {
        req.headers()
            .get("x-organization-id")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or(claims.org)
    } else {
        claims.org
    };

    // Update claims.org if overridden so downstream logic sees the new org
    if org_id != claims.org {
        claims.org = org_id;
    }

    // Insertamos el contexto y las claims en las extensiones de la petición.
    req.extensions_mut().insert(OrgContext { id: org_id });
    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}

impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts.extensions.get::<Claims>().cloned().ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Claims no encontradas. ¿El middleware está configurado?",
        ))
    }
}

/// Extractor de Axum para acceder fácilmente al `OrgContext` en los handlers.
#[derive(Debug, Clone)]
pub struct Org(pub OrgContext);

impl<S> FromRequestParts<S> for Org
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let org_context = parts.extensions.get::<OrgContext>().ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Contexto de organización no encontrado. ¿El middleware está configurado?",
        ))?;

        Ok(Org(org_context.clone()))
    }
}
