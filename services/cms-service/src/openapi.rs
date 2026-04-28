#![allow(dead_code)]

use utoipa::OpenApi;

#[derive(utoipa::ToSchema, serde::Serialize, serde::Deserialize)]
pub struct ExternalCreateCoursePayloadSchema {
    /// Obligatorio. No debe ser vacio.
    pub title: String,
    /// Opcional: puede omitirse o enviarse como null.
    pub description: Option<String>,
    /// Opcional: puede omitirse o enviarse como null.
    pub pacing_mode: Option<String>,
    /// Opcional: idCursoAbierto del sistema SAM.
    /// Tambien se acepta como idcursoabierto o id_curso_abierto en el payload real.
    pub external_sam_id: Option<i64>,
    pub template_id: Option<String>,
    pub template_level: Option<String>,
    pub template_course_type: Option<String>,
    pub template_test_type: Option<String>,
    pub module_title: Option<String>,
    pub lesson_title: Option<String>,
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "OpenCCB CMS API",
        version = "1.1.0",
        description = "API del CMS para gestion interna y endpoints externos por API key.\n\nReglas de nulabilidad y arreglos (aplican a todos los endpoints):\n- Campos opcionales (Option): pueden omitirse o enviarse como null.\n- Campos de arreglo no opcionales (Vec): deben enviarse como arreglo; pueden ser [] pero no null.\n- Objetos requeridos del payload: no deben enviarse como null."
    ),
    paths(
        register,
        login,
        sso_login_init,
        sso_callback,
        get_branding,
        public_s3_proxy,
        create_course_external,
        get_course_external,
        trigger_transcription_external,
        get_courses,
        create_course,
        get_course,
        update_course,
        delete_course,
        publish_course,
        get_course_outline,
        get_course_analytics,
        get_advanced_analytics,
        get_course_team,
        add_team_member,
        remove_team_member,
        create_course_preview_token,
        get_lesson_heatmap,
        get_modules,
        create_module,
        reorder_modules,
        update_module,
        delete_module,
        get_lessons,
        create_lesson,
        reorder_lessons,
        get_lesson,
        update_lesson,
        delete_lesson,
        process_transcription,
        get_lesson_vtt,
        summarize_lesson,
        generate_quiz,
        generate_role_play,
        generate_hotspots,
        generate_mermaid_diagram,
        generate_code_lab,
        generate_course,
        export_course,
        import_course,
        list_course_templates,
        create_course_template_from_course,
        apply_course_template,
        delete_course_template,
        create_grading_category,
        delete_grading_category,
        get_grading_categories,
        get_tipo_nota,
        get_me,
        get_all_users,
        admin_create_user,
        update_user,
        delete_user,
        get_audit_logs,
        review_text,
        list_assets,
        list_asset_import_history,
        upload_asset,
        import_assets_zip,
        ingest_asset_for_rag,
        delete_asset,
        get_webhooks,
        create_webhook,
        delete_webhook,
        get_background_tasks,
        retry_task,
        cancel_task,
        get_organization,
        get_sso_config,
        update_sso_config,
        upload_organization_logo,
        upload_organization_favicon,
        update_organization_branding,
        get_organization_exercise_settings,
        update_organization_exercise_settings,
        get_organization_email_settings,
        update_organization_email_settings,
        list_organization_email_services,
        create_organization_email_service,
        update_organization_email_service,
        delete_organization_email_service,
        select_organization_email_service,
        list_organization_email_templates,
        create_organization_email_template,
        update_organization_email_template,
        delete_organization_email_template,
        list_library_blocks,
        create_library_block,
        get_library_block,
        update_library_block,
        delete_library_block,
        increment_block_usage,
        list_course_rubrics,
        create_rubric,
        get_rubric_with_details,
        update_rubric,
        delete_rubric,
        create_criterion,
        update_criterion,
        delete_criterion,
        create_level,
        update_level,
        delete_level,
        assign_rubric_to_lesson,
        unassign_rubric_from_lesson,
        get_lesson_rubrics,
        list_lesson_dependencies,
        assign_dependency,
        remove_dependency,
        list_test_templates,
        create_test_template,
        get_test_template,
        update_test_template,
        delete_test_template,
        create_template_question,
        delete_template_question,
        create_template_section,
        delete_template_section,
        apply_template_to_lesson,
        generate_questions_with_rag,
        list_questions,
        create_question,
        get_question,
        update_question,
        delete_question,
        import_from_mysql,
        get_mysql_plans,
        get_mysql_courses_by_plan,
        import_all_from_mysql,
        import_course_from_mysql,
        import_from_sam_diagnostico,
        ai_generate_question,
        generate_question_embeddings,
        semantic_search,
        find_similar_questions,
        regenerate_question_embedding,
        sync_all_sam,
        sync_sam_students,
        sync_sam_assignments,
        list_sam_students,
        get_sam_student_courses,
        get_token_usage,
        get_ai_usage_global,
        set_user_token_limit,
        get_user_token_usage,
        check_user_token_limit,
        list_plugins,
        create_plugin,
        list_enabled_plugins,
        update_plugin,
        delete_plugin,
    ),
    components(
        schemas(ExternalCreateCoursePayloadSchema)
    ),
    tags(
        (name = "Auth", description = "Autenticacion y SSO"),
        (name = "External", description = "Integracion externa con API key"),
        (name = "Courses", description = "Gestion de cursos y estructura"),
        (name = "Organization", description = "Configuracion de organizacion"),
        (name = "Assets", description = "Activos y librerias"),
        (name = "Rubrics", description = "Rubricas y criterios"),
        (name = "Templates", description = "Plantillas de curso y test"),
        (name = "QuestionBank", description = "Banco de preguntas y embeddings"),
        (name = "SAM", description = "Integracion con SAM"),
        (name = "Admin", description = "Administracion"),
        (name = "Plugins", description = "Ecosistema de plugins")
    )
)]
pub struct ApiDoc;

