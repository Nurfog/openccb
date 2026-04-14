use axum::{
    extract::{FromRequestParts, Request},
    http::{StatusCode, request::Parts},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{DecodingKey, Validation, decode};
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
        token_str.to_string()
    } else {
        // Verificar si hay preview_token en la cadena de consulta
        let query = req.uri().query().unwrap_or_default();
        let preview_token = query
            .split('&')
            .find(|part| part.starts_with("preview_token="))
            .and_then(|part| part.split('=').nth(1));

        if let Some(token) = preview_token {
            token.to_string()
        } else {
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // NOTA: El secreto debe venir de una variable de entorno en producción.
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

    let claims = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?
    .claims;

    // Forzar el uso de la organización por defecto para arquitectura single-tenant
    let org_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

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
        // Intentar obtener OrgContext del middleware
        if let Some(org_context) = parts.extensions.get::<OrgContext>() {
            return Ok(Org(org_context.clone()));
        }
        
        // Fallback: usar org por defecto (single-tenant architecture)
        // Este fallback es necesario si el middleware no ejecutó correctamente
        let default_org_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001")
            .map_err(|_| (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Invalid default organization ID",
            ))?;
        
        Ok(Org(OrgContext { id: default_org_id }))
    }
}
