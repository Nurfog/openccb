mod db_util;
mod handlers;
mod handlers_announcements;
mod handlers_cohorts;
mod handlers_discussions;
mod handlers_notes;
mod handlers_payments;
mod handlers_peer_review;
mod lti;
mod jwks;
mod predictive;
mod live;
mod portfolio;

use axum::{
    Router, middleware,
    routing::{delete, get, post, put},
};
use axum::Json; // Added based on instruction
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
        .route("/auth/me", get(handlers::get_me))
        .route("/enroll", post(handlers::enroll_user))
        .route("/bulk-enroll", post(handlers::bulk_enroll_users))
        .route("/enrollments/{id}", get(handlers::get_user_enrollments))
        .route(
            "/payments/preference",
            post(handlers_payments::create_payment_preference),
        )
        .route("/courses/{id}/outline", get(handlers::get_course_outline))
        .route("/courses/{id}/progress-stats", get(handlers::get_student_progress_stats))
        .route("/lessons/{id}", get(handlers::get_lesson_content))
        .route("/lessons/{id}/bookmark", post(handlers::toggle_bookmark))
        .route("/bookmarks", get(handlers::get_user_bookmarks))
        .route("/grades", post(handlers::submit_lesson_score))
        .route(
            "/users/{user_id}/courses/{course_id}/grades",
            get(handlers::get_user_course_grades),
        )
        .route(
            "/courses/{id}/analytics",
            get(handlers::get_course_analytics),
        )
        .route("/courses/{id}/grades", get(handlers::get_course_grades))
        .route(
            "/courses/{id}/export-grades",
            get(handlers::export_course_grades),
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
            "/courses/{id}/dropout-risks",
            get(predictive::get_course_dropout_risks),
        )
        // Live Learning
        .route("/courses/{id}/meetings", get(live::get_course_meetings).post(live::create_meeting))
        .route("/courses/{id}/meetings/{meeting_id}", delete(live::delete_meeting))
        // Portfolio & Badges
        .route("/profile/{user_id}", get(portfolio::get_public_profile))
        .route("/my/badges", get(portfolio::get_my_badges))
        .route("/badges/award", post(portfolio::award_badge))
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
        .route("/lessons/{id}/heatmap", get(handlers::get_lesson_heatmap))
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
        .route(
            "/courses/{id}/discussions",
            get(handlers_discussions::list_threads),
        )
        .route(
            "/courses/{id}/discussions",
            post(handlers_discussions::create_thread),
        )
        .route(
            "/discussions/{id}",
            get(handlers_discussions::get_thread_detail),
        )
        .route(
            "/discussions/{id}/pin",
            post(handlers_discussions::pin_thread),
        )
        .route(
            "/discussions/{id}/lock",
            post(handlers_discussions::lock_thread),
        )
        .route(
            "/discussions/{id}/posts",
            post(handlers_discussions::create_post),
        )
        .route(
            "/posts/{id}/endorse",
            post(handlers_discussions::endorse_post),
        )
        .route("/posts/{id}/vote", post(handlers_discussions::vote_post))
        .route(
            "/discussions/{id}/subscribe",
            post(handlers_discussions::subscribe_thread),
        )
        .route(
            "/discussions/{id}/unsubscribe",
            post(handlers_discussions::unsubscribe_thread),
        )
        // Announcements
        .route(
            "/courses/{id}/announcements",
            get(handlers_announcements::list_announcements),
        )
        .route(
            "/courses/{id}/announcements",
            post(handlers_announcements::create_announcement),
        )
        .route(
            "/announcements/{id}",
            put(handlers_announcements::update_announcement),
        )
        .route(
            "/announcements/{id}",
            delete(handlers_announcements::delete_announcement),
        )
        .route("/lessons/{id}/notes", get(handlers_notes::get_note))
        .route("/lessons/{id}/notes", put(handlers_notes::save_note))
        // Cohorts
        .route("/cohorts", get(handlers_cohorts::list_cohorts))
        .route("/cohorts", post(handlers_cohorts::create_cohort))
        .route(
            "/cohorts/{id}/members",
            post(handlers_cohorts::add_cohort_member),
        )
        .route(
            "/cohorts/{cohort_id}/members/{user_id}",
            delete(handlers_cohorts::remove_cohort_member),
        )
        .route(
            "/cohorts/{id}/members",
            get(handlers_cohorts::get_cohort_members),
        )
        // Peer Assessment
        .route(
            "/courses/{id}/lessons/{lesson_id}/submit",
            post(handlers_peer_review::submit_assignment),
        )
        .route(
            "/courses/{id}/lessons/{lesson_id}/peer-review",
            get(handlers_peer_review::get_peer_review_assignment),
        )
        .route(
            "/courses/{id}/lessons/{lesson_id}/peer-review",
            post(handlers_peer_review::submit_peer_review),
        )
        .route(
            "/courses/{id}/lessons/{lesson_id}/feedback",
            get(handlers_peer_review::get_my_submission_feedback),
        )
        .route_layer(middleware::from_fn(
            common::middleware::org_extractor_middleware,
        ));

    let public_routes = Router::new()
        .route("/catalog", get(handlers::get_course_catalog))
        .route("/ingest", post(handlers::ingest_course))
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .route(
            "/payments/mercadopago/webhook",
            post(handlers_payments::mercadopago_webhook),
        )
        .route("/lti/login", get(lti::lti_login_initiation))
        .route("/lti/launch", post(lti::lti_launch))
        .route("/lti/jwks", get(jwks::lti_jwks_handler))
        .route("/lti/deep-linking/response", post(lti::lti_deep_linking_response))
        .merge(protected_routes)
        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3002));
    tracing::info!("LMS Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, public_routes).await.unwrap();
}
