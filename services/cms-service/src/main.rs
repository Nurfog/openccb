mod db_util;
pub mod exporter;
mod external_handlers;
mod handlers;
mod handlers_branding;
mod handlers_email_settings;
mod handlers_email_templates;
mod handlers_exercise_settings;
mod handlers_assets;
mod handlers_dependencies;
mod handlers_library;
mod handlers_rubrics;
mod handlers_test_templates;
mod handlers_question_bank;
mod handlers_admin;
mod handlers_embeddings;
mod handlers_sam;
mod webhooks;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, post, put},
};
use common::health::{self, HealthState};
use dotenvy::dotenv;
use http::{Method, header};
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL debe estar configurada");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&db_url)
        .await
        .expect("Error al conectar con la base de datos");

    // Inicializar el estado de salud
    let health_state = HealthState::default();

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Error al ejecutar las migraciones");

    // Sincronizar la marca de la organización por defecto desde el entorno
    sync_default_organization(&pool).await;

    // Iniciar el trabajador de IA en segundo plano
    let worker_pool = pool.clone();
    tokio::spawn(async move {
        tracing::info!("Trabajador de IA en segundo plano iniciado");
        loop {
            // Buscar transcripciones en cola
            let queued_lessons: Vec<sqlx::types::Uuid> = match sqlx::query_scalar(
                "SELECT id FROM lessons WHERE transcription_status = 'queued' LIMIT 5",
            )
            .fetch_all(&worker_pool)
            .await
            {
                Ok(ids) => ids,
                Err(e) => {
                    tracing::error!("Error al obtener lecciones en cola: {}", e);
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    continue;
                }
            };

            for lesson_id in queued_lessons {
                tracing::info!("Procesando transcripción para la lección: {}", lesson_id);
                if let Err(e) =
                    handlers::run_transcription_task(worker_pool.clone(), lesson_id).await
                {
                    tracing::error!("La tarea de transcripción falló para la lección {}: {}", lesson_id, e);
                    let _ = sqlx::query(
                        "UPDATE lessons SET transcription_status = 'failed' WHERE id = $1",
                    )
                    .bind(lesson_id)
                    .execute(&worker_pool)
                    .await;
                }
            }



            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });

    // Configuración de CORS - Permitir múltiples orígenes para desarrollo y producción
    // Uso de un cierre de predicado para soportar subdominios comodín para norteamericano.cl
    use tower_http::cors::AllowOrigin;
    
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin: &http::HeaderValue, _request: &http::request::Parts| -> bool {
            let origin_str = origin.to_str().unwrap_or("");
            
            // Orígenes de desarrollo
            let allowed_origins = [
                "http://localhost:3000",
                "http://localhost:3003",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3003",
                "http://192.168.0.254:3000",
                "http://192.168.0.254:3003",
                "http://192.168.0.254",
                // Producción - Dominios de Norteamericano (.cl y .com)
                "http://studio.norteamericano.com",
                "https://studio.norteamericano.com",
                "http://learning.norteamericano.com",
                "https://learning.norteamericano.com",
                "http://studio.norteamericano.cl",
                "https://studio.norteamericano.cl",
                "http://learning.norteamericano.cl",
                "https://learning.norteamericano.cl",
            ];
            
            // Comprobar coincidencias exactas
            if allowed_origins.contains(&origin_str) {
                return true;
            }
            
            // Comprobar comodín para subdominios en norteamericano.cl/.com sobre HTTP(S)
            for scheme in ["http://", "https://"] {
                for domain in [".norteamericano.cl", ".norteamericano.com"] {
                    if origin_str.starts_with(scheme) && origin_str.ends_with(domain) {
                        let subdomain = origin_str
                            .strip_prefix(scheme)
                            .unwrap_or("")
                            .strip_suffix(domain)
                            .unwrap_or("");

                        // Permitir cualquier subdominio (ej., api., cdn., admin., etc.)
                        if !subdomain.is_empty() && !subdomain.contains('/') {
                            return true;
                        }
                    }
                }
            }
            
            false
        }))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS, Method::PATCH, Method::HEAD])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::HeaderName::from_static("x-requested-with"),
            header::HeaderName::from_static("x-organization-id"),
            header::RANGE,
        ])
        .expose_headers([header::CONTENT_LENGTH, header::CONTENT_TYPE, header::CONTENT_RANGE, header::ACCEPT_RANGES]);

    use tower_governor::governor::GovernorConfigBuilder;
    use tower_governor::key_extractor::SmartIpKeyExtractor;
    use tower_governor::GovernorLayer;
    use std::sync::Arc;

    let mut governor_conf = GovernorConfigBuilder::default()
        .const_per_second(5) // CMS usually has more complex operations, slightly lower limit
        .const_burst_size(20)
        .key_extractor(SmartIpKeyExtractor);

    let governor_conf = Arc::new(governor_conf.finish().unwrap());

    // Rutas protegidas que requieren autenticación y contexto de organización
    let protected_routes = Router::new()
        .route(
            "/courses",
            get(handlers::get_courses).post(handlers::create_course),
        )
        .route(
            "/courses/{id}",
            get(handlers::get_course)
                .put(handlers::update_course)
                .delete(handlers::delete_course),
        )
        .route("/courses/{id}/publish", post(handlers::publish_course))
        .route("/courses/{id}/outline", get(handlers::get_course_outline))
        .route(
            "/courses/{id}/analytics",
            get(handlers::get_course_analytics),
        )
        .route(
            "/courses/{id}/analytics/advanced",
            get(handlers::get_advanced_analytics),
        )
        .route(
            "/courses/{id}/team",
            get(handlers::get_course_team).post(handlers::add_team_member),
        )
        .route(
            "/courses/{id}/team/{user_id}",
            delete(handlers::remove_team_member),
        )
        .route(
            "/courses/{id}/preview-token",
            post(handlers::create_course_preview_token),
        )
        .route("/lessons/{id}/heatmap", get(handlers::get_lesson_heatmap))
        .route(
            "/modules",
            get(handlers::get_modules).post(handlers::create_module),
        )
        .route("/modules/reorder", post(handlers::reorder_modules))
        .route(
            "/modules/{id}",
            axum::routing::put(handlers::update_module).delete(handlers::delete_module),
        )
        .route(
            "/lessons",
            get(handlers::get_lessons).post(handlers::create_lesson),
        )
        .route("/lessons/reorder", post(handlers::reorder_lessons))
        .route(
            "/lessons/{id}",
            get(handlers::get_lesson)
                .put(handlers::update_lesson)
                .delete(handlers::delete_lesson),
        )
        .route(
            "/lessons/{id}/transcribe",
            post(handlers::process_transcription),
        )
        .route("/lessons/{id}/vtt", get(handlers::get_lesson_vtt))
        .route("/lessons/{id}/summarize", post(handlers::summarize_lesson))
        .route("/lessons/{id}/generate-quiz", post(handlers::generate_quiz))
        .route("/lessons/{id}/generate-role-play", post(handlers::generate_role_play))
        .route("/lessons/{id}/generate-hotspots", post(handlers::generate_hotspots))
        .route("/lessons/{id}/generate-mermaid", post(handlers::generate_mermaid_diagram))
        .route("/lessons/{id}/generate-code-lab", post(handlers::generate_code_lab))
        .route("/courses/generate", post(handlers::generate_course))
        .route("/courses/{id}/export", get(handlers::export_course))
        .route("/courses/import", post(handlers::import_course))
        .route("/course-templates", get(handlers::list_course_templates))
        .route(
            "/course-templates/from-course/{id}",
            post(handlers::create_course_template_from_course),
        )
        .route("/course-templates/{id}/apply", post(handlers::apply_course_template))
        .route("/course-templates/{id}", delete(handlers::delete_course_template))
        .route("/grading", post(handlers::create_grading_category))
        .route("/grading/{id}", delete(handlers::delete_grading_category))
        .route(
            "/courses/{id}/grading",
            get(handlers::get_grading_categories),
        )
        .route("/tipo-nota", get(handlers::get_tipo_nota))
        .route("/auth/me", get(handlers::get_me))
        .route(
            "/users",
            get(handlers::get_all_users).post(handlers::admin_create_user),
        )
        .route("/users/{id}", axum::routing::put(handlers::update_user).delete(handlers::delete_user))
        .route("/audit-logs", get(handlers::get_audit_logs))
        .route("/api/ai/review-text", post(handlers::review_text))
        .route("/api/assets", get(handlers_assets::list_assets))
        .route("/api/assets/upload", post(handlers_assets::upload_asset))
        .route("/api/assets/import-zip", post(handlers_assets::import_assets_zip))
        .route(
            "/api/assets/{id}/ingest-rag",
            post(handlers_assets::ingest_asset_for_rag),
        )
        .route("/api/assets/{id}", delete(handlers_assets::delete_asset))
        .layer(DefaultBodyLimit::disable())
