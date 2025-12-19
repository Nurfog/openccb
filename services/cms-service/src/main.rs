mod handlers;

use axum::{
    routing::{get, post},
    Router,
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

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/courses", get(handlers::get_courses).post(handlers::create_course))
        .route("/courses/{id}", get(handlers::get_course))
        .route("/modules", get(handlers::get_modules).post(handlers::create_module))
        .route("/lessons", get(handlers::get_lessons).post(handlers::create_lesson))
        .route("/lessons/{id}", get(handlers::get_lesson).put(handlers::update_lesson))
        .route("/lessons/{id}/transcribe", post(handlers::process_transcription))
        .route("/assets/upload", post(handlers::upload_asset))
        .nest_service("/assets", tower_http::services::ServeDir::new("uploads"))
        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("CMS Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
