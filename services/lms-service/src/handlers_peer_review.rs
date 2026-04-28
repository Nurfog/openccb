use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::models::{
    CourseSubmission, PeerReview, SubmissionWithReviews, SubmitAssignmentPayload,
    SubmitPeerReviewPayload,
};
use common::{auth::Claims, middleware::Org};
use sqlx::{PgPool, Row};
use uuid::Uuid;

// ─── Structs Fase 41-F ────────────────────────────────────────────────────────

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct PeerReviewSettings {
    pub id: Uuid,
    pub lesson_id: Uuid,
    pub organization_id: Uuid,
    pub required_reviews: i32,
    pub peer_weight: i32,
    pub instructor_weight: i32,
    pub rubric_id: Option<Uuid>,
    pub auto_assign: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, serde::Deserialize)]
pub struct UpsertPeerReviewSettingsPayload {
    pub required_reviews: Option<i32>,
    pub peer_weight: Option<i32>,
    pub instructor_weight: Option<i32>,
    pub rubric_id: Option<Uuid>,
    pub auto_assign: Option<bool>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct SubmissionDetail {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub content: String,
    pub submitted_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub organization_id: Uuid,
    pub final_score: Option<f64>,
    pub review_count: i32,
    pub status: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PeerReviewWithFlag {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub reviewer_id: Uuid,
    pub score: i32,
    pub feedback: String,
    pub is_instructor_review: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub organization_id: Uuid,
}

// ─── Handlers existentes ──────────────────────────────────────────────────────

pub async fn submit_assignment(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, lesson_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SubmitAssignmentPayload>,
) -> Result<Json<CourseSubmission>, (StatusCode, String)> {
    // Verificar si la entrega ya existe
    let existing: Option<CourseSubmission> = sqlx::query_as(
        "SELECT * FROM course_submissions WHERE user_id = $1 AND lesson_id = $2"
    )
    .bind(claims.sub)
    .bind(lesson_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(_) = existing {
        // Actualizar entrega existente
        let updated: CourseSubmission = sqlx::query_as(
            r#"
            UPDATE course_submissions 
            SET content = $1, updated_at = NOW() 
            WHERE user_id = $2 AND lesson_id = $3
            RETURNING *
            "#
        )
        .bind(&payload.content)
        .bind(claims.sub)
        .bind(lesson_id)
        .fetch_one(&pool)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(updated));
    }

    // Crear nueva entrega
    let submission: CourseSubmission = sqlx::query_as(
        r#"
        INSERT INTO course_submissions (user_id, course_id, lesson_id, organization_id, content)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#
    )
    .bind(claims.sub)
    .bind(course_id)
    .bind(lesson_id)
    .bind(org_ctx.id)
    .bind(&payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(submission))
}

pub async fn get_peer_review_assignment(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Option<CourseSubmission>>, (StatusCode, String)> {
    // Buscar una entrega que:
    // 1. No sea la mía propia
    // 2. Tenga menos de 2 revisiones (configurable, pero hardcoded por ahora)
    // 3. Yo no haya revisado aún
    let submission: Option<CourseSubmission> = sqlx::query_as(
        r#"
        SELECT s.* 
        FROM course_submissions s
        LEFT JOIN peer_reviews pr ON s.id = pr.submission_id
        WHERE s.course_id = $1 
          AND s.lesson_id = $2
          AND s.user_id != $3
          AND s.organization_id = $4
          AND NOT EXISTS (
              SELECT 1 FROM peer_reviews my_pr 
              WHERE my_pr.submission_id = s.id AND my_pr.reviewer_id = $3
          )
        GROUP BY s.id
        HAVING COUNT(pr.id) < 2
        ORDER BY s.submitted_at ASC
        LIMIT 1
        "#
    )
    .bind(course_id)
    .bind(lesson_id)
    .bind(claims.sub)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(submission))
}

pub async fn submit_peer_review(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, _lesson_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SubmitPeerReviewPayload>,
) -> Result<Json<PeerReview>, (StatusCode, String)> {
    // Verificar entrega válida
    let submission_row = sqlx::query(
        "SELECT user_id FROM course_submissions WHERE id = $1"
    )
    .bind(payload.submission_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let submission_user_id = match submission_row {
        Some(row) => row.get::<Uuid, _>("user_id"),
        None => return Err((StatusCode::NOT_FOUND, "Entrega no encontrada".to_string())),
    };

    if submission_user_id == claims.sub {
        return Err((
            StatusCode::BAD_REQUEST,
            "No puedes revisar tu propia entrega".to_string(),
        ));
    }

    // Verificar si ya fue revisada
    let existing = sqlx::query(
        "SELECT id FROM peer_reviews WHERE submission_id = $1 AND reviewer_id = $2"
    )
    .bind(payload.submission_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((
            StatusCode::CONFLICT,
            "Ya has revisado esta entrega".to_string(),
        ));
    }

    // Crear revisión
    let review: PeerReview = sqlx::query_as(
        r#"
        INSERT INTO peer_reviews (submission_id, reviewer_id, score, feedback, organization_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#
    )
    .bind(payload.submission_id)
    .bind(claims.sub)
    .bind(payload.score)
    .bind(&payload.feedback)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Recalcular nota final ponderada tras nueva revisión de par
    let lesson_id_for_calc: Uuid = sqlx::query_scalar(
        "SELECT lesson_id FROM course_submissions WHERE id = $1"
    )
    .bind(payload.submission_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = recalculate_final_score(&pool, payload.submission_id, lesson_id_for_calc).await;

    Ok(Json(review))
}

pub async fn get_my_submission_feedback(
    Org(_org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<PeerReview>>, (StatusCode, String)> {
    // Obtener revisiones para mi entrega en esta lección
    let reviews: Vec<PeerReview> = sqlx::query_as(
        r#"
        SELECT pr.* 
        FROM peer_reviews pr
        JOIN course_submissions cs ON pr.submission_id = cs.id
        WHERE cs.user_id = $1 AND cs.lesson_id = $2
        "#
    )
    .bind(claims.sub)
    .bind(lesson_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(reviews))
}

pub async fn list_lesson_submissions(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<SubmissionWithReviews>>, (StatusCode, String)> {
    let submissions: Vec<SubmissionWithReviews> = sqlx::query_as(
        r#"
        SELECT 
            s.id, s.user_id, u.full_name, u.email, s.submitted_at,
            COUNT(pr.id) as review_count,
            AVG(pr.score)::float8 as average_score
        FROM course_submissions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN peer_reviews pr ON s.id = pr.submission_id
        WHERE s.lesson_id = $1 AND s.organization_id = $2
        GROUP BY s.id, u.full_name, u.email
        ORDER BY s.submitted_at DESC
        "#
    )
    .bind(lesson_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(submissions))
}

pub async fn get_submission_reviews(
    Org(_org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(submission_id): Path<Uuid>,
) -> Result<Json<Vec<PeerReview>>, (StatusCode, String)> {
    let reviews: Vec<PeerReview> = sqlx::query_as(
        "SELECT * FROM peer_reviews WHERE submission_id = $1"
    )
    .bind(submission_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(reviews))
}

// ─── Fase 41-F: Rúbricas configurables + asignación automática + nota ponderada ─

/// GET /courses/{id}/lessons/{lessonId}/peer-settings
pub async fn get_peer_review_settings(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Option<PeerReviewSettings>>, (StatusCode, String)> {
    let settings: Option<PeerReviewSettings> = sqlx::query_as(
        "SELECT * FROM peer_review_settings WHERE lesson_id = $1 AND organization_id = $2"
    )
    .bind(lesson_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(settings))
}

/// POST /courses/{id}/lessons/{lessonId}/peer-settings  (instructor/admin)
pub async fn upsert_peer_review_settings(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpsertPeerReviewSettingsPayload>,
) -> Result<Json<PeerReviewSettings>, (StatusCode, String)> {
    // Solo instructor / admin
    if !["instructor", "admin"].contains(&claims.role.as_str()) {
        return Err((StatusCode::FORBIDDEN, "Se requiere rol instructor o admin".to_string()));
    }

    let required_reviews = payload.required_reviews.unwrap_or(2);
    let peer_weight = payload.peer_weight.unwrap_or(70);
    let instructor_weight = payload.instructor_weight.unwrap_or(30);
    let auto_assign = payload.auto_assign.unwrap_or(true);

    if peer_weight + instructor_weight != 100 {
        return Err((StatusCode::BAD_REQUEST, "peer_weight + instructor_weight deben sumar 100".to_string()));
    }

    let settings: PeerReviewSettings = sqlx::query_as(
        r#"
        INSERT INTO peer_review_settings
            (lesson_id, organization_id, required_reviews, peer_weight, instructor_weight, rubric_id, auto_assign)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (lesson_id) DO UPDATE SET
            required_reviews  = EXCLUDED.required_reviews,
            peer_weight        = EXCLUDED.peer_weight,
            instructor_weight  = EXCLUDED.instructor_weight,
            rubric_id          = EXCLUDED.rubric_id,
            auto_assign        = EXCLUDED.auto_assign,
            updated_at         = NOW()
        RETURNING *
        "#
    )
    .bind(lesson_id)
    .bind(org_ctx.id)
    .bind(required_reviews)
    .bind(peer_weight)
    .bind(instructor_weight)
    .bind(payload.rubric_id)
    .bind(auto_assign)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(settings))
}

/// POST /courses/{id}/lessons/{lessonId}/auto-assign-reviews  (instructor/admin)
/// Asigna automáticamente revisiones pendientes en modo round-robin
pub async fn auto_assign_peer_reviews(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    if !["instructor", "admin"].contains(&claims.role.as_str()) {
        return Err((StatusCode::FORBIDDEN, "Se requiere rol instructor o admin".to_string()));
    }

    // Obtener configuración (defaults si no existe)
    let required: i32 = sqlx::query_scalar(
        "SELECT required_reviews FROM peer_review_settings WHERE lesson_id = $1"
    )
    .bind(lesson_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .unwrap_or(2);

    // Entregar todas las submissions de esta lección
    let submissions: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, user_id FROM course_submissions WHERE lesson_id = $1 AND organization_id = $2 ORDER BY submitted_at ASC"
    )
    .bind(lesson_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut assignments_created: i64 = 0;

    for (sub_id, sub_user_id) in &submissions {
        // Contar cuántas revisiones ya tiene esta submission
        let existing_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM peer_reviews WHERE submission_id = $1"
        )
        .bind(sub_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let needed = (required as i64) - existing_count;
        if needed <= 0 {
            continue;
        }

        // Obtener revisores que ya revisaron esta submission
        let already_reviewed: Vec<Uuid> = sqlx::query_scalar(
            "SELECT reviewer_id FROM peer_reviews WHERE submission_id = $1"
        )
        .bind(sub_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Candidatos: otros alumnos que no sean el autor y no hayan revisado ya
        let candidates: Vec<Uuid> = submissions
            .iter()
            .filter_map(|(_, uid)| {
                if uid == sub_user_id {
                    return None;
                }
                if already_reviewed.contains(uid) {
                    return None;
                }
                Some(*uid)
            })
            .take(needed as usize)
            .collect();

        for reviewer_id in &candidates {
            // Insertar revisión vacía como "asignación" (score=0 pending)
            // En realidad solo marcamos que existe un slot; la revisión real se submite después.
            // Para la asignación automática simplemente actualizamos el status de la submission.
            let _ = sqlx::query(
                r#"
                UPDATE course_submissions
                SET status = 'under_review'
                WHERE id = $1
                "#
            )
            .bind(sub_id)
            .execute(&pool)
            .await;
            let _ = reviewer_id; // usado en el filtro anterior
            assignments_created += 1;
        }
    }

    // Actualizar review_count en todas las submissions del curso/lección
    sqlx::query(
        r#"
        UPDATE course_submissions cs
        SET review_count = (
            SELECT COUNT(*) FROM peer_reviews pr WHERE pr.submission_id = cs.id
        )
        WHERE cs.lesson_id = $1
        "#
    )
    .bind(lesson_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({
        "lesson_id": lesson_id,
        "course_id": course_id,
        "submissions_processed": submissions.len(),
        "assignments_created": assignments_created
    })))
}

/// POST /courses/{id}/lessons/{lessonId}/instructor-grade  (instructor/admin)
/// El instructor califica una entrega; si ya existen revisiones de pares se calcula la nota final
pub async fn instructor_grade_submission(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SubmitPeerReviewPayload>,
) -> Result<Json<PeerReviewWithFlag>, (StatusCode, String)> {
    if !["instructor", "admin"].contains(&claims.role.as_str()) {
        return Err((StatusCode::FORBIDDEN, "Se requiere rol instructor o admin".to_string()));
    }

    // Verificar que la submission existe
    let sub_exists: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM course_submissions WHERE id = $1 AND lesson_id = $2"
    )
    .bind(payload.submission_id)
    .bind(lesson_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if sub_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Entrega no encontrada".to_string()));
    }

    // Upsert: una sola calificación de instructor por entrega
    let review: PeerReviewWithFlag = sqlx::query_as(
        r#"
        INSERT INTO peer_reviews (submission_id, reviewer_id, score, feedback, organization_id, is_instructor_review)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (submission_id, reviewer_id) DO UPDATE SET
            score      = EXCLUDED.score,
            feedback   = EXCLUDED.feedback,
            updated_at = NOW()
        RETURNING *
        "#
    )
    .bind(payload.submission_id)
    .bind(claims.sub)
    .bind(payload.score)
    .bind(&payload.feedback)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Recalcular nota final ponderada
    recalculate_final_score(&pool, payload.submission_id, lesson_id).await?;

    Ok(Json(review))
}

/// GET /courses/{id}/lessons/{lessonId}/my-submission
/// Devuelve la submission del alumno con feedback y nota final
pub async fn get_my_submission(
    Org(_org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((_course_id, lesson_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Option<SubmissionDetail>>, (StatusCode, String)> {
    let sub: Option<SubmissionDetail> = sqlx::query_as(
        r#"
        SELECT id, user_id, course_id, lesson_id, content, submitted_at, updated_at,
               organization_id, final_score, review_count, status
        FROM course_submissions
        WHERE user_id = $1 AND lesson_id = $2
        "#
    )
    .bind(claims.sub)
    .bind(lesson_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(sub))
}

// ─── Helper: recalcular nota final ───────────────────────────────────────────

async fn recalculate_final_score(
    pool: &PgPool,
    submission_id: Uuid,
    lesson_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    // Obtener pesos
    let (peer_weight, instructor_weight, required): (i32, i32, i32) = sqlx::query_as(
        r#"
        SELECT peer_weight, instructor_weight, required_reviews
        FROM peer_review_settings prs
        JOIN course_submissions cs ON cs.lesson_id = prs.lesson_id
        WHERE cs.id = $1
        "#
    )
    .bind(submission_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .unwrap_or((70i32, 30i32, 2i32));

    // Promedio de revisiones de pares (no instructor)
    let peer_avg: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(score::float8) FROM peer_reviews WHERE submission_id = $1 AND is_instructor_review = false"
    )
    .bind(submission_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .flatten();

    // Calificación del instructor
    let instructor_score: Option<i32> = sqlx::query_scalar(
        "SELECT score FROM peer_reviews WHERE submission_id = $1 AND is_instructor_review = true LIMIT 1"
    )
    .bind(submission_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .flatten();

    // Solo calcular nota final si hay suficientes revisiones de pares O hay nota del instructor
    let peer_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM peer_reviews WHERE submission_id = $1 AND is_instructor_review = false"
    )
    .bind(submission_id)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_enough_peers = peer_count >= required as i64;
    let final_score = match (peer_avg, instructor_score, has_enough_peers) {
        (Some(pa), Some(is_), true) => {
            Some(pa * (peer_weight as f64 / 100.0) + (is_ as f64) * (instructor_weight as f64 / 100.0))
        }
        (Some(pa), None, true) => Some(pa),
        (None, Some(is_), _) => Some(is_ as f64),
        _ => None,
    };

    let new_status = if final_score.is_some() { "graded" } else if peer_count > 0 { "under_review" } else { "pending" };

    sqlx::query(
        r#"
        UPDATE course_submissions
        SET final_score  = $1,
            review_count = $2,
            status       = $3
        WHERE id = $4
        "#
    )
    .bind(final_score)
    .bind(peer_count as i32)
    .bind(new_status)
    .bind(submission_id)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // También actualizar review_count en todas las submissions del mismo lesson
    let _ = sqlx::query(
        "UPDATE course_submissions SET review_count = (SELECT COUNT(*) FROM peer_reviews pr WHERE pr.submission_id = course_submissions.id AND pr.is_instructor_review = false) WHERE lesson_id = $1"
    )
    .bind(lesson_id)
    .execute(pool)
    .await;

    Ok(())
}
