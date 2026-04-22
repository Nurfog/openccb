use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct CourseCompletionMetrics {
    pub total_lessons: i64,
    pub completed_lessons: i64,
    pub progress_percentage: f64,
    pub completed: bool,
}

pub async fn calculate_course_completion(
    pool: &PgPool,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<CourseCompletionMetrics, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT
            COALESCE(totals.total_lessons, 0)::bigint AS total_lessons,
            LEAST(
                COALESCE(totals.total_lessons, 0)::bigint,
                COALESCE(graded.graded_done, 0)::bigint + COALESCE(ungraded.ungraded_done, 0)::bigint
            ) AS completed_lessons
        FROM (SELECT 1) seed
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint AS total_lessons
            FROM lessons l
            JOIN modules m ON m.id = l.module_id
            WHERE m.course_id = $2
        ) totals ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT ug.lesson_id)::bigint AS graded_done
            FROM user_grades ug
            JOIN lessons l ON l.id = ug.lesson_id
            JOIN modules m ON m.id = l.module_id
            WHERE ug.user_id = $1
              AND m.course_id = $2
              AND l.is_graded = true
              AND (ug.score * 100.0) >= COALESCE(l.passing_percentage::double precision, 60.0)
        ) graded ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT li.lesson_id)::bigint AS ungraded_done
            FROM lesson_interactions li
            JOIN lessons l ON l.id = li.lesson_id
            JOIN modules m ON m.id = l.module_id
            WHERE li.user_id = $1
              AND li.event_type = 'complete'
              AND m.course_id = $2
              AND l.is_graded = false
        ) ungraded ON TRUE
        "#,
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_one(pool)
    .await?;

    let total_lessons = row.get::<i64, _>("total_lessons");
    let completed_lessons = row.get::<i64, _>("completed_lessons");
    let progress_percentage = if total_lessons > 0 {
        (completed_lessons as f64 / total_lessons as f64) * 100.0
    } else {
        0.0
    };

    Ok(CourseCompletionMetrics {
        total_lessons,
        completed_lessons,
        progress_percentage,
        completed: total_lessons > 0 && completed_lessons >= total_lessons,
    })
}