//! Manejadores para embeddings de PGVector en la Base de Conocimientos (LMS)
//! Habilita la búsqueda semántica para el chat del tutor de IA con RAG

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::ai::{self, generate_embedding};
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ==================== Parámetros de Consulta ====================

#[derive(Debug, Deserialize)]
pub struct KnowledgeSearchFilters {
    pub query: String,
    pub course_id: Option<Uuid>,
    pub lesson_id: Option<Uuid>,
    pub limit: Option<i32>,
    pub threshold: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct KnowledgeSearchResult {
    pub id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Option<Uuid>,
    pub block_id: Option<Uuid>,
    pub content_chunk: String,
    pub similarity: f64,  // PostgreSQL vector similarity returns double precision
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateKnowledgeEmbeddingsResult {
    pub processed: i32,
    pub failed: i32,
    pub duration_ms: u64,
}

// ==================== Generar Embeddings ====================

/// POST /api/knowledge-base/embeddings/generate - Generate embeddings for all knowledge base entries
pub async fn generate_knowledge_embeddings(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<GenerateKnowledgeEmbeddingsResult>, (StatusCode, String)> {
    let start = std::time::Instant::now();
    
    // Crear cliente que acepte certificados inválidos (para desarrollo con certificados autofirmados)
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Obtener entradas de la base de conocimientos sin embeddings
    let entries: Vec<KnowledgeBaseEntry> = sqlx::query_as(
        r#"
        SELECT * FROM knowledge_base
        WHERE organization_id = $1
          AND (embedding IS NULL OR embedding_updated_at IS NULL)
        ORDER BY created_at DESC
        LIMIT 100
        "#
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    let _total = entries.len();
    let mut processed = 0;
    let mut failed = 0;
    
    for entry in entries {
        // Generar embedding desde el fragmento de contenido
        match generate_embedding(&client, &ollama_url, &model, &entry.content_chunk).await {
            Ok(response) => {
                let pgvector = ai::embedding_to_pgvector(&response.embedding);
                
                // Actualizar entrada con embedding
                let result: Result<(i64,), sqlx::Error> = sqlx::query_as(
                    r#"
                    UPDATE knowledge_base
                    SET embedding = $1::vector,
                        embedding_updated_at = NOW()
                    WHERE id = $2
                    RETURNING 1
                    "#
                )
                .bind(&pgvector)
                .bind(entry.id)
                .fetch_one(&pool)
                .await;
                
                if result.is_ok() {
                    processed += 1;
                } else {
                    failed += 1;
                }
            }
            Err(e) => {
                tracing::error!(
                    "Error al generar el embedding para la entrada de conocimiento {}: {}",
                    entry.id,
                    e
                );
                failed += 1;
            }
        }
    }
    
    let duration_ms = start.elapsed().as_millis() as u64;
    
    tracing::info!(
        "Generated knowledge embeddings: {} processed, {} failed in {}ms",
        processed,
        failed,
        duration_ms
    );
    
    Ok(Json(GenerateKnowledgeEmbeddingsResult {
        processed,
        failed,
        duration_ms,
    }))
}

/// POST /api/knowledge-base/{id}/embedding/regenerate - Regenerar embedding para una entrada específica
pub async fn regenerate_knowledge_embedding(
    Org(org_ctx): Org,
    Path(entry_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Crear cliente que acepte certificados inválidos
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Obtener entrada
    let entry: KnowledgeBaseEntry = sqlx::query_as(
        "SELECT * FROM knowledge_base WHERE id = $1 AND organization_id = $2"
    )
    .bind(entry_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Entrada de la base de conocimientos no encontrada".to_string()))?;
    
    // Generar embedding
    let response = generate_embedding(&client, &ollama_url, &model, &entry.content_chunk)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    let pgvector = ai::embedding_to_pgvector(&response.embedding);
    
    // Actualizar entrada
    sqlx::query(
        r#"
        UPDATE knowledge_base
        SET embedding = $1::vector,
            embedding_updated_at = NOW()
        WHERE id = $2
        "#
    )
    .bind(&pgvector)
    .bind(entry_id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    Ok(StatusCode::OK)
}

// ==================== Búsqueda Semántica ====================

/// GET /api/knowledge-base/semantic-search - Search knowledge base by semantic similarity
pub async fn semantic_search_knowledge(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<KnowledgeSearchFilters>,
) -> Result<Json<Vec<KnowledgeSearchResult>>, (StatusCode, String)> {
    // Crear cliente que acepte certificados inválidos
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Generar embedding para la consulta
    let embedding_response = generate_embedding(&client, &ollama_url, &model, &filters.query)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    let pgvector = ai::embedding_to_pgvector(&embedding_response.embedding);
    
    let limit = filters.limit.unwrap_or(10);
    let threshold = filters.threshold.unwrap_or(0.5);
    
    // Construir consulta con filtros opcionales
    let mut query = String::from(
        r#"
        SELECT 
            id,
            course_id,
            lesson_id,
            block_id,
            content_chunk,
            1 - (embedding <=> $1::vector) AS similarity,
            metadata
        FROM knowledge_base
        WHERE organization_id = $2
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) >= $3
        "#
    );
    
    let mut param_idx = 3;
    
    if let Some(_course_id) = filters.course_id {
        param_idx += 1;
        query.push_str(&format!(" AND course_id = ${}", param_idx));
    }
    
    if let Some(_lesson_id) = filters.lesson_id {
        param_idx += 1;
        query.push_str(&format!(" AND lesson_id = ${}", param_idx));
    }
    
    param_idx += 1;
    query.push_str(&format!(" ORDER BY embedding <=> $1::vector LIMIT ${}", param_idx));
    
    let mut sql_query = sqlx::query_as::<_, KnowledgeSearchResult>(&query)
        .bind(&pgvector)
        .bind(org_ctx.id)
        .bind(threshold);
    
    if let Some(course_id) = filters.course_id {
        sql_query = sql_query.bind(course_id);
    }
    
    if let Some(lesson_id) = filters.lesson_id {
        sql_query = sql_query.bind(lesson_id);
    }
    
    sql_query = sql_query.bind(limit);
    
    let results = sql_query
        .fetch_all(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    Ok(Json(results))
}

// ==================== Estructuras de Ayuda ====================

#[derive(Debug, sqlx::FromRow, Clone)]
#[allow(dead_code)]
struct KnowledgeBaseEntry {
    id: Uuid,
    organization_id: Uuid,
    course_id: Uuid,
    lesson_id: Option<Uuid>,
    block_id: Option<Uuid>,
    content_chunk: String,
    chunk_order: i32,
    metadata: Option<serde_json::Value>,
    #[allow(dead_code)]
    created_at: chrono::DateTime<chrono::Utc>,
}
