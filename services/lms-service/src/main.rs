mod db_util;
mod handlers;
mod handlers_discussions;

use axum::{
    Router, middleware,
    routing::{get, post},
};
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::net::SocketAddr;
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

    // Run migrations automatically
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Start background task for deadline notifications
    let pool_clone = pool.clone();
    tokio::spawn(async move {
        loop {
            handlers::check_deadlines_and_notify(pool_clone.clone()).await;
            tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await; // Every hour
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let protected_routes = Router::new()
        .route("/enroll", post(handlers::enroll_user))
        .route("/enrollments/{id}", get(handlers::get_user_enrollments))
        .route("/courses/{id}/outline", get(handlers::get_course_outline))
        .route("/lessons/{id}", get(handlers::get_lesson_content))
        .route("/grades", post(handlers::submit_lesson_score))
        .route(
            "/users/{user_id}/courses/{course_id}/grades",
            get(handlers::get_user_course_grades),
        )
        .route(
            "/courses/{id}/analytics",
            get(handlers::get_course_analytics),
        )
        .route(
            "/courses/{id}/analytics/advanced",
            get(handlers::get_advanced_analytics),
        )
        .route(
            "/courses/{id}/recommendations",
            get(handlers::get_recommendations),
        )
        .route(
            "/users/{id}/gamification",
            get(handlers::get_user_gamification),
        )
        .route("/users/{id}", post(handlers::update_user))
        .route("/analytics/leaderboard", get(handlers::get_leaderboard))
        .route(
            "/lessons/{id}/interactions",
            post(handlers::record_interaction),
        )
        .route(
            "/lessons/{id}/heatmap",
            get(handlers::get_lesson_heatmap),
        )
        .route("/audio/evaluate", post(handlers::evaluate_audio_response))
        .route("/audio/evaluate-file", post(handlers::evaluate_audio_file))
        .route("/lessons/{id}/chat", post(handlers::chat_with_tutor))
        .route("/lessons/{id}/feedback", get(handlers::get_lesson_feedback))
        .route("/notifications", get(handlers::get_notifications))
        .route(
            "/notifications/{id}/read",
            post(handlers::mark_notification_as_read),
        )
        // Discussion Forums Routes
        .route("/courses/{id}/discussions", get(handlers_discussions::list_threads))
        .route("/courses/{id}/discussions", post(handlers_discussions::create_thread))
        .route("/discussions/{id}", get(handlers_discussions::get_thread_detail))
        .route("/discussions/{id}/pin", post(handlers_discussions::pin_thread))
        .route("/discussions/{id}/lock", post(handlers_discussions::lock_thread))
        .route("/discussions/{id}/posts", post(handlers_discussions::create_post))
        .route("/posts/{id}/endorse", post(handlers_discussions::endorse_post))
        .route("/posts/{id}/vote", post(handlers_discussions::vote_post))
        .route("/discussions/{id}/subscribe", post(handlers_discussions::subscribe_thread))
        .route("/discussions/{id}/unsubscribe", post(handlers_discussions::unsubscribe_thread))
        .route_layer(middleware::from_fn(
            common::middleware::org_extractor_middleware,
        ));

    let public_routes = Router::new()
        .route("/catalog", get(handlers::get_course_catalog))
        .route("/ingest", post(handlers::ingest_course))
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .merge(protected_routes)
        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3002));
    tracing::info!("LMS Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, public_routes).await.unwrap();
}
