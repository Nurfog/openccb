mod handlers;

use axum::{
    routing::{get, post, delete, put},
    Router,
    middleware,
};
use tower_http::cors::{Any, CorsLayer};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use dotenvy::dotenv;
use std::env;

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

    // Run migrations automatically
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Rutas protegidas que requieren autenticación y contexto de organización
    let protected_routes = Router::new()
        .route("/courses", get(handlers::get_courses).post(handlers::create_course))
        .route("/courses/:id", get(handlers::get_course).put(handlers::update_course))
        .route("/courses/{id}/publish", post(handlers::publish_course))
        .route("/courses/{id}/analytics", get(handlers::get_course_analytics))
        .route("/modules", get(handlers::get_modules).post(handlers::create_module))
        .route("/lessons", get(handlers::get_lessons).post(handlers::create_lesson))
        .route("/lessons/:id", get(handlers::get_lesson).put(handlers::update_lesson))
        .route("/lessons/{id}/transcribe", post(handlers::process_transcription))
        .route("/grading", post(handlers::create_grading_category))
        .route("/grading/:id", delete(handlers::delete_grading_category))
        .route("/courses/{id}/grading", get(handlers::get_grading_categories))
        .route("/audit-logs", get(handlers::get_audit_logs))
        .route("/assets/upload", post(handlers::upload_asset))
        .route_layer(middleware::from_fn(common::middleware::org_extractor_middleware));

    // Rutas públicas que no requieren autenticación
    let public_routes = Router::new()
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .nest_service("/assets", tower_http::services::ServeDir::new("uploads"))
        .merge(protected_routes)
        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("CMS Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, public_routes).await.unwrap();
}
