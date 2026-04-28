use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use common::models::{LessonRubric, Rubric, RubricCriterion, RubricLevel};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

// ==================== Estructuras de Carga Útil (Payload) ====================

#[derive(Debug, Deserialize)]
pub struct CreateRubricPayload {
    pub name: String,
    pub description: Option<String>,
    pub course_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRubricPayload {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCriterionPayload {
    pub name: String,
    pub description: Option<String>,
    pub max_points: i32,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCriterionPayload {
    pub name: Option<String>,
    pub description: Option<String>,
    pub max_points: Option<i32>,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLevelPayload {
    pub name: String,
    pub description: Option<String>,
    pub points: i32,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLevelPayload {
    pub name: Option<String>,
    pub description: Option<String>,
    pub points: Option<i32>,
    pub position: Option<i32>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct CreateAssessmentPayload {
    pub lesson_id: Uuid,
    pub rubric_id: Uuid,
    pub user_id: Uuid,
    pub submission_id: Option<Uuid>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct UpdateAssessmentPayload {
    pub total_score: f32,
    pub feedback: Option<String>,
    pub scores: Vec<CriterionScorePayload>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct CriterionScorePayload {
    pub criterion_id: Uuid,
    pub level_id: Option<Uuid>,
    pub points: f32,
    pub feedback: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RubricWithDetails {
    #[serde(flatten)]
    pub rubric: Rubric,
    pub criteria: Vec<CriterionWithLevels>,
}

#[derive(Debug, Serialize)]
pub struct CriterionWithLevels {
    #[serde(flatten)]
    pub criterion: RubricCriterion,
    pub levels: Vec<RubricLevel>,
}

// ==================== Gestión de Rúbricas ====================

/// Crear una nueva rúbrica
pub async fn create_rubric(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
    Json(payload): Json<CreateRubricPayload>,
) -> Result<Json<Rubric>, (StatusCode, String)> {
    let rubric: Rubric = sqlx::query_as(
        r#"
        INSERT INTO rubrics (organization_id, course_id, created_by, name, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, organization_id, course_id, created_by, name, description, total_points, created_at, updated_at
        "#
    )
    .bind(org_ctx.id)
    .bind(payload.course_id.or(Some(course_id)))
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.description)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(rubric))
}

/// Listar todas las rúbricas de un curso
pub async fn list_course_rubrics(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<Rubric>>, (StatusCode, String)> {
    let rubrics: Vec<Rubric> = sqlx::query_as(
        r#"
        SELECT id, organization_id, course_id, created_by, name, description, total_points, created_at, updated_at
        FROM rubrics
        WHERE organization_id = $1 AND (course_id = $2 OR course_id IS NULL)
        ORDER BY created_at DESC
        "#
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(rubrics))
}

/// Obtener una rúbrica con todos los criterios y niveles
pub async fn get_rubric_with_details(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(rubric_id): Path<Uuid>,
) -> Result<Json<RubricWithDetails>, (StatusCode, String)> {
    // Get rubric
    let rubric: Rubric = sqlx::query_as(
        r#"
        SELECT id, organization_id, course_id, created_by, name, description, total_points, created_at, updated_at
        FROM rubrics
        WHERE id = $1 AND organization_id = $2
        "#
    )
    .bind(rubric_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Rúbrica no encontrada".to_string()))?;

    // Get criteria
    let criteria: Vec<RubricCriterion> = sqlx::query_as(
        r#"
        SELECT id, rubric_id, name, description, max_points, position, created_at
        FROM rubric_criteria
        WHERE rubric_id = $1
        ORDER BY position ASC
        "#
    )
    .bind(rubric_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Get levels for each criterion
    let mut criteria_with_levels = Vec::new();
    for criterion in criteria {
        let levels: Vec<RubricLevel> = sqlx::query_as(
            r#"
            SELECT id, criterion_id, name, description, points, position, created_at
            FROM rubric_levels
            WHERE criterion_id = $1
            ORDER BY position ASC
            "#
        )
        .bind(criterion.id)
        .fetch_all(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

        criteria_with_levels.push(CriterionWithLevels { criterion, levels });
    }

    Ok(Json(RubricWithDetails {
        rubric,
        criteria: criteria_with_levels,
    }))
}

/// Actualizar una rúbrica
pub async fn update_rubric(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(rubric_id): Path<Uuid>,
    Json(payload): Json<UpdateRubricPayload>,
) -> Result<Json<Rubric>, (StatusCode, String)> {
    let rubric: Rubric = sqlx::query_as(
        r#"
        UPDATE rubrics
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING id, organization_id, course_id, created_by, name, description, total_points, created_at, updated_at
        "#
    )
    .bind(payload.name)
    .bind(payload.description)
    .bind(rubric_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Rúbrica no encontrada".to_string()))?;

    Ok(Json(rubric))
}

/// Eliminar una rúbrica
pub async fn delete_rubric(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(rubric_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM rubrics WHERE id = $1 AND organization_id = $2")
        .bind(rubric_id)
        .bind(org_ctx.id)
        .execute(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Rúbrica no encontrada".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Gestión de Criterios ====================

/// Añadir un criterio a una rúbrica
pub async fn create_criterion(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(rubric_id): Path<Uuid>,
    Json(payload): Json<CreateCriterionPayload>,
) -> Result<Json<RubricCriterion>, (StatusCode, String)> {
    // Verify rubric exists and belongs to org
    let _rubric = sqlx::query("SELECT id FROM rubrics WHERE id = $1 AND organization_id = $2")
        .bind(rubric_id)
        .bind(org_ctx.id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Rúbrica no encontrada".to_string()))?;

    let position = payload.position.unwrap_or(0);

    let criterion: RubricCriterion = sqlx::query_as(
        r#"
        INSERT INTO rubric_criteria (rubric_id, name, description, max_points, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, rubric_id, name, description, max_points, position, created_at
        "#
    )
    .bind(rubric_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.max_points)
    .bind(position)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Update rubric total_points
    let _= sqlx::query(
        r#"
        UPDATE rubrics
        SET total_points = (SELECT COALESCE(SUM(max_points), 0) FROM rubric_criteria WHERE rubric_id = $1),
            updated_at = NOW()
        WHERE id = $1
        "#
    )
    .bind(rubric_id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(criterion))
}

/// Actualizar un criterio
pub async fn update_criterion(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(criterion_id): Path<Uuid>,
    Json(payload): Json<UpdateCriterionPayload>,
) -> Result<Json<RubricCriterion>, (StatusCode, String)> {
    let criterion: RubricCriterion = sqlx::query_as(
        r#"
        UPDATE rubric_criteria
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            max_points = COALESCE($3, max_points),
            position = COALESCE($4, position)
        WHERE id = $5
        AND rubric_id IN (SELECT id FROM rubrics WHERE organization_id = $6)
        RETURNING id, rubric_id, name, description, max_points, position, created_at
        "#
    )
    .bind(payload.name)
    .bind(payload.description)
    .bind(payload.max_points)
    .bind(payload.position)
    .bind(criterion_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Criterio no encontrado".to_string()))?;

    // Update rubric total_points if max_points changed
    if payload.max_points.is_some() {
        let _ = sqlx::query(
            r#"
            UPDATE rubrics
            SET total_points = (SELECT COALESCE(SUM(max_points), 0) FROM rubric_criteria WHERE rubric_id = $1),
                updated_at = NOW()
            WHERE id = $1
            "#
        )
        .bind(criterion.rubric_id)
        .execute(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;
    }

    Ok(Json(criterion))
}

/// Eliminar un criterio
pub async fn delete_criterion(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(criterion_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Get rubric_id before deleting
    let criterion_row = sqlx::query("SELECT rubric_id FROM rubric_criteria WHERE id = $1")
        .bind(criterion_id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Criterio no encontrado".to_string()))?;
    
    let rubric_id: Uuid = criterion_row.get("rubric_id");

    let result = sqlx::query(
        r#"
        DELETE FROM rubric_criteria
        WHERE id = $1
        AND rubric_id IN (SELECT id FROM rubrics WHERE organization_id = $2)
        "#
    )
    .bind(criterion_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Criterio no encontrado".to_string()));
    }

    // Update rubric total_points
    let _ = sqlx::query(
        r#"
        UPDATE rubrics
        SET total_points = (SELECT COALESCE(SUM(max_points), 0) FROM rubric_criteria WHERE rubric_id = $1),
            updated_at = NOW()
        WHERE id = $1
        "#
    )
    .bind(rubric_id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Gestión de Niveles de Desempeño ====================

/// Añadir un nivel de desempeño a un criterio
pub async fn create_level(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(criterion_id): Path<Uuid>,
    Json(payload): Json<CreateLevelPayload>,
) -> Result<Json<RubricLevel>, (StatusCode, String)> {
    // Verify criterion exists and belongs to org
    let _criterion = sqlx::query("SELECT id FROM rubric_criteria WHERE id = $1 AND rubric_id IN (SELECT id FROM rubrics WHERE organization_id = $2)")
        .bind(criterion_id)
        .bind(org_ctx.id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Criterio no encontrado".to_string()))?;

    let position = payload.position.unwrap_or(0);

    let level: RubricLevel = sqlx::query_as(
        r#"
        INSERT INTO rubric_levels (criterion_id, name, description, points, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, criterion_id, name, description, points, position, created_at
        "#
    )
    .bind(criterion_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.points)
    .bind(position)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(level))
}

/// Actualizar un nivel de desempeño
pub async fn update_level(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(level_id): Path<Uuid>,
    Json(payload): Json<UpdateLevelPayload>,
) -> Result<Json<RubricLevel>, (StatusCode, String)> {
    let level: RubricLevel = sqlx::query_as(
        r#"
        UPDATE rubric_levels
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            points = COALESCE($3, points),
            position = COALESCE($4, position)
        WHERE id = $5
        AND criterion_id IN (
            SELECT id FROM rubric_criteria
            WHERE rubric_id IN (SELECT id FROM rubrics WHERE organization_id = $6)
        )
        RETURNING id, criterion_id, name, description, points, position, created_at
        "#
    )
    .bind(payload.name)
    .bind(payload.description)
    .bind(payload.points)
    .bind(payload.position)
    .bind(level_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Nivel no encontrado".to_string()))?;

    Ok(Json(level))
}

/// Eliminar un nivel de desempeño
pub async fn delete_level(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(level_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        r#"
        DELETE FROM rubric_levels
        WHERE id = $1
        AND criterion_id IN (
            SELECT id FROM rubric_criteria
            WHERE rubric_id IN (SELECT id FROM rubrics WHERE organization_id = $2)
        )
        "#
    )
    .bind(level_id)
    .bind(org_ctx.id)
    .execute(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Nivel no encontrado".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ==================== Asociación Lección-Rúbrica ====================

/// Asignar una rúbrica a una lección
pub async fn assign_rubric_to_lesson(
    Org(_org_ctx): Org,
    State(pool): State<PgPool>,
    Path((lesson_id, rubric_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<LessonRubric>, (StatusCode, String)> {
    let lesson_rubric: LessonRubric = sqlx::query_as(
        r#"
        INSERT INTO lesson_rubrics (lesson_id, rubric_id, is_active)
        VALUES ($1, $2, true)
        ON CONFLICT (lesson_id, rubric_id) DO UPDATE SET is_active = true
        RETURNING id, lesson_id, rubric_id, is_active, assigned_at
        "#
    )
    .bind(lesson_id)
    .bind(rubric_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(lesson_rubric))
}

/// Desasignar una rúbrica de una lección
pub async fn unassign_rubric_from_lesson(
    Org(_org_ctx): Org,
    State(pool): State<PgPool>,
    Path((lesson_id, rubric_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM lesson_rubrics WHERE lesson_id = $1 AND rubric_id = $2")
        .bind(lesson_id)
        .bind(rubric_id)
        .execute(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Vínculo lección-rúbrica no encontrado".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Obtener rúbricas asignadas a una lección
pub async fn get_lesson_rubrics(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(lesson_id): Path<Uuid>,
) -> Result<Json<Vec<Rubric>>, (StatusCode, String)> {
    let rubrics: Vec<Rubric> = sqlx::query_as(
        r#"
        SELECT r.id, r.organization_id, r.course_id, r.created_by, r.name, r.description, r.total_points, r.created_at, r.updated_at
        FROM rubrics r
        INNER JOIN lesson_rubrics lr ON lr.rubric_id = r.id
        WHERE lr.lesson_id = $1 AND lr.is_active = true AND r.organization_id = $2
        ORDER BY lr.assigned_at DESC
        "#
    )
    .bind(lesson_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    Ok(Json(rubrics))
}
