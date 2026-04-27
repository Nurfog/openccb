mod db_util;
mod handlers;
mod handlers_announcements;
mod handlers_pedagogical;
mod handlers_lti_consumer;
mod handlers_email;
mod handlers_scorm;
mod handlers_search;
mod handlers_cohorts;
mod handlers_discussions;
mod handlers_notes;
mod handlers_payments;
mod handlers_peer_review;
mod handlers_embeddings;
mod handlers_ai_audit;
mod handlers_data_ethics;
mod handlers_faq;
mod handlers_certificates;
mod progress_tracking;
mod lti;
mod jwks;
mod predictive;
mod live;
mod portfolio;
mod external_db;
mod openapi;
mod moderation;

use axum::{
    Router, middleware,
    routing::{delete, get, post, put},
    response::Html,
    http::{Method, header},
};
use common::health::{self, HealthState};
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use utoipa::OpenApi;

#[tokio::main]
async fn main() {
    let env_mode = std::env::var("ENVIRONMENT")
        .unwrap_or_else(|_| "prod".to_string())
        .to_lowercase();

    if env_mode == "dev" {
        dotenvy::from_filename(".env.dev").or_else(|_| dotenv()).ok();
    } else {
        dotenv().ok();
    }

    tracing_subscriber::fmt::init();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL debe estar configurada");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&db_url)
        .await
        .expect("Error al conectar con la base de datos");

    // Inicializar estado de salud
    let health_state = HealthState::default();

    let mysql_pool = external_db::init_mysql_pool().await;

    // Ejecutar migraciones automáticamente
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Error al ejecutar las migraciones");

    // Iniciar tarea en segundo plano para notificaciones de fechas límite
    let pool_clone = pool.clone();
    tokio::spawn(async move {
        loop {
            handlers::check_deadlines_and_notify(pool_clone.clone()).await;
            tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await; // Cada hora
        }
    });

    // Configuración de CORS - Permitir múltiples orígenes para desarrollo y producción
    // Usando un cierre de predicado para soportar subdominios comodín para norteamericano.cl
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
                // Producción - Dominios de Norteamericano (HTTPS)
                "https://studio.norteamericano.cl",
                "https://learning.norteamericano.cl",
            ];
            
            // Comprobar coincidencias exactas
            if allowed_origins.contains(&origin_str) {
                return true;
            }
            
            // Comprobar comodín para subdominios: https://*.norteamericano.cl
            if origin_str.starts_with("https://") && origin_str.ends_with(".norteamericano.cl") {
                let subdomain = origin_str
                    .strip_prefix("https://")
                    .unwrap_or("")
                    .strip_suffix(".norteamericano.cl")
                    .unwrap_or("");
                
                // Permitir cualquier subdominio (p. ej., api., cdn., admin., etc.)
                if !subdomain.is_empty() && !subdomain.contains('/') {
                    return true;
                }
            }
            
            false
        }))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS, Method::PATCH])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::HeaderName::from_static("x-requested-with"),
            header::HeaderName::from_static("x-organization-id"),
        ])
        .expose_headers([header::CONTENT_LENGTH, header::CONTENT_TYPE]);

    use tower_governor::governor::GovernorConfigBuilder;
    use tower_governor::key_extractor::SmartIpKeyExtractor;
    use tower_governor::GovernorLayer;
    use std::sync::Arc;

    let mut governor_conf = GovernorConfigBuilder::default()
        .const_per_second(10)
        .const_burst_size(50)
        .key_extractor(SmartIpKeyExtractor);

    let governor_conf = Arc::new(governor_conf.finish().unwrap());

    // Rate limiter solo para rutas protegidas (después del middleware de autenticación)
    let protected_routes = Router::new()
        .route("/auth/me", get(handlers::get_me))
        .route("/courses/{id}/language-config", get(handlers::get_course_language_config))
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
        .route(
            "/lessons/{id}/collaborative-canvas",
            get(handlers::get_lesson_collaborative_canvas)
                .put(handlers::update_lesson_collaborative_canvas),
        )
        .route(
            "/lessons/{id}/collaborative-canvas/stream",
            get(handlers::stream_lesson_collaborative_canvas),
        )
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
        // Aprendizaje en Vivo (Live Learning)
        .route("/courses/{id}/meetings", get(live::get_course_meetings).post(live::create_meeting))
        .route("/courses/{id}/meetings/{meeting_id}", delete(live::delete_meeting))
        // LTI 1.3 Tool Consumer (Fase 36)
        .route(
            "/courses/{id}/lti-tools",
            get(handlers_lti_consumer::list_course_lti_tools)
                .post(handlers_lti_consumer::create_course_lti_tool),
        )
        .route(
            "/courses/{id}/lti-tools/{tool_id}",
            put(handlers_lti_consumer::update_course_lti_tool)
                .delete(handlers_lti_consumer::delete_course_lti_tool),
        )
        .route(
            "/courses/{id}/lti-tools/{tool_id}/rotate-secret",
            post(handlers_lti_consumer::rotate_lti_tool_secret),
        )
        // Portafolio e insignias (Badges)
        .route("/profile/{user_id}", get(portfolio::get_public_profile))
        .route("/my/badges", get(portfolio::get_my_badges))
        .route("/badges/award", post(portfolio::award_badge))
        // Certificados
        .route("/courses/{id}/certificate", get(handlers_certificates::get_certificate))
        .route("/courses/{id}/certificate/issue", post(handlers_certificates::issue_certificate))
        .route("/certificates/verify/{code}", get(handlers_certificates::verify_certificate))
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
        // Rutas de Profesor para Respuesta de Audio
        .route("/audio-responses", get(handlers::get_audio_responses))
        .route("/audio-responses/{id}", get(handlers::get_audio_response_detail))
        .route("/audio-responses/{id}/audio", get(handlers::get_audio_response_audio))
        .route("/audio-responses/{id}/evaluate", post(handlers::teacher_evaluate_audio))
        .route("/courses/{id}/audio-responses/stats", get(handlers::get_audio_response_stats))
        .route("/lessons/{id}/chat", post(handlers::chat_with_tutor))
        .route("/lessons/{id}/chat-role-play", post(handlers::chat_role_play))
        .route("/lessons/{id}/code-hint", post(handlers::get_code_hint))
        .route("/lessons/{id}/feedback", get(handlers::get_lesson_feedback))
        .route("/notifications", get(handlers::get_notifications))
        .route(
            "/notifications/{id}/read",
            post(handlers::mark_notification_as_read),
        )
        // Rutas de Embeddings de Base de Conocimientos para RAG Semántico
        .route(
            "/knowledge-base/embeddings/generate",
            post(handlers_embeddings::generate_knowledge_embeddings),
        )
        .route(
            "/knowledge-base/semantic-search",
            get(handlers_embeddings::semantic_search_knowledge),
        )
        .route(
            "/knowledge-base/{id}/embedding/regenerate",
            post(handlers_embeddings::regenerate_knowledge_embedding),
        )
        // Auditoría de respuestas IA para detección temprana de alucinaciones
        .route(
            "/ai/audit/logs",
            get(handlers_ai_audit::list_ai_audit_logs),
        )
        .route(
            "/ai/audit/logs/{id}/review",
            post(handlers_ai_audit::review_ai_audit_log),
        )
        .route(
            "/ai/audit/metrics",
            get(handlers_ai_audit::get_ai_audit_metrics),
        )
        .route(
            "/ai/data-ethics/summary",
            get(handlers_data_ethics::get_data_ethics_summary),
        )
        // Análisis Pedagógico Profundo (Fase 34)
        .route(
            "/courses/{id}/pedagogical/quality-metrics",
            get(handlers_pedagogical::get_lesson_quality_metrics),
        )
        .route(
            "/courses/{id}/pedagogical/discrimination-index",
            get(handlers_pedagogical::get_quiz_discrimination_index),
        )
        .route(
            "/courses/{id}/pedagogical/suggestions",
            get(handlers_pedagogical::get_curricular_suggestions),
        )
        // Moderación humana para FAQ basada en chats de alumnos
        .route(
            "/faq/review/import-candidates",
            post(handlers_faq::import_faq_candidates),
        )
        .route(
            "/faq/review-queue",
            get(handlers_faq::list_faq_review_queue),
        )
        .route(
            "/faq/review-queue/{id}/answer",
            post(handlers_faq::answer_faq_review_item),
        )
        .route(
            "/faq/review-queue/{id}/dismiss",
            post(handlers_faq::dismiss_faq_review_item),
        )
        .route(
            "/faq/entries",
            get(handlers_faq::list_faq_entries),
        )
        // Rutas de Foros de Discusión
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
        // Anuncios
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
        // Cohortes (Cohorts)
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
        // Evaluación por Pares (Peer Assessment)
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
        .route(
            "/courses/{id}/lessons/{lesson_id}/submissions",
            get(handlers_peer_review::list_lesson_submissions),
        )
        .route(
            "/peer-reviews/submissions/{id}/reviews",
            get(handlers_peer_review::get_submission_reviews),
        )
        .route_layer(middleware::from_fn(
            common::middleware::org_extractor_middleware,
        ))
        .route_layer(GovernorLayer {
            config: governor_conf,
        });

    let public_routes = Router::new()
        .route("/api-docs/openapi.json", get(|| async {
            axum::Json(openapi::ApiDoc::openapi())
        }))
        .route("/scalar", get(|| async {
            Html(r#"
<!doctype html>
<html>
  <head>
    <title>OpenCCB LMS API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/api-docs/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>
            "#)
        }))
        // Rutas de comprobación de salud (Health check)
        .merge(health::health_routes(pool.clone()).with_state(health_state))
        .route("/catalog", get(handlers::get_course_catalog))
        .route("/ingest", post(handlers::ingest_course))
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .route("/auth/forgot-password", post(handlers_email::forgot_password))
        .route("/auth/reset-password", post(handlers_email::reset_password))
        .route("/xapi/statements", post(handlers_scorm::track_xapi_statement))
        .route("/search", get(handlers_search::global_search))
        .route(
            "/payments/mercadopago/webhook",
            post(handlers_payments::mercadopago_webhook),
        )
        .route("/lti/login", get(lti::lti_login_initiation))
        .route("/lti/launch", post(lti::lti_launch))
        .route(
            "/lti/tools/{tool_id}/grade-passback",
            post(handlers_lti_consumer::lti_grade_passback),
        )
        .route("/lti/jwks", get(jwks::lti_jwks_handler))
        .route("/lti/deep-linking/response", post(lti::lti_deep_linking_response))
        .merge(protected_routes)
        // Encabezados de seguridad (Security headers)
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
        .layer(cors)
        .with_state(pool)
        .layer(axum::Extension(mysql_pool));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3002));
    tracing::info!("LMS Service escuchando en {} con limitación de tasa y encabezados de seguridad", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        public_routes.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
