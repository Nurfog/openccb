use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use common::auth::Claims;
use common::middleware::Org;
use common::models::{AddMemberPayload, Cohort, CreateCohortPayload, UserCohort};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn list_cohorts(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Cohort>>, (StatusCode, String)> {
    let cohorts = sqlx::query_as::<_, Cohort>(
        "SELECT * FROM cohorts WHERE organization_id = $1 ORDER BY created_at DESC",
    )
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(cohorts))
}

pub async fn create_cohort(
    Org(org_ctx): Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateCohortPayload>,
) -> Result<Json<Cohort>, (StatusCode, String)> {
    let cohort = sqlx::query_as::<_, Cohort>(
        r#"
        INSERT INTO cohorts (organization_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(org_ctx.id)
    .bind(payload.name)
    .bind(payload.description)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(cohort))
}

pub async fn add_cohort_member(
    Org(org_ctx): Org,
    _claims: Claims,
    Path(cohort_id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<AddMemberPayload>,
) -> Result<Json<UserCohort>, (StatusCode, String)> {
    // Verify cohort belongs to org
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM cohorts WHERE id = $1 AND organization_id = $2)",
    )
    .bind(cohort_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Cohort not found".to_string()));
    }

    let member = sqlx::query_as::<_, UserCohort>(
        r#"
        INSERT INTO user_cohorts (cohort_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (cohort_id, user_id) DO UPDATE SET assigned_at = NOW()
        RETURNING *
        "#,
    )
    .bind(cohort_id)
    .bind(payload.user_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(member))
}

pub async fn remove_cohort_member(
    Org(org_ctx): Org,
    _claims: Claims,
    Path((cohort_id, user_id)): Path<(Uuid, Uuid)>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verify cohort belongs to org
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM cohorts WHERE id = $1 AND organization_id = $2)",
    )
    .bind(cohort_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Cohort not found".to_string()));
    }

    sqlx::query("DELETE FROM user_cohorts WHERE cohort_id = $1 AND user_id = $2")
        .bind(cohort_id)
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_cohort_members(
    Org(org_ctx): Org,
    _claims: Claims,
    Path(cohort_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Uuid>>, (StatusCode, String)> {
    // Verify cohort belongs to org
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM cohorts WHERE id = $1 AND organization_id = $2)",
    )
    .bind(cohort_id)
    .bind(org_ctx.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Cohort not found".to_string()));
    }

    let members = sqlx::query_scalar("SELECT user_id FROM user_cohorts WHERE cohort_id = $1")
        .bind(cohort_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(members))
}
