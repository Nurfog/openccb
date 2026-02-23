mod db_util;
pub mod exporter;
mod external_handlers;
mod handlers;
mod handlers_branding;
mod handlers_assets;
mod handlers_dependencies;
mod handlers_library;
mod handlers_rubrics;
mod webhooks;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, post, put},
};
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Start AI Background Worker
    let worker_pool = pool.clone();
    tokio::spawn(async move {
        tracing::info!("AI Background Worker started");
        loop {
            // Check for queued transcriptions
            let queued_lessons: Vec<sqlx::types::Uuid> = match sqlx::query_scalar(
                "SELECT id FROM lessons WHERE transcription_status = 'queued' LIMIT 5",
            )
            .fetch_all(&worker_pool)
            .await
            {
                Ok(ids) => ids,
                Err(e) => {
                    tracing::error!("Failed to fetch queued lessons: {}", e);
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    continue;
                }
            };

            for lesson_id in queued_lessons {
                tracing::info!("Processing transcription for lesson: {}", lesson_id);
                if let Err(e) =
                    handlers::run_transcription_task(worker_pool.clone(), lesson_id).await
                {
                    tracing::error!("Transcription task failed for lesson {}: {}", lesson_id, e);
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

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

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
        .route("/courses/generate", post(handlers::generate_course))
        .route("/courses/{id}/export", get(handlers::export_course))
        .route("/courses/import", post(handlers::import_course))
        .route("/grading", post(handlers::create_grading_category))
        .route("/grading/{id}", delete(handlers::delete_grading_category))
        .route(
            "/courses/{id}/grading",
            get(handlers::get_grading_categories),
        )
        .route("/auth/me", get(handlers::get_me))
        .route(
            "/users",
            get(handlers::get_all_users).post(handlers::admin_create_user),
        )
        .route("/users/{id}", axum::routing::put(handlers::update_user))
        .route("/audit-logs", get(handlers::get_audit_logs))
        .route("/api/ai/review-text", post(handlers::review_text))
        .route("/api/assets", get(handlers_assets::list_assets))
        .route("/api/assets/upload", post(handlers_assets::upload_asset))
        .route("/api/assets/{id}", delete(handlers_assets::delete_asset))
        .layer(DefaultBodyLimit::disable())
        .route(
            "/organizations",
            get(handlers::get_organizations).post(handlers::create_organization),
        )
        .route("/admin/provision", post(handlers::provision_organization))
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
            "/organizations/{id}/logo",
            post(handlers_branding::upload_organization_logo),
        )
        .route(
            "/organizations/{id}/favicon",
            post(handlers_branding::upload_organization_favicon),
        )
        .route(
            "/organizations/{id}/branding",
            axum::routing::put(handlers_branding::update_organization_branding),
        )
        // Content Libraries routes
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
        // Advanced Grading (Rubrics) routes
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
        // Learning Sequences (Dependencies) routes
        .route(
            "/lessons/{id}/dependencies",
            get(handlers_dependencies::list_lesson_dependencies)
                .post(handlers_dependencies::assign_dependency),
        )
        .route(
            "/lessons/{id}/dependencies/{prerequisite_id}",
            delete(handlers_dependencies::remove_dependency),
        )
        .route_layer(middleware::from_fn(
            common::middleware::org_extractor_middleware,
        ));

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
    let public_routes = Router::new()
        .nest("/api/external", api_routes)
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .route("/auth/sso/login/{org_id}", get(handlers::sso_login_init))
        .route("/auth/sso/callback", get(handlers::sso_callback))
        .route(
            "/organizations/{id}/branding",
            get(handlers_branding::get_organization_branding),
        )
        .nest_service("/assets", tower_http::services::ServeDir::new("uploads"))
        .merge(protected_routes)
        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("CMS Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, public_routes).await.unwrap();
}