macro_rules! ok_path {
    ($name:ident, $method:ident, $path:literal, $tag:literal) => {
        #[utoipa::path(
            $method,
            path = $path,
            tag = $tag,
            responses((status = 200, description = "OK"))
        )]
        pub fn $name() {}
    };
}

macro_rules! protected_ok_path {
    ($name:ident, $method:ident, $path:literal, $tag:literal) => {
        #[utoipa::path(
            $method,
            path = $path,
            tag = $tag,
            security(("Bearer" = [])),
            responses((status = 200, description = "OK"))
        )]
        pub fn $name() {}
    };
}

ok_path!(register, post, "/auth/register", "Auth");
ok_path!(login, post, "/auth/login", "Auth");
ok_path!(sso_login_init, get, "/auth/sso/login/{org_id}", "Auth");
ok_path!(sso_callback, get, "/auth/sso/callback", "Auth");
ok_path!(get_branding, get, "/branding", "Organization");
ok_path!(public_s3_proxy, get, "/api/assets/s3-proxy/{bucket}/{key}", "Assets");

#[utoipa::path(
    post,
    path = "/api/external/v1/courses",
    tag = "External",
    request_body = ExternalCreateCoursePayloadSchema,
    security(("ApiKey" = [])),
    responses((status = 200, description = "Curso creado"))
)]
pub fn create_course_external() {}

#[utoipa::path(
    get,
    path = "/api/external/v1/courses/{id}",
    tag = "External",
    security(("ApiKey" = [])),
    responses((status = 200, description = "Curso encontrado"))
)]
pub fn get_course_external() {}

#[utoipa::path(
    post,
    path = "/api/external/v1/lessons/{id}/transcribe",
    tag = "External",
    security(("ApiKey" = [])),
    responses((status = 202, description = "Transcripcion encolada"))
)]
pub fn trigger_transcription_external() {}

protected_ok_path!(get_courses, get, "/courses", "Courses");
protected_ok_path!(create_course, post, "/courses", "Courses");
protected_ok_path!(get_course, get, "/courses/{id}", "Courses");
protected_ok_path!(update_course, put, "/courses/{id}", "Courses");
protected_ok_path!(delete_course, delete, "/courses/{id}", "Courses");
protected_ok_path!(publish_course, post, "/courses/{id}/publish", "Courses");
protected_ok_path!(get_course_outline, get, "/courses/{id}/outline", "Courses");
protected_ok_path!(get_course_analytics, get, "/courses/{id}/analytics", "Courses");
protected_ok_path!(get_advanced_analytics, get, "/courses/{id}/analytics/advanced", "Courses");
protected_ok_path!(get_course_team, get, "/courses/{id}/team", "Courses");
protected_ok_path!(add_team_member, post, "/courses/{id}/team", "Courses");
protected_ok_path!(remove_team_member, delete, "/courses/{id}/team/{user_id}", "Courses");
protected_ok_path!(create_course_preview_token, post, "/courses/{id}/preview-token", "Courses");

