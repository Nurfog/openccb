use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::middleware::Org;
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Structs de respuesta
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct LessonQualityMetric {
    pub lesson_id: Uuid,
    pub lesson_title: String,
    pub position: i32,
    /// % de inscritos que entregaron al menos una vez
    pub completion_rate: f64,
    /// Promedio de intentos por alumno que entregó
    pub avg_attempts: f64,
    /// Promedio de puntaje (0–1)
    pub avg_score: f64,
    /// % de alumnos que reprobaron en todos sus intentos (score < 0.6)
    pub failure_rate: f64,
    /// Número de alumnos que nunca interactuaron con la lección
    pub abandonment_count: i64,
}

#[derive(Debug, Serialize)]
pub struct CourseQualityMetrics {
    pub course_id: Uuid,
    pub enrolled: i64,
    pub lessons: Vec<LessonQualityMetric>,
}

#[derive(Debug, Serialize)]
pub struct QuizDiscriminationItem {
    pub lesson_id: Uuid,
    pub lesson_title: String,
    /// Texto truncado de la pregunta (block_id como proxy)
    pub block_id: String,
    /// Correlación punto-biserial approx: diferencia de score medio
    /// entre alumnos que respondieron bien vs mal esa pregunta
    pub discrimination_index: f64,
    /// % de alumnos que acertaron esta pregunta
    pub facility_index: f64,
    pub sample_size: i64,
}

#[derive(Debug, Serialize)]
pub struct CourseDiscriminationReport {
    pub course_id: Uuid,
    pub items: Vec<QuizDiscriminationItem>,
}

#[derive(Debug, Serialize)]
pub struct CurricularSuggestion {
    pub lesson_id: Uuid,
    pub lesson_title: String,
    pub kind: &'static str,
    pub message: String,
    pub severity: &'static str,
}