/*
        .route(
            "/organizations",
            get(handlers::get_organizations).post(handlers::create_organization),
        )
        .route("/organizations/{id}", put(handlers::update_organization))
        .route("/admin/provision", post(handlers::provision_organization))
*/
        .route(
            "/webhooks",
            get(handlers::get_webhooks).post(handlers::create_webhook),
        )
        .route("/webhooks/{id}", delete(handlers::delete_webhook))
        .route("/tasks", get(handlers::tasks::get_background_tasks))
        .route("/tasks/{id}/retry", post(handlers::tasks::retry_task))
        .route("/tasks/{id}", delete(handlers::tasks::cancel_task))
        .route("/organization", get(handlers::get_organization))
        .route(
            "/organization/sso",
            get(handlers::get_sso_config).put(handlers::update_sso_config),
        )
        .route(
            "/organization/logo",
            post(handlers_branding::upload_organization_logo),
        )
        .route(
            "/organization/favicon",
            post(handlers_branding::upload_organization_favicon),
        )
        .route(
            "/organization/branding",
            axum::routing::put(handlers_branding::update_organization_branding),
        )
        .route(
            "/organization/exercise-settings",
            get(handlers_exercise_settings::get_organization_exercise_settings)
                .put(handlers_exercise_settings::update_organization_exercise_settings),
        )
        .route(
            "/organization/email-settings",
            get(handlers_email_settings::get_organization_email_settings)
                .put(handlers_email_settings::update_organization_email_settings),
        )
        .route(
            "/organization/email-services",
            get(handlers_email_settings::list_organization_email_services)
                .post(handlers_email_settings::create_organization_email_service),
        )
        .route(
            "/organization/email-services/{id}",
            put(handlers_email_settings::update_organization_email_service)
                .delete(handlers_email_settings::delete_organization_email_service),
        )
        .route(
            "/organization/email-services/{id}/select",
            post(handlers_email_settings::select_organization_email_service),
        )
        .route(
            "/organization/email-templates",
            get(handlers_email_templates::list_organization_email_templates)
                .post(handlers_email_templates::create_organization_email_template),
        )
        .route(
            "/organization/email-templates/{id}",
            put(handlers_email_templates::update_organization_email_template)
                .delete(handlers_email_templates::delete_organization_email_template),
        )
        // Rutas de librerías de contenido
        .route(
            "/library/blocks",
            get(handlers_library::list_library_blocks).post(handlers_library::create_library_block),
        )
        .route(
            "/library/blocks/{id}",
            get(handlers_library::get_library_block)
                .put(handlers_library::update_library_block)
                .delete(handlers_library::delete_library_block),
        )
        .route(
            "/library/blocks/{id}/increment-usage",
            post(handlers_library::increment_block_usage),
        )
        // Rutas de calificación avanzada (rúbricas)
        .route(
            "/courses/{id}/rubrics",
            get(handlers_rubrics::list_course_rubrics).post(handlers_rubrics::create_rubric),
        )
        .route(
            "/rubrics/{id}",
            get(handlers_rubrics::get_rubric_with_details)
                .put(handlers_rubrics::update_rubric)
                .delete(handlers_rubrics::delete_rubric),
        )
        .route(
            "/rubrics/{id}/criteria",
            post(handlers_rubrics::create_criterion),
        )
        .route(
            "/criteria/{id}",
            put(handlers_rubrics::update_criterion).delete(handlers_rubrics::delete_criterion),
        )
        .route(
            "/criteria/{id}/levels",
            post(handlers_rubrics::create_level),
        )
        .route(
            "/levels/{id}",
            put(handlers_rubrics::update_level).delete(handlers_rubrics::delete_level),
        )
        .route(
            "/lessons/{lesson_id}/rubrics/{rubric_id}",
            post(handlers_rubrics::assign_rubric_to_lesson)
                .delete(handlers_rubrics::unassign_rubric_from_lesson),
        )
        .route(
            "/lessons/{id}/rubrics",
            get(handlers_rubrics::get_lesson_rubrics),
        )
        // Rutas de secuencias de aprendizaje (dependencias)
        .route(
            "/lessons/{id}/dependencies",
            get(handlers_dependencies::list_lesson_dependencies)
                .post(handlers_dependencies::assign_dependency),
        )
        .route(
            "/lessons/{id}/dependencies/{prerequisite_id}",
            delete(handlers_dependencies::remove_dependency),
        )
        // Rutas de plantillas de pruebas
        .route(
            "/test-templates",
            get(handlers_test_templates::list_test_templates)
                .post(handlers_test_templates::create_test_template),
        )
        .route(
            "/test-templates/{id}",
            get(handlers_test_templates::get_test_template)
                .put(handlers_test_templates::update_test_template)
                .delete(handlers_test_templates::delete_test_template),
        )
        .route(
            "/test-templates/{id}/questions",
            post(handlers_test_templates::create_template_question),
        )
        .route(
            "/test-templates/{template_id}/questions/{question_id}",
            delete(handlers_test_templates::delete_template_question),
        )
        .route(
            "/test-templates/{id}/sections",
            post(handlers_test_templates::create_template_section),
        )
        .route(
            "/test-templates/{template_id}/sections/{section_id}",
            delete(handlers_test_templates::delete_template_section),
        )
        .route(
            "/test-templates/{id}/apply",
            post(handlers_test_templates::apply_template_to_lesson),
        )
        .route(
            "/test-templates/generate-with-rag",
            post(handlers_test_templates::generate_questions_with_rag),
        )
        // Rutas del banco de preguntas
        .route(
            "/question-bank",
            get(handlers_question_bank::list_questions)
                .post(handlers_question_bank::create_question),
        )
        .route(
            "/question-bank/{id}",
            get(handlers_question_bank::get_question)
                .put(handlers_question_bank::update_question)
                .delete(handlers_question_bank::delete_question),
        )
        .route(
            "/question-bank/import-mysql",
            post(handlers_question_bank::import_from_mysql),
        )
        .route(
            "/question-bank/mysql-plans",
            get(handlers_question_bank::get_mysql_plans),
        )
        .route(
            "/question-bank/mysql-courses",
            get(handlers_question_bank::get_mysql_courses_by_plan),
        )
        .route(
            "/question-bank/import-mysql-all",
            post(handlers_question_bank::import_all_from_mysql),
        )
        .route(
            "/question-bank/import-course-mysql",
            post(handlers_question_bank::import_course_from_mysql),
        )
        .route(
            "/question-bank/import-sam-diagnostico",
            post(handlers_question_bank::import_from_sam_diagnostico),
        )
        .route(
            "/question-bank/ai-generate",
            post(handlers_question_bank::ai_generate_question),
        )
        // Rutas de embeddings para búsqueda semántica
        .route(
            "/question-bank/embeddings/generate",
            post(handlers_embeddings::generate_question_embeddings),
        )
        .route(
            "/question-bank/semantic-search",
            get(handlers_embeddings::semantic_search),
        )
        .route(
            "/question-bank/similar/{id}",
            get(handlers_embeddings::find_similar_questions),
        )
        .route(
            "/question-bank/{id}/embedding/regenerate",
            post(handlers_embeddings::regenerate_question_embedding),
        )
        // Rutas de integración con SAM
        .route(
            "/sam/sync-all",
            post(handlers_sam::sync_all_sam),
        )
        .route(
            "/sam/sync-students",
            post(handlers_sam::sync_sam_students),
        )
        .route(
            "/sam/sync-assignments",
            post(handlers_sam::sync_sam_assignments),
        )
        .route(
            "/sam/students",
            get(handlers_sam::list_sam_students),
        )
        .route(
            "/sam/students/{student_id}/courses",
            get(handlers_sam::get_sam_student_courses),
        )
        // Rutas de administración
        .route(
            "/admin/token-usage",
            get(handlers_admin::get_token_usage),
        )
        .route(
            "/admin/ai-usage/global",
            get(handlers_admin::get_ai_usage_global),
        )
        .route(
            "/admin/users/{user_id}/token-limit",
            put(handlers_admin::set_user_token_limit),
        )
        .route(
            "/admin/users/{user_id}/token-usage",
            get(handlers_admin::get_user_token_usage),
        )
        .route(
            "/admin/users/{user_id}/token-limit/check",
            get(handlers_admin::check_user_token_limit),
        )
        .route_layer(middleware::from_fn(
            common::middleware::org_extractor_middleware,
        ))
        .route_layer(GovernorLayer {
            config: governor_conf,
        });

    let api_routes = Router::new()
        .route(
            "/v1/courses",
            post(external_handlers::create_course_external),
        )
        .route(
            "/v1/courses/{id}",
            get(external_handlers::get_course_external),
        )
        .route(
            "/v1/lessons/{id}/transcribe",
            post(external_handlers::trigger_transcription_external),
        );

    // Rutas públicas que no requieren autenticación
    let auth_routes = Router::new()
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .route("/auth/sso/login/{org_id}", get(handlers::sso_login_init))
        .route("/auth/sso/callback", get(handlers::sso_callback))
        .route(
            "/branding",
            get(handlers_branding::get_organization_branding),
        );

    let public_routes = Router::new()
        .nest("/api/external", api_routes)
        .route(
            "/api/assets/s3-proxy/{bucket}/{*key}",
            get(handlers_assets::public_s3_proxy),
        )
        // Rutas de verificación de salud
        .merge(health::health_routes(pool.clone()).with_state(health_state))
        .nest_service("/assets", tower_http::services::ServeDir::new("uploads"))
        .merge(auth_routes)
        .merge(protected_routes)
        // Cabeceras de seguridad
        .layer(SetResponseHeaderLayer::overriding(
            http::header::STRICT_TRANSPORT_SECURITY,
            http::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            http::header::X_CONTENT_TYPE_OPTIONS,
            http::HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            http::header::X_FRAME_OPTIONS,
            http::HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            http::header::X_XSS_PROTECTION,
            http::HeaderValue::from_static("1; mode=block"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            http::header::REFERRER_POLICY,
            http::HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        // Capa CORS - DEBE ser la última para ejecutarse primero en la respuesta
        .layer(cors)
        // Capa de trazado para registrar solicitudes/respuestas
        .layer(TraceLayer::new_for_http())
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Servicio CMS escuchando en {} con limitación de tasa y cabeceras de seguridad", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, public_routes).await.unwrap();
}

async fn sync_default_organization(pool: &sqlx::PgPool) {
    let org_id = sqlx::types::Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
    
    let name = env::var("DEFAULT_ORG_NAME").unwrap_or_else(|_| "OpenCCB".to_string());
    let platform_name = env::var("DEFAULT_PLATFORM_NAME").ok().filter(|s| !s.is_empty());
    let logo_url = env::var("DEFAULT_LOGO_URL").ok().filter(|s| !s.is_empty());
    let favicon_url = env::var("DEFAULT_FAVICON_URL").ok().filter(|s| !s.is_empty());
    let primary_color = env::var("DEFAULT_PRIMARY_COLOR").ok().filter(|s| !s.is_empty());
    let secondary_color = env::var("DEFAULT_SECONDARY_COLOR").ok().filter(|s| !s.is_empty());

    let result = sqlx::query(
        "UPDATE organizations 
         SET name = $1, 
             platform_name = COALESCE($2, platform_name),
             logo_url = COALESCE($3, logo_url),
             favicon_url = COALESCE($4, favicon_url),
             primary_color = COALESCE($5, primary_color),
             secondary_color = COALESCE($6, secondary_color),
             updated_at = NOW()
         WHERE id = $7"
    )
    .bind(name)
    .bind(platform_name)
    .bind(logo_url)
    .bind(favicon_url)
    .bind(primary_color)
    .bind(secondary_color)
    .bind(org_id)
    .execute(pool)
    .await;

    match result {
        Ok(_) => tracing::info!("Marca de la organización por defecto sincronizada desde .env"),
        Err(e) => tracing::error!("Error al sincronizar la marca de la organización por defecto: {}", e),
    }
}

