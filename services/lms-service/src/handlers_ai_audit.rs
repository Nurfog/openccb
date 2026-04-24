use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

fn ensure_audit_reviewer_role(claims: &Claims) -> Result<(), (StatusCode, String)> {
    if claims.role != "admin" && claims.role != "instructor" {
        return Err((StatusCode::FORBIDDEN, "No autorizado".to_string()));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct AiAuditFilters {
    pub reviewed: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewAiLogPayload {
    pub reviewed: bool,
    pub reviewer_note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AiAuditItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub student_name: Option<String>,
    pub endpoint: String,
    pub model: String,
    pub output_tokens: i32,
    pub has_rag_context: bool,
    pub risk_score: i32,
    pub risk_signals: Vec<String>,
    pub response_excerpt: String,
    pub reviewed: bool,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_by_name: Option<String>,
    pub reviewer_note: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct AiAuditListResponse {
    pub items: Vec<AiAuditItem>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize)]
pub struct ReviewAiLogResponse {
    pub id: Uuid,
    pub reviewed: bool,
}

/// Peso de cada señal para calcular el risk_score ponderado.
/// Señales de mayor impacto tienen peso > 1.
fn signal_weight(signal: &str) -> i32 {
    match signal {
        "sensitive_data_mention" => 3,
        "url_fabrication" | "citation_without_rag" | "knowledge_disclaimer" => 2,
        _ => 1,
    }
}

fn risk_signals_from_log(response: &str, has_rag_context: bool, output_tokens: i32) -> Vec<String> {
    let mut signals = Vec::new();
    let response_lc = response.to_lowercase();

    // ── Señal 1: ausencia de contexto RAG ────────────────────────────────────
    if !has_rag_context {
        signals.push("missing_rag_context".to_string());
    }

    // ── Señal 2: tokens de salida excesivos ──────────────────────────────────
    if output_tokens >= 900 {
        signals.push("high_output_tokens".to_string());
    }

    // ── Señal 3: respuesta muy larga en caracteres ───────────────────────────
    if response.chars().count() >= 2200 {
        signals.push("long_response".to_string());
    }

    // ── Señal 4: lenguaje de certeza absoluta ────────────────────────────────
    let absolute_claim_markers = [
        "siempre",
        "nunca",
        "definitivamente",
        "sin duda",
        "100%",
        "completamente seguro",
        "es un hecho que",
        "está demostrado que",
        "es imposible que",
    ];
    if absolute_claim_markers
        .iter()
        .any(|marker| response_lc.contains(marker))
    {
        signals.push("absolute_claim_language".to_string());
    }

    // ── Señal 5: citas/referencias sin contexto RAG ──────────────────────────
    let citation_like_markers = [
        "segun el documento",
        "según el documento",
        "fuente:",
        "referencia:",
        "[1]",
        "[2]",
        "[3]",
        "(ver bibliografía)",
        "de acuerdo con la fuente",
    ];
    if !has_rag_context
        && citation_like_markers
            .iter()
            .any(|marker| response_lc.contains(marker))
    {
        signals.push("citation_without_rag".to_string());
    }

    // ── Señal 6: IA admite desconocer (paradoja: responde igualmente) ────────
    let disclaimer_markers = [
        "no tengo información sobre",
        "no puedo confirmar",
        "no tengo acceso a",
        "desconozco",
        "no estoy seguro de si",
        "no cuento con información",
        "no tengo conocimiento de",
        "mis datos de entrenamiento",
        "más allá de mi conocimiento",
    ];
    if disclaimer_markers
        .iter()
        .any(|marker| response_lc.contains(marker))
    {
        signals.push("knowledge_disclaimer".to_string());
    }

    // ── Señal 7: URLs fabricadas sin RAG ─────────────────────────────────────
    if !has_rag_context && (response_lc.contains("https://") || response_lc.contains("http://")) {
        signals.push("url_fabrication".to_string());
    }

    // ── Señal 8: datos sensibles/personales mencionados ──────────────────────
    let sensitive_markers = [
        "contraseña",
        "password",
        "cédula",
        "cedula",
        "número de tarjeta",
        "numero de tarjeta",
        "cvv",
        " pin ",
        "número de cuenta",
        "numero de cuenta",
        "datos bancarios",
        "información personal",
        "número de identificación",
    ];
    if sensitive_markers
        .iter()
        .any(|marker| response_lc.contains(marker))
    {
        signals.push("sensitive_data_mention".to_string());
    }

    // ── Señal 9: certeza alta sin RAG ("la respuesta es…") ───────────────────
    let high_certainty_markers = [
        "la respuesta correcta es",
        "la solución correcta es",
        "la respuesta es ",
        "el resultado exacto es",
        "está comprobado que",
        "es correcto afirmar que",
        "queda demostrado que",
    ];
    if !has_rag_context
        && high_certainty_markers
            .iter()
            .any(|marker| response_lc.contains(marker))
    {
        signals.push("high_certainty_no_rag".to_string());
    }

    // ── Señal 10: contenido repetido (posible loop/alucinación) ──────────────
    {
        let sentences: Vec<&str> = response
            .split(['.', '\n'])
            .map(str::trim)
            .filter(|s| s.chars().count() >= 40)
            .collect();
        let mut seen = std::collections::HashMap::<&str, usize>::new();
        for s in &sentences {
            *seen.entry(s).or_insert(0) += 1;
        }
        if seen.values().any(|&count| count >= 3) {
            signals.push("repeated_content".to_string());
        }
    }

    signals
}

/// Calcula el score ponderado sumando el peso de cada señal detectada.
pub fn weighted_risk_score(signals: &[String]) -> i32 {
    signals.iter().map(|s| signal_weight(s)).sum()
}

fn build_excerpt(text: &str, max_chars: usize) -> String {
    let mut out = String::new();
    for ch in text.chars().take(max_chars) {
        out.push(ch);
    }
    if text.chars().count() > max_chars {
        out.push_str("...");
    }
    out
}

pub async fn list_ai_audit_logs(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<AiAuditFilters>,
) -> Result<Json<AiAuditListResponse>, (StatusCode, String)> {
    ensure_audit_reviewer_role(&claims)?;

    let limit = filters.limit.unwrap_or(50).clamp(1, 200);
    let offset = filters.offset.unwrap_or(0).max(0);

    let rows = sqlx::query(
        r#"
        SELECT
            a.id,
            a.user_id,
            u.full_name AS student_name,
            a.endpoint,
            a.model,
            a.output_tokens,
            a.response,
            a.request_metadata,
            a.created_at,
            COALESCE((a.request_metadata->>'audit_reviewed')::boolean, false) AS reviewed,
            CASE
                WHEN COALESCE(a.request_metadata->>'audit_reviewed_by', '') ~* '^[0-9a-fA-F-]{36}$'
                THEN (a.request_metadata->>'audit_reviewed_by')::uuid
                ELSE NULL
            END AS reviewed_by,
            rv.full_name AS reviewed_by_name,
            a.request_metadata->>'audit_review_note' AS reviewer_note
        FROM ai_usage_logs a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN users rv ON rv.id = (
            CASE
                WHEN COALESCE(a.request_metadata->>'audit_reviewed_by', '') ~* '^[0-9a-fA-F-]{36}$'
                THEN (a.request_metadata->>'audit_reviewed_by')::uuid
                ELSE NULL
            END
        )
        WHERE a.organization_id = $1
          AND a.request_type = 'chat'
          AND ($2::boolean IS NULL OR COALESCE((a.request_metadata->>'audit_reviewed')::boolean, false) = $2::boolean)
        ORDER BY a.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(org_ctx.id)
    .bind(filters.reviewed)
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al listar auditoría de IA: {}", e)))?;

    let mut items = Vec::new();

    for row in rows {
        let metadata: Option<Value> = row.get("request_metadata");
        let has_rag_context = metadata
            .as_ref()
            .and_then(|m| m.get("has_rag"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let response: String = row.get::<Option<String>, _>("response").unwrap_or_default();
        let output_tokens: i32 = row.get("output_tokens");

        let risk_signals = risk_signals_from_log(&response, has_rag_context, output_tokens);
        if risk_signals.is_empty() {
            continue;
        }
        let risk_score = weighted_risk_score(&risk_signals);

        items.push(AiAuditItem {
            id: row.get("id"),
            user_id: row.get("user_id"),
            student_name: row.get("student_name"),
            endpoint: row.get("endpoint"),
            model: row.get("model"),
            output_tokens,
            has_rag_context,
            risk_score,
            risk_signals,
            response_excerpt: build_excerpt(&response, 240),
            reviewed: row.get("reviewed"),
            reviewed_by: row.get("reviewed_by"),
            reviewed_by_name: row.get("reviewed_by_name"),
            reviewer_note: row.get("reviewer_note"),
            created_at: row.get("created_at"),
        });
    }

    Ok(Json(AiAuditListResponse {
        items,
        limit,
        offset,
    }))
}

pub async fn review_ai_audit_log(
    Org(org_ctx): Org,
    claims: Claims,
    Path(log_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<ReviewAiLogPayload>,
) -> Result<Json<ReviewAiLogResponse>, (StatusCode, String)> {
    ensure_audit_reviewer_role(&claims)?;

    let note = payload
        .reviewer_note
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .to_string();

    let note_or_null = if note.is_empty() { None } else { Some(note) };

    let updated = sqlx::query(
        r#"
        UPDATE ai_usage_logs
        SET request_metadata = COALESCE(request_metadata, '{}'::jsonb) || jsonb_strip_nulls(
                jsonb_build_object(
                    'audit_reviewed', $3::boolean,
                    'audit_reviewed_by', $4::text,
                    'audit_reviewed_at', NOW()::text,
                    'audit_review_note', $5::text
                )
            )
        WHERE id = $1
          AND organization_id = $2
          AND request_type = 'chat'
        "#,
    )
    .bind(log_id)
    .bind(org_ctx.id)
    .bind(payload.reviewed)
    .bind(claims.sub.to_string())
    .bind(note_or_null)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error al actualizar auditoría IA: {}", e)))?;

    if updated.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Registro de auditoría no encontrado".to_string()));
    }

    Ok(Json(ReviewAiLogResponse {
        id: log_id,
        reviewed: payload.reviewed,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas de auditoría IA
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AiAuditMetricsFilters {
    pub days: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AiAuditMetrics {
    pub days: i32,
    pub total_chat_logs: i64,
    pub total_flagged: i64,
    pub total_reviewed: i64,
    pub flagged_pct: f64,
    pub reviewed_pct: f64,
    pub signal_counts: std::collections::HashMap<String, i64>,
    pub weighted_score_distribution: WeightedScoreDist,
}

#[derive(Debug, Serialize)]
pub struct WeightedScoreDist {
    pub low: i64,      // score 1–2
    pub medium: i64,   // score 3–5
    pub high: i64,     // score ≥ 6
}

pub async fn get_ai_audit_metrics(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<AiAuditMetricsFilters>,
) -> Result<Json<AiAuditMetrics>, (StatusCode, String)> {
    ensure_audit_reviewer_role(&claims)?;

    let days = filters.days.unwrap_or(30).clamp(1, 365);

    // Totales agregados de la BD
    let totals = sqlx::query(
        r#"
        SELECT
            COUNT(*)::BIGINT AS total_chat,
            SUM(CASE WHEN COALESCE((request_metadata->>'audit_reviewed')::boolean, false) THEN 1 ELSE 0 END)::BIGINT AS reviewed
        FROM ai_usage_logs
        WHERE organization_id = $1
          AND request_type = 'chat'
          AND created_at >= NOW() - ($2 || ' days')::interval
        "#,
    )
    .bind(org_ctx.id)
    .bind(days)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error métricas de auditoría: {}", e)))?;

    let total_chat_logs: i64 = totals.get("total_chat");
    let total_reviewed: i64 = totals.get("reviewed");

    // Escaneamos respuestas para computar señales en memoria
    let rows = sqlx::query(
        r#"
        SELECT output_tokens, response, request_metadata
        FROM ai_usage_logs
        WHERE organization_id = $1
          AND request_type = 'chat'
          AND created_at >= NOW() - ($2 || ' days')::interval
        "#,
    )
    .bind(org_ctx.id)
    .bind(days)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error escaneando logs: {}", e)))?;

    let mut signal_counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut total_flagged: i64 = 0;
    let mut dist = WeightedScoreDist { low: 0, medium: 0, high: 0 };

    for row in &rows {
        let metadata: Option<Value> = row.get("request_metadata");
        let has_rag = metadata
            .as_ref()
            .and_then(|m| m.get("has_rag"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let output_tokens: i32 = row.get("output_tokens");
        let response: String = row.get::<Option<String>, _>("response").unwrap_or_default();

        let signals = risk_signals_from_log(&response, has_rag, output_tokens);
        if signals.is_empty() {
            continue;
        }
        total_flagged += 1;

        let score = weighted_risk_score(&signals);
        match score {
            1..=2 => dist.low += 1,
            3..=5 => dist.medium += 1,
            _ => dist.high += 1,
        }

        for s in signals {
            *signal_counts.entry(s).or_insert(0) += 1;
        }
    }

    let flagged_pct = if total_chat_logs > 0 {
        (total_flagged as f64 / total_chat_logs as f64) * 100.0
    } else {
        0.0
    };
    let reviewed_pct = if total_flagged > 0 {
        (total_reviewed as f64 / total_flagged as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(AiAuditMetrics {
        days,
        total_chat_logs,
        total_flagged,
        total_reviewed,
        flagged_pct,
        reviewed_pct,
        signal_counts,
        weighted_score_distribution: dist,
    }))
}