protected_ok_path!(get_modules, get, "/modules", "Courses");
protected_ok_path!(create_module, post, "/modules", "Courses");
protected_ok_path!(reorder_modules, post, "/modules/reorder", "Courses");
protected_ok_path!(update_module, put, "/modules/{id}", "Courses");
protected_ok_path!(delete_module, delete, "/modules/{id}", "Courses");

protected_ok_path!(get_lessons, get, "/lessons", "Courses");
protected_ok_path!(create_lesson, post, "/lessons", "Courses");
protected_ok_path!(reorder_lessons, post, "/lessons/reorder", "Courses");
protected_ok_path!(get_lesson, get, "/lessons/{id}", "Courses");
protected_ok_path!(update_lesson, put, "/lessons/{id}", "Courses");
protected_ok_path!(delete_lesson, delete, "/lessons/{id}", "Courses");
protected_ok_path!(process_transcription, post, "/lessons/{id}/transcribe", "Courses");
protected_ok_path!(get_lesson_vtt, get, "/lessons/{id}/vtt", "Courses");
protected_ok_path!(get_lesson_heatmap, get, "/lessons/{id}/heatmap", "Courses");
protected_ok_path!(summarize_lesson, post, "/lessons/{id}/summarize", "Courses");
protected_ok_path!(generate_quiz, post, "/lessons/{id}/generate-quiz", "Courses");
protected_ok_path!(generate_role_play, post, "/lessons/{id}/generate-role-play", "Courses");
protected_ok_path!(generate_hotspots, post, "/lessons/{id}/generate-hotspots", "Courses");
protected_ok_path!(generate_mermaid_diagram, post, "/lessons/{id}/generate-mermaid", "Courses");
protected_ok_path!(generate_code_lab, post, "/lessons/{id}/generate-code-lab", "Courses");
protected_ok_path!(generate_course, post, "/courses/generate", "Courses");
protected_ok_path!(export_course, get, "/courses/{id}/export", "Courses");
protected_ok_path!(import_course, post, "/courses/import", "Courses");

protected_ok_path!(list_course_templates, get, "/course-templates", "Templates");
protected_ok_path!(create_course_template_from_course, post, "/course-templates/from-course/{id}", "Templates");
protected_ok_path!(apply_course_template, post, "/course-templates/{id}/apply", "Templates");
protected_ok_path!(delete_course_template, delete, "/course-templates/{id}", "Templates");

protected_ok_path!(create_grading_category, post, "/grading", "Courses");
protected_ok_path!(delete_grading_category, delete, "/grading/{id}", "Courses");
protected_ok_path!(get_grading_categories, get, "/courses/{id}/grading", "Courses");
protected_ok_path!(get_tipo_nota, get, "/tipo-nota", "Courses");

protected_ok_path!(get_me, get, "/auth/me", "Auth");
protected_ok_path!(get_all_users, get, "/users", "Admin");
protected_ok_path!(admin_create_user, post, "/users", "Admin");
protected_ok_path!(update_user, put, "/users/{id}", "Admin");
protected_ok_path!(delete_user, delete, "/users/{id}", "Admin");
protected_ok_path!(get_audit_logs, get, "/audit-logs", "Admin");
protected_ok_path!(review_text, post, "/api/ai/review-text", "Admin");

protected_ok_path!(list_assets, get, "/api/assets", "Assets");
protected_ok_path!(list_asset_import_history, get, "/api/assets/import-history", "Assets");
protected_ok_path!(upload_asset, post, "/api/assets/upload", "Assets");
protected_ok_path!(import_assets_zip, post, "/api/assets/import-zip", "Assets");
protected_ok_path!(ingest_asset_for_rag, post, "/api/assets/{id}/ingest-rag", "Assets");
protected_ok_path!(delete_asset, delete, "/api/assets/{id}", "Assets");

