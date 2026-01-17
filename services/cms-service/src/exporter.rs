use chrono::{DateTime, Utc};
use common::models::{Course, Lesson, Module};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseExport {
    pub course: Course,
    pub modules: Vec<ModuleWithLessons>,
    pub grading_categories: Vec<common::models::GradingCategory>,
    pub export_version: String,
    pub exported_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModuleWithLessons {
    pub module: Module,
    pub lessons: Vec<Lesson>,
}

pub async fn get_course_data(pool: &PgPool, course_id: Uuid) -> anyhow::Result<CourseExport> {
    // 1. Fetch Course
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1")
        .bind(course_id)
        .fetch_one(pool)
        .await?;

    // 2. Fetch Grading Categories
    let grading_categories = sqlx::query_as::<_, common::models::GradingCategory>(
        "SELECT * FROM grading_categories WHERE course_id = $1",
    )
    .bind(course_id)
    .fetch_all(pool)
    .await?;

    // 3. Fetch Modules
    let modules_raw =
        sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
            .bind(course_id)
            .fetch_all(pool)
            .await?;

    let mut modules = Vec::new();

    // 4. Fetch Lessons for each module
    for module in modules_raw {
        let lessons = sqlx::query_as::<_, Lesson>(
            "SELECT * FROM lessons WHERE module_id = $1 ORDER BY position",
        )
        .bind(module.id)
        .fetch_all(pool)
        .await?;

        modules.push(ModuleWithLessons { module, lessons });
    }

    Ok(CourseExport {
        course,
        modules,
        grading_categories,
        export_version: "1.0".to_string(),
        exported_at: Utc::now(),
    })
}