#[derive(Debug, Serialize)]
pub struct CurricularSuggestionsReport {
    pub course_id: Uuid,
    pub suggestions: Vec<CurricularSuggestion>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint 1: Métricas de Calidad
// GET /courses/{id}/pedagogical/quality-metrics
// ─────────────────────────────────────────────────────────────────────────────

pub async fn get_lesson_quality_metrics(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<CourseQualityMetrics>, (StatusCode, String)> {
    let enrolled: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM enrollments WHERE course_id = $1 AND organization_id = $2",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if enrolled == 0 {
        return Ok(Json(CourseQualityMetrics {
            course_id,
            enrolled: 0,
            lessons: vec![],
        }));
    }

    let rows = sqlx::query(
        r#"
        SELECT
            l.id                                                          AS lesson_id,
            l.title                                                       AS lesson_title,
            l.position,

            -- Alumnos que entregaron al menos una vez
            COUNT(DISTINCT g.user_id)::float8 / NULLIF($3::float8, 0)    AS completion_rate,

            -- Promedio de intentos entre quienes entregaron
            COALESCE(AVG(g.attempts_count)::float8, 0)                   AS avg_attempts,

            -- Puntaje medio
            COALESCE(AVG(g.score)::float8, 0)                            AS avg_score,

            -- Tasa de fallo (todos los intentos con score < 0.6)
            (
                SELECT COALESCE(
                    COUNT(DISTINCT g2.user_id)::float8 / NULLIF(COUNT(DISTINCT g.user_id)::float8, 0),
                    0
                )
                FROM user_grades g2
                WHERE g2.lesson_id = l.id
                  AND g2.organization_id = $2
                  AND g2.score < 0.6
            )                                                             AS failure_rate,

            -- Alumnos inscritos que NUNCA enviaron esta lección
            (
                $3 - COUNT(DISTINCT g.user_id)
            )                                                             AS abandonment_count

        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        LEFT JOIN user_grades g
            ON g.lesson_id = l.id AND g.organization_id = $2
        WHERE m.course_id = $1
          AND l.organization_id = $2
        GROUP BY l.id, l.title, l.position
        ORDER BY l.position
        "#,
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .bind(enrolled)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let lessons = rows
        .into_iter()
        .map(|row| LessonQualityMetric {
            lesson_id: row.get("lesson_id"),
            lesson_title: row.get("lesson_title"),
            position: row.get("position"),
            completion_rate: row.get::<f64, _>("completion_rate"),
            avg_attempts: row.get::<f64, _>("avg_attempts"),
            avg_score: row.get::<f64, _>("avg_score"),
            failure_rate: row.get::<f64, _>("failure_rate"),
            abandonment_count: row.get::<i64, _>("abandonment_count"),
        })
        .collect();

    Ok(Json(CourseQualityMetrics {
        course_id,
        enrolled,
        lessons,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint 2: Índice de Discriminación de preguntas
// GET /courses/{id}/pedagogical/discrimination-index
//
// Usa punto-biserial simplificado: compara el puntaje global del curso entre
// alumnos que acertaron cada bloque vs los que fallaron.
// La columna metadata->>'block_scores' guarda un objeto {block_id: score_0_1}.
// ─────────────────────────────────────────────────────────────────────────────

pub async fn get_quiz_discrimination_index(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<CourseDiscriminationReport>, (StatusCode, String)> {
    use std::collections::HashMap;

    let rows = sqlx::query(
        r#"
        SELECT
            g.lesson_id,
            l.title AS lesson_title,
            bs.key   AS block_id,
            (bs.value::text::float8) AS block_score,
            g.score  AS overall_score
        FROM user_grades g
        JOIN lessons l ON l.id = g.lesson_id
        JOIN LATERAL jsonb_each(
            CASE
                WHEN g.metadata ? 'block_scores'
                    THEN g.metadata -> 'block_scores'
                ELSE '{}'::jsonb
            END
        ) AS bs(key, value) ON TRUE
        WHERE g.course_id = $1
          AND g.organization_id = $2
          AND (bs.value::text) ~ '^[0-9]+\.?[0-9]*$'
        "#,
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if rows.is_empty() {
        return Ok(Json(CourseDiscriminationReport {
            course_id,
            items: vec![],
        }));
    }

    struct BlockStats {
        lesson_id: Uuid,
        lesson_title: String,
        block_id: String,
        pass_scores: Vec<f64>,
        fail_scores: Vec<f64>,
        pass_count: i64,
        total: i64,
    }

    let mut map: HashMap<String, BlockStats> = HashMap::new();
    for row in &rows {
        let lesson_id: Uuid = row.get("lesson_id");
        let lesson_title: String = row.get("lesson_title");
        let block_id: String = row.get("block_id");
        let block_score: f64 = row.get("block_score");
        let overall_score: f64 = row.get("overall_score");

        let key = format!("{}/{}", lesson_id, block_id);
        let entry = map.entry(key).or_insert_with(|| BlockStats {
            lesson_id,
            lesson_title: lesson_title.clone(),
            block_id: block_id.clone(),
            pass_scores: vec![],
            fail_scores: vec![],
            pass_count: 0,
            total: 0,
        });
        entry.total += 1;
        if block_score >= 0.6 {
            entry.pass_count += 1;
            entry.pass_scores.push(overall_score);
        } else {
            entry.fail_scores.push(overall_score);
        }
    }

    let mean = |v: &[f64]| -> f64 {
        if v.is_empty() { 0.0 } else { v.iter().sum::<f64>() / v.len() as f64 }
    };

    let mut items: Vec<QuizDiscriminationItem> = map
        .into_values()
        .filter(|s| s.total >= 3)
        .map(|s| {
            let facility = s.pass_count as f64 / s.total as f64;
            let discrimination = mean(&s.pass_scores) - mean(&s.fail_scores);
            QuizDiscriminationItem {
                lesson_id: s.lesson_id,
                lesson_title: s.lesson_title,
                block_id: s.block_id,
                discrimination_index: (discrimination * 100.0).round() / 100.0,
                facility_index: (facility * 100.0).round() / 100.0,
                sample_size: s.total,
            }
        })
        .collect();

    items.sort_by(|a, b| a.discrimination_index.partial_cmp(&b.discrimination_index).unwrap_or(std::cmp::Ordering::Equal));

    Ok(Json(CourseDiscriminationReport { course_id, items }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint 3: Sugerencias Curriculares con reglas basadas en datos
// GET /courses/{id}/pedagogical/suggestions
// ─────────────────────────────────────────────────────────────────────────────

pub async fn get_curricular_suggestions(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<CurricularSuggestionsReport>, (StatusCode, String)> {
    let enrolled: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM enrollments WHERE course_id = $1 AND organization_id = $2",
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if enrolled < 5 {
        return Ok(Json(CurricularSuggestionsReport {
            course_id,
            suggestions: vec![],
        }));
    }

    let rows = sqlx::query(
        r#"
        SELECT
            l.id                                                            AS lesson_id,
            l.title                                                         AS lesson_title,
            l.position,
            COUNT(DISTINCT g.user_id)::float8 / $3::float8                 AS completion_rate,
            COALESCE(AVG(g.score)::float8, 0)                              AS avg_score,
            COALESCE(AVG(g.attempts_count)::float8, 0)                     AS avg_attempts,
            -- Tasa de abandono
            ($3 - COUNT(DISTINCT g.user_id))::float8 / $3::float8         AS abandonment_rate
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        LEFT JOIN user_grades g
            ON g.lesson_id = l.id AND g.organization_id = $2
        WHERE m.course_id = $1
          AND l.organization_id = $2
        GROUP BY l.id, l.title, l.position
        ORDER BY l.position
        "#,
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .bind(enrolled)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut suggestions: Vec<CurricularSuggestion> = vec![];

    for row in &rows {
        let lesson_id: Uuid = row.get("lesson_id");
        let lesson_title: String = row.get("lesson_title");
        let completion_rate: f64 = row.get("completion_rate");
        let avg_score: f64 = row.get("avg_score");
        let avg_attempts: f64 = row.get("avg_attempts");
        let abandonment_rate: f64 = row.get("abandonment_rate");

        // Regla 1: Alto abandono sin completar
        if abandonment_rate > 0.50 {
            suggestions.push(CurricularSuggestion {
                lesson_id,
                lesson_title: lesson_title.clone(),
                kind: "high_abandonment",
                message: format!(
                    "{:.0}% de los alumnos no completan esta lección. Considera dividirla en partes más cortas o revisar si el contenido es demasiado extenso.",
                    abandonment_rate * 100.0
                ),
                severity: "high",
            });
        }

        // Regla 2: Puntaje promedio muy bajo con muchos intentos → dificultad excesiva
        if avg_score < 0.45 && avg_attempts > 2.0 && completion_rate > 0.3 {
            suggestions.push(CurricularSuggestion {
                lesson_id,
                lesson_title: lesson_title.clone(),
                kind: "excessive_difficulty",
                message: format!(
                    "Puntaje promedio de {:.0}% tras {:.1} intentos. La lección puede ser excesivamente difícil; revisa las preguntas o añade material de apoyo previo.",
                    avg_score * 100.0,
                    avg_attempts
                ),
                severity: "high",
            });
        }

        // Regla 3: Puntaje muy alto con pocos intentos → podría ser demasiado fácil
        if avg_score > 0.95 && avg_attempts < 1.2 && completion_rate > 0.5 {
            suggestions.push(CurricularSuggestion {
                lesson_id,
                lesson_title: lesson_title.clone(),
                kind: "too_easy",
                message: format!(
                    "Puntaje promedio de {:.0}% en el primer intento. Esta lección puede no estar generando aprendizaje real; considera aumentar la complejidad o añadir preguntas de análisis.",
                    avg_score * 100.0
                ),
                severity: "info",
            });
        }

        // Regla 4: Baja tasa de finalización en lección no final → posible bloqueo
        if completion_rate < 0.30 && abandonment_rate < 0.50 {
            suggestions.push(CurricularSuggestion {
                lesson_id,
                lesson_title: lesson_title.clone(),
                kind: "low_completion",
                message: format!(
                    "Solo {:.0}% de alumnos completa esta lección. Si no hay abandonos, puede haber un bloqueo técnico o de prerrequisitos. Verifica dependencias y contenido de la lección.",
                    completion_rate * 100.0
                ),
                severity: "medium",
            });
        }

        // Regla 5: Muchos reintentos con buen puntaje final → la práctica funciona, destacar
        if avg_attempts > 3.0 && avg_score > 0.75 {
            suggestions.push(CurricularSuggestion {
                lesson_id,
                lesson_title: lesson_title.clone(),
                kind: "effective_practice",
                message: format!(
                    "Alumnos usan en promedio {:.1} intentos y llegan a {:.0}%. Esta lección fomenta el aprendizaje por práctica de forma efectiva.",
                    avg_attempts,
                    avg_score * 100.0
                ),
                severity: "positive",
            });
        }
    }

    suggestions.sort_by_key(|s| match s.severity {
        "high" => 0,
        "medium" => 1,
        "info" => 2,
        "positive" => 3,
        _ => 4,
    });

    Ok(Json(CurricularSuggestionsReport {
        course_id,
        suggestions,
    }))
}
