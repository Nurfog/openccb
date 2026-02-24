use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{Utc, Duration};
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use common::auth::Claims;
use common::models::{DropoutRisk, DropoutRiskLevel, DropoutRiskReason};

pub async fn get_course_dropout_risks(
    Path(course_id): Path<Uuid>,
    State(pool): State<PgPool>,
    claims: Claims,
) -> Result<Json<Vec<DropoutRisk>>, (StatusCode, String)> {
    if claims.role == "student" {
        return Err((StatusCode::FORBIDDEN, "Only instructors can view risk reports".to_string()));
    }

    calculate_risks_for_course(&pool, course_id, claims.org).await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let rows = sqlx::query(
        r#"
        SELECT id, organization_id, course_id, user_id, risk_level, score, reasons, last_calculated_at, created_at, updated_at
        FROM dropout_risks
        WHERE course_id = $1 AND organization_id = $2
        ORDER BY score DESC
        "#,
    )
    .bind(course_id)
    .bind(claims.org)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch risks: {}", e)))?;

    let risks: Vec<DropoutRisk> = rows.into_iter().map(|row| {
        DropoutRisk {
            id: row.get("id"),
            organization_id: row.get("organization_id"),
            course_id: row.get("course_id"),
            user_id: row.get("user_id"),
            risk_level: row.get("risk_level"),
            score: row.get("score"),
            reasons: row.get("reasons"),
            last_calculated_at: row.get("last_calculated_at"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }
    }).collect();

    Ok(Json(risks))
}

pub async fn calculate_risks_for_course(
    pool: &PgPool,
    course_id: Uuid,
    organization_id: Uuid,
) -> Result<(), sqlx::Error> {
    let enrollments = sqlx::query("SELECT user_id FROM enrollments WHERE course_id = $1 AND organization_id = $2")
        .bind(course_id)
        .bind(organization_id)
        .fetch_all(pool)
        .await?;

    for enrollment in enrollments {
        let user_id: Uuid = enrollment.get("user_id");
        
        let avg_grade: f32 = sqlx::query("SELECT COALESCE(AVG(score), 0.0) FROM user_grades WHERE user_id = $1 AND course_id = $2")
            .bind(user_id)
            .bind(course_id)
            .fetch_one(pool)
            .await?
            .get::<f64, _>(0) as f32; // AVG returns f64 usually

        let last_activity_count: i64 = sqlx::query("SELECT COUNT(*) FROM lesson_interactions WHERE user_id = $1 AND created_at > $2")
            .bind(user_id)
            .bind(Utc::now() - Duration::days(7))
            .fetch_one(pool)
            .await?
            .get(0);

        let forum_posts: i64 = sqlx::query("SELECT COUNT(*) FROM discussion_posts WHERE author_id = $1 AND organization_id = $2")
            .bind(user_id)
            .bind(organization_id)
            .fetch_one(pool)
            .await?
            .get(0);

        let perf_risk = (1.0 - avg_grade).max(0.0);
        let activity_risk = (1.0 / (last_activity_count as f32 + 1.0)).min(1.0);
        let social_risk = (1.0 / (forum_posts as f32 + 1.0)).min(1.0);

        let total_score = (perf_risk * 0.5) + (activity_risk * 0.4) + (social_risk * 0.1);

        let risk_level = if total_score > 0.8 {
            DropoutRiskLevel::Critical
        } else if total_score > 0.5 {
            DropoutRiskLevel::High
        } else if total_score > 0.3 {
            DropoutRiskLevel::Medium
        } else {
            DropoutRiskLevel::Low
        };

        let reasons = vec![
            DropoutRiskReason { metric: "performance".to_string(), value: avg_grade, description: format!("Grade: {:.0}%", avg_grade * 100.0) },
            DropoutRiskReason { metric: "activity".to_string(), value: last_activity_count as f32, description: format!("{} actions in last week", last_activity_count) },
        ];

        sqlx::query(
            r#"
            INSERT INTO dropout_risks (organization_id, course_id, user_id, risk_level, score, reasons, last_calculated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (course_id, user_id) DO UPDATE SET
                risk_level = EXCLUDED.risk_level,
                score = EXCLUDED.score,
                reasons = EXCLUDED.reasons,
                last_calculated_at = EXCLUDED.last_calculated_at,
                updated_at = NOW()
            "#,
        )
        .bind(organization_id)
        .bind(course_id)
        .bind(user_id)
        .bind(risk_level)
        .bind(total_score)
        .bind(json!(reasons))
        .execute(pool)
        .await?;
    }

    Ok(())
}
