mod db_util;
pub mod exporter;
mod handlers;
mod handlers_branding;
mod webhooks;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, post},
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
            get(handlers::get_course).put(handlers::update_course),
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
        .route("/users", get(handlers::get_all_users))
        .route("/users/{id}", axum::routing::put(handlers::update_user))
        .route("/audit-logs", get(handlers::get_audit_logs))
        .route("/api/assets/upload", post(handlers::upload_asset))
        .route("/api/assets/{id}", delete(handlers::delete_asset))
        .route("/courses/{id}/assets", get(handlers::get_course_assets))
        .layer(DefaultBodyLimit::disable())
        .route(
            "/organizations",
            get(handlers::get_organizations).post(handlers::create_organization),
        )
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
            "/organizations/{id}/branding",
            axum::routing::put(handlers_branding::update_organization_branding),
        )
        .route_layer(middleware::from_fn(
            common::middleware::org_extractor_middleware,
        ));

    // Rutas públicas que no requieren autenticación
    let public_routes = Router::new()
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