protected_ok_path!(get_webhooks, get, "/webhooks", "Organization");
protected_ok_path!(create_webhook, post, "/webhooks", "Organization");
protected_ok_path!(delete_webhook, delete, "/webhooks/{id}", "Organization");
protected_ok_path!(get_background_tasks, get, "/tasks", "Admin");
protected_ok_path!(retry_task, post, "/tasks/{id}/retry", "Admin");
protected_ok_path!(cancel_task, delete, "/tasks/{id}", "Admin");

protected_ok_path!(get_organization, get, "/organization", "Organization");
protected_ok_path!(get_sso_config, get, "/organization/sso", "Organization");
protected_ok_path!(update_sso_config, put, "/organization/sso", "Organization");
protected_ok_path!(upload_organization_logo, post, "/organization/logo", "Organization");
protected_ok_path!(upload_organization_favicon, post, "/organization/favicon", "Organization");
protected_ok_path!(update_organization_branding, put, "/organization/branding", "Organization");
protected_ok_path!(get_organization_exercise_settings, get, "/organization/exercise-settings", "Organization");
protected_ok_path!(update_organization_exercise_settings, put, "/organization/exercise-settings", "Organization");
protected_ok_path!(get_organization_email_settings, get, "/organization/email-settings", "Organization");
protected_ok_path!(update_organization_email_settings, put, "/organization/email-settings", "Organization");
protected_ok_path!(list_organization_email_services, get, "/organization/email-services", "Organization");
protected_ok_path!(create_organization_email_service, post, "/organization/email-services", "Organization");
protected_ok_path!(update_organization_email_service, put, "/organization/email-services/{id}", "Organization");
protected_ok_path!(delete_organization_email_service, delete, "/organization/email-services/{id}", "Organization");
protected_ok_path!(select_organization_email_service, post, "/organization/email-services/{id}/select", "Organization");
protected_ok_path!(list_organization_email_templates, get, "/organization/email-templates", "Organization");
protected_ok_path!(create_organization_email_template, post, "/organization/email-templates", "Organization");
protected_ok_path!(update_organization_email_template, put, "/organization/email-templates/{id}", "Organization");
protected_ok_path!(delete_organization_email_template, delete, "/organization/email-templates/{id}", "Organization");

protected_ok_path!(list_library_blocks, get, "/library/blocks", "Assets");
protected_ok_path!(create_library_block, post, "/library/blocks", "Assets");
protected_ok_path!(get_library_block, get, "/library/blocks/{id}", "Assets");
protected_ok_path!(update_library_block, put, "/library/blocks/{id}", "Assets");
protected_ok_path!(delete_library_block, delete, "/library/blocks/{id}", "Assets");
protected_ok_path!(increment_block_usage, post, "/library/blocks/{id}/increment-usage", "Assets");

protected_ok_path!(list_course_rubrics, get, "/courses/{id}/rubrics", "Rubrics");
protected_ok_path!(create_rubric, post, "/courses/{id}/rubrics", "Rubrics");
protected_ok_path!(get_rubric_with_details, get, "/rubrics/{id}", "Rubrics");
protected_ok_path!(update_rubric, put, "/rubrics/{id}", "Rubrics");
protected_ok_path!(delete_rubric, delete, "/rubrics/{id}", "Rubrics");
protected_ok_path!(create_criterion, post, "/rubrics/{id}/criteria", "Rubrics");
protected_ok_path!(update_criterion, put, "/criteria/{id}", "Rubrics");
protected_ok_path!(delete_criterion, delete, "/criteria/{id}", "Rubrics");
protected_ok_path!(create_level, post, "/criteria/{id}/levels", "Rubrics");
protected_ok_path!(update_level, put, "/levels/{id}", "Rubrics");
protected_ok_path!(delete_level, delete, "/levels/{id}", "Rubrics");
protected_ok_path!(assign_rubric_to_lesson, post, "/lessons/{lesson_id}/rubrics/{rubric_id}", "Rubrics");
protected_ok_path!(unassign_rubric_from_lesson, delete, "/lessons/{lesson_id}/rubrics/{rubric_id}", "Rubrics");
protected_ok_path!(get_lesson_rubrics, get, "/lessons/{id}/rubrics", "Rubrics");

