use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::models::{CreateLibraryBlockPayload, LibraryBlock, UpdateLibraryBlockPayload};
use common::{auth::Claims, middleware::Org};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct LibraryBlockFilters {
    #[serde(rename = "type")]
    pub block_type: Option<String>,
    pub tags: Option<String>, // Lista separada por comas
    pub search: Option<String>,
}

/// POST /api/library/blocks - Guardar un bloque en la biblioteca
pub async fn create_library_block(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateLibraryBlockPayload>,
) -> Result<Json<LibraryBlock>, (StatusCode, String)> {
    let block: LibraryBlock = sqlx::query_as(
        r#"
        INSERT INTO library_blocks (organization_id, created_by, name, description, block_type, block_data, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, organization_id, created_by, name, description, block_type, block_data, tags, usage_count, created_at, updated_at
        "#
    )
    .bind(org_ctx.id)
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.block_type)
    .bind(&payload.block_data)
    .bind(payload.tags.as_deref())
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(block))
}

/// GET /api/library/blocks - Listar bloques de la biblioteca
pub async fn list_library_blocks(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<LibraryBlockFilters>,
) -> Result<Json<Vec<LibraryBlock>>, (StatusCode, String)> {
    // Consulta base
    let mut query = String::from("SELECT * FROM library_blocks WHERE organization_id = $1");
    let mut param_count = 1;

    // Filtro por tipo
    if filters.block_type.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND block_type = ${}", param_count));
    }

    // Filtro por tags (busca si algún tag coincide)
    if filters.tags.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND tags && ${}", param_count));
    }

    // Búsqueda en nombre y descripción
    if filters.search.is_some() {
        param_count += 1;
        query.push_str(&format!(
            " AND (name ILIKE ${0} OR description ILIKE ${0})",
            param_count
        ));
    }

    query.push_str(" ORDER BY created_at DESC");

    // Construir consulta con bind dinámico
    let mut sql_query = sqlx::query_as::<_, LibraryBlock>(&query).bind(org_ctx.id);

    if let Some(block_type) = &filters.block_type {
        sql_query = sql_query.bind(block_type);
    }

    if let Some(tags_str) = &filters.tags {
        let tags: Vec<String> = tags_str.split(',').map(|s| s.trim().to_string()).collect();
        sql_query = sql_query.bind(tags);
    }

    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    if let Some(ref pattern) = search_pattern {
        sql_query = sql_query.bind(pattern);
    }

    let blocks = sql_query
        .fetch_all(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(blocks))
}

/// GET /api/library/blocks/:id - Obtener un bloque específico
pub async fn get_library_block(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(block_id): Path<Uuid>,
) -> Result<Json<LibraryBlock>, (StatusCode, String)> {
    let block: Option<LibraryBlock> = sqlx::query_as(
        r#"SELECT id, organization_id, created_by, name, description, block_type, block_data, tags, usage_count, created_at, updated_at FROM library_blocks WHERE id = $1 AND organization_id = $2"#
    )
    .bind(block_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    match block {
        Some(b) => Ok(Json(b)),
        None => Err((StatusCode::NOT_FOUND, "Bloque no encontrado".to_string())),
    }
}

/// PUT /api/library/blocks/:id - Actualizar bloque (nombre, descripción, tags)
pub async fn update_library_block(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(block_id): Path<Uuid>,
    Json(payload): Json<UpdateLibraryBlockPayload>,
) -> Result<Json<LibraryBlock>, (StatusCode, String)> {
    // Verificar que el bloque existe y pertenece a la org
    let existing = sqlx::query("SELECT id FROM library_blocks WHERE id = $1 AND organization_id = $2")
        .bind(block_id)
        .bind(org_ctx.id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if existing.is_none() {
        return Err((StatusCode::NOT_FOUND, "Bloque no encontrado".to_string()));
    }

    // Update dinámico basado en campos provistos
    let updated = if let Some(name) = &payload.name {
        sqlx::query_as(
            r#"
            UPDATE library_blocks 
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                tags = COALESCE($3, tags),
                updated_at = NOW()
            WHERE id = $4 AND organization_id = $5
            RETURNING id, organization_id, created_by, name, description, block_type, block_data, tags, usage_count, created_at, updated_at
            "#
        )
        .bind(Some(name))
        .bind(payload.description)
        .bind(payload.tags.as_deref())
        .bind(block_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    } else {
        sqlx::query_as(
            r#"
            UPDATE library_blocks 
            SET description = COALESCE($1, description),
                tags = COALESCE($2, tags),
                updated_at = NOW()
            WHERE id = $3 AND organization_id = $4
            RETURNING id, organization_id, created_by, name, description, block_type, block_data, tags, usage_count, created_at, updated_at
            "#
        )
        .bind(payload.description)
        .bind(payload.tags.as_deref())
        .bind(block_id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    };

    Ok(Json(updated))
}

/// DELETE /api/library/blocks/:id - Eliminar bloque
pub async fn delete_library_block(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(block_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM library_blocks WHERE id = $1 AND organization_id = $2")
        .bind(block_id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Bloque no encontrado".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/library/blocks/:id/increment-usage - Incrementar contador de uso
pub async fn increment_block_usage(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(block_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("UPDATE library_blocks SET usage_count = usage_count + 1 WHERE id = $1 AND organization_id = $2")
        .bind(block_id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Bloque no encontrado".to_string()));
    }

    Ok(StatusCode::OK)
}
