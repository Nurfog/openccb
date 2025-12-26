use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, Request, StatusCode},
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
pub async fn org_extractor_middleware<B>(
    mut req: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get("authorization")
        .and_then(|header| header.to_str().ok());

    let token = if let Some(token_str) = auth_header.and_then(|s| s.strip_prefix("Bearer ")) {
        token_str
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // NOTA: El secreto debe venir de una variable de entorno en producción.
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?
    .claims;

    // Insertamos el contexto en las extensiones de la petición.
    req.extensions_mut().insert(OrgContext { id: claims.org });

    Ok(next.run(req).await)
}

/// Extractor de Axum para acceder fácilmente al `OrgContext` en los handlers.
#[derive(Debug, Clone)]
pub struct Org(pub OrgContext);

#[async_trait]
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