protected_ok_path!(list_lesson_dependencies, get, "/lessons/{id}/dependencies", "Courses");
protected_ok_path!(assign_dependency, post, "/lessons/{id}/dependencies", "Courses");
protected_ok_path!(remove_dependency, delete, "/lessons/{id}/dependencies/{prerequisite_id}", "Courses");

protected_ok_path!(list_test_templates, get, "/test-templates", "Templates");
protected_ok_path!(create_test_template, post, "/test-templates", "Templates");
protected_ok_path!(get_test_template, get, "/test-templates/{id}", "Templates");
protected_ok_path!(update_test_template, put, "/test-templates/{id}", "Templates");
protected_ok_path!(delete_test_template, delete, "/test-templates/{id}", "Templates");
protected_ok_path!(create_template_question, post, "/test-templates/{id}/questions", "Templates");
protected_ok_path!(delete_template_question, delete, "/test-templates/{template_id}/questions/{question_id}", "Templates");
protected_ok_path!(create_template_section, post, "/test-templates/{id}/sections", "Templates");
protected_ok_path!(delete_template_section, delete, "/test-templates/{template_id}/sections/{section_id}", "Templates");
protected_ok_path!(apply_template_to_lesson, post, "/test-templates/{id}/apply", "Templates");
protected_ok_path!(generate_questions_with_rag, post, "/test-templates/generate-with-rag", "Templates");

protected_ok_path!(list_questions, get, "/question-bank", "QuestionBank");
protected_ok_path!(create_question, post, "/question-bank", "QuestionBank");
protected_ok_path!(get_question, get, "/question-bank/{id}", "QuestionBank");
protected_ok_path!(update_question, put, "/question-bank/{id}", "QuestionBank");
protected_ok_path!(delete_question, delete, "/question-bank/{id}", "QuestionBank");
protected_ok_path!(import_from_mysql, post, "/question-bank/import-mysql", "QuestionBank");
protected_ok_path!(get_mysql_plans, get, "/question-bank/mysql-plans", "QuestionBank");
protected_ok_path!(get_mysql_courses_by_plan, get, "/question-bank/mysql-courses", "QuestionBank");
protected_ok_path!(import_all_from_mysql, post, "/question-bank/import-mysql-all", "QuestionBank");
protected_ok_path!(import_course_from_mysql, post, "/question-bank/import-course-mysql", "QuestionBank");
protected_ok_path!(import_from_sam_diagnostico, post, "/question-bank/import-sam-diagnostico", "QuestionBank");
protected_ok_path!(ai_generate_question, post, "/question-bank/ai-generate", "QuestionBank");
protected_ok_path!(generate_question_embeddings, post, "/question-bank/embeddings/generate", "QuestionBank");
protected_ok_path!(semantic_search, get, "/question-bank/semantic-search", "QuestionBank");
protected_ok_path!(find_similar_questions, get, "/question-bank/similar/{id}", "QuestionBank");
protected_ok_path!(regenerate_question_embedding, post, "/question-bank/{id}/embedding/regenerate", "QuestionBank");

protected_ok_path!(sync_all_sam, post, "/sam/sync-all", "SAM");
protected_ok_path!(sync_sam_students, post, "/sam/sync-students", "SAM");
protected_ok_path!(sync_sam_assignments, post, "/sam/sync-assignments", "SAM");
protected_ok_path!(list_sam_students, get, "/sam/students", "SAM");
protected_ok_path!(get_sam_student_courses, get, "/sam/students/{student_id}/courses", "SAM");

protected_ok_path!(get_token_usage, get, "/admin/token-usage", "Admin");
protected_ok_path!(get_ai_usage_global, get, "/admin/ai-usage/global", "Admin");
protected_ok_path!(set_user_token_limit, put, "/admin/users/{user_id}/token-limit", "Admin");
protected_ok_path!(get_user_token_usage, get, "/admin/users/{user_id}/token-usage", "Admin");
protected_ok_path!(check_user_token_limit, get, "/admin/users/{user_id}/token-limit/check", "Admin");

protected_ok_path!(list_plugins, get, "/plugins", "Plugins");
protected_ok_path!(create_plugin, post, "/plugins", "Plugins");
protected_ok_path!(list_enabled_plugins, get, "/plugins/enabled", "Plugins");
protected_ok_path!(update_plugin, put, "/plugins/{id}", "Plugins");
protected_ok_path!(delete_plugin, delete, "/plugins/{id}", "Plugins");
