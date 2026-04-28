//! Manejadores para incrustaciones (embeddings) de PGVector en el Banco de Preguntas
//! Habilita la búsqueda semántica y RAG con incrustaciones impulsadas por IA

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::ai::{self, generate_embedding};
use common::models::QuestionBank;
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ==================== Parámetros de Consulta ====================

#[derive(Debug, Deserialize)]
pub struct SemanticSearchFilters {
    pub query: String,
    pub limit: Option<i32>,
    pub threshold: Option<f64>,
    pub question_type: Option<String>,
    pub difficulty: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SemanticSearchResult {
    pub id: Uuid,
    pub question_text: String,
    pub question_type: String,
    pub similarity: f64,  // PostgreSQL vector similarity returns double precision
    pub tags: Option<Vec<String>>,
    pub difficulty: Option<String>,
    pub points: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateEmbeddingsResult {
    pub processed: i32,
    pub failed: i32,
    pub duration_ms: u64,
}

// ==================== Generar Incrustaciones (Embeddings) ====================

/// POST /api/question-bank/embeddings/generate - Generar incrustaciones para todas las preguntas que no las tengan
pub async fn generate_question_embeddings(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
) -> Result<Json<GenerateEmbeddingsResult>, (StatusCode, String)> {
    let start = std::time::Instant::now();
    
    // Crear cliente que acepte certificados inválidos (para desarrollo con certificados autofirmados)
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error del cliente HTTP: {}", e)))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Obtener preguntas sin incrustaciones
    let questions: Vec<QuestionBank> = sqlx::query_as(
        r#"
        SELECT * FROM question_bank
        WHERE organization_id = $1
          AND (embedding IS NULL OR embedding_updated_at IS NULL)
        ORDER BY created_at DESC
        LIMIT 100
        "#
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    let _total = questions.len();
    let mut processed = 0;
    let mut failed = 0;
    
    for question in questions {
        // Generar el texto de la incrustación (combinar pregunta + opciones + explicación)
        let mut embedding_text = question.question_text.clone();
        
        if let Some(options) = &question.options {
            if let Some(opts_str) = options.as_str() {
                embedding_text.push_str(" ");
                embedding_text.push_str(opts_str);
            } else if let Some(opts_arr) = options.as_array() {
                for opt in opts_arr {
                    if let Some(opt_str) = opt.as_str() {
                        embedding_text.push_str(" ");
                        embedding_text.push_str(opt_str);
                    }
                }
            }
        }
        
        if let Some(explanation) = &question.explanation {
            embedding_text.push_str(" ");
            embedding_text.push_str(explanation);
        }
        
        // Generar incrustación
        match generate_embedding(&client, &ollama_url, &model, &embedding_text).await {
            Ok(response) => {
                let pgvector = ai::embedding_to_pgvector(&response.embedding);

                // Actualizar pregunta con la incrustación
                let result: Result<(i64,), sqlx::Error> = sqlx::query_as(
                    r#"
                    UPDATE question_bank
                    SET embedding = $1::vector,
                        embedding_updated_at = NOW()
                    WHERE id = $2
                    RETURNING 1
                    "#
                )
                .bind(&pgvector)
                .bind(question.id)
                .fetch_one(&pool)
                .await;

                match result {
                    Ok(_) => {
                        processed += 1;
                        tracing::debug!("Incrustación generada para la pregunta {}", question.id);
                    }
                    Err(e) => {
                        failed += 1;
                        tracing::error!("Error al actualizar la incrustación para la pregunta {}: {}", question.id, e);
                    }
                }
            }
            Err(e) => {
                tracing::error!("Error al generar la incrustación para la pregunta {}: {}", question.id, e);
                failed += 1;
            }
        }
    }
    
    let duration_ms = start.elapsed().as_millis() as u64;
    
    tracing::info!(
        "Incrustaciones generadas: {} procesadas, {} fallidas en {}ms",
        processed,
        failed,
        duration_ms
    );
    
    Ok(Json(GenerateEmbeddingsResult {
        processed,
        failed,
        duration_ms,
    }))
}

/// POST /api/question-bank/:id/embedding/regenerate - Regenerar incrustación para una pregunta específica
pub async fn regenerate_question_embedding(
    Org(org_ctx): Org,
    Path(question_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Crear cliente que acepte certificados inválidos
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error del cliente HTTP: {}", e)))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Obtener pregunta
    let question: QuestionBank = sqlx::query_as(
        "SELECT * FROM question_bank WHERE id = $1 AND organization_id = $2"
    )
    .bind(question_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Pregunta no encontrada".to_string()))?;
    
    // Generar texto de la incrustación
    let mut embedding_text = question.question_text.clone();
    
    if let Some(options) = &question.options {
        if let Some(opts_str) = options.as_str() {
            embedding_text.push_str(" ");
            embedding_text.push_str(opts_str);
        } else if let Some(opts_arr) = options.as_array() {
            for opt in opts_arr {
                if let Some(opt_str) = opt.as_str() {
                    embedding_text.push_str(" ");
                    embedding_text.push_str(opt_str);
                }
            }
        }
    }
    
    if let Some(explanation) = &question.explanation {
        embedding_text.push_str(" ");
        embedding_text.push_str(explanation);
    }
    
    // Generar incrustación
    let response = generate_embedding(&client, &ollama_url, &model, &embedding_text)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error de IA: {}", e)))?;
    
    let pgvector = ai::embedding_to_pgvector(&response.embedding);
    
    // Actualizar pregunta
    sqlx::query(
        r#"
        UPDATE question_bank
        SET embedding = $1::vector,
            embedding_updated_at = NOW()
        WHERE id = $2
        "#
    )
    .bind(&pgvector)
    .bind(question_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    Ok(StatusCode::OK)
}

// ==================== Búsqueda Semántica ====================

/// GET /api/question-bank/semantic-search - Buscar preguntas por similitud semántica
pub async fn semantic_search(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Query(filters): Query<SemanticSearchFilters>,
) -> Result<Json<Vec<SemanticSearchResult>>, (StatusCode, String)> {
    // Crear cliente que acepte certificados inválidos
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error del cliente HTTP: {}", e)))?;
    
    let ollama_url = ai::get_ollama_url();
    let model = ai::get_embedding_model();
    
    // Generar incrustación para la consulta
    let embedding_response = generate_embedding(&client, &ollama_url, &model, &filters.query)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error de IA: {}", e)))?;
    
    let pgvector = ai::embedding_to_pgvector(&embedding_response.embedding);
    
    let limit = filters.limit.unwrap_or(20);
    let threshold = filters.threshold.unwrap_or(0.5);
    
    // Construir consulta con filtros opcionales
    let mut query = String::from(
        r#"
        SELECT
            id,
            question_text,
            question_type::text,
            1 - (embedding <=> $1::vector) AS similarity,
            tags,
            difficulty,
            points
        FROM question_bank
        WHERE organization_id = $2
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) >= $3
        "#
    );
    
    let mut param_idx = 3;
    
    if filters.question_type.is_some() {
        param_idx += 1;
        query.push_str(&format!(" AND question_type::text = ${}", param_idx));
    }
    
    if filters.difficulty.is_some() {
        param_idx += 1;
        query.push_str(&format!(" AND difficulty = ${}", param_idx));
    }
    
    param_idx += 1;
    query.push_str(&format!(" ORDER BY embedding <=> $1::vector LIMIT ${}", param_idx));
    
    let mut sql_query = sqlx::query_as::<_, SemanticSearchResult>(&query)
        .bind(&pgvector)
        .bind(org_ctx.id)
        .bind(threshold);
    
    if let Some(ref question_type) = filters.question_type {
        sql_query = sql_query.bind(question_type);
    }
    
    if let Some(ref difficulty) = filters.difficulty {
        sql_query = sql_query.bind(difficulty);
    }
    
    sql_query = sql_query.bind(limit);
    
    let results = sql_query
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    
    Ok(Json(results))
}

/// GET /api/question-bank/similar/:id - Encontrar preguntas similares a una pregunta dada
pub async fn find_similar_questions(
    Org(org_ctx): Org,
    Path(question_id): Path<Uuid>,
    Query(params): Query<SimilarityParams>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<SemanticSearchResult>>, (StatusCode, String)> {
    let threshold = params.threshold.unwrap_or(0.85);
    let limit = params.limit.unwrap_or(10);
    
    let results = sqlx::query_as::<_, SemanticSearchResult>(
        r#"
        SELECT 
            id,
            question_text,
            question_type::text,
            1 - (embedding <=> (SELECT embedding FROM question_bank WHERE id = $1)) AS similarity,
            tags,
            difficulty,
            points
        FROM question_bank
        WHERE id != $1
          AND organization_id = $2
          AND embedding IS NOT NULL
        ORDER BY embedding <=> (SELECT embedding FROM question_bank WHERE id = $1)
        LIMIT $3
        "#
    )
    .bind(question_id)
    .bind(org_ctx.id)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .into_iter()
    .filter(|r| r.similarity >= threshold)
    .collect();

    Ok(Json(results))
}

#[derive(Debug, Deserialize)]
pub struct SimilarityParams {
    pub threshold: Option<f64>,
    pub limit: Option<i32>,
}
