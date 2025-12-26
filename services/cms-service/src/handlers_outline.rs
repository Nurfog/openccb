
#[derive(Serialize)]
pub struct ModuleWithLessons {
    #[serde(flatten)]
    pub module: Module,
    pub lessons: Vec<Lesson>,
}

#[derive(Serialize)]
pub struct CourseWithOutline {
    #[serde(flatten)]
    pub course: Course,
    pub modules: Vec<ModuleWithLessons>,
}

pub async fn get_course_outline(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<CourseWithOutline>, StatusCode> {
    // 1. Fetch Course
    let course = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_ctx.id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Fetch Modules
    let modules = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE course_id = $1 ORDER BY position")
        .bind(id)
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut modules_with_lessons = Vec::new();

    // 3. Fetch Lessons (This could be optimized with a single query, but N+1 is acceptable for course editor scale)
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE module_id = $1 ORDER BY position")
            .bind(module.id)
            .fetch_all(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        modules_with_lessons.push(ModuleWithLessons {
            module,
            lessons,
        });
    }

    Ok(Json(CourseWithOutline {
        course,
        modules: modules_with_lessons,
    }))
}
