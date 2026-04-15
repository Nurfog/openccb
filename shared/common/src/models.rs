use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
#[sqlx(default)]
pub struct Course {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub instructor_id: Uuid,
    pub pacing_mode: String, // "self_paced" o "instructor_led"
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub passing_percentage: i32,
    pub certificate_template: Option<String>,
    pub price: f64,
    pub currency: String,
    pub marketing_metadata: Option<serde_json::Value>,
    pub course_image_url: Option<String>,
    pub level: Option<CourseLevel>,
    pub course_type: Option<CourseType>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Default for Course {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            title: String::new(),
            description: None,
            instructor_id: Uuid::new_v4(),
            pacing_mode: "self_paced".to_string(),
            start_date: None,
            end_date: None,
            passing_percentage: 0,
            certificate_template: None,
            price: 0.0,
            currency: "USD".to_string(),
            marketing_metadata: None,
            course_image_url: None,
            level: None,
            course_type: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Module {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
#[sqlx(default)]
pub struct Lesson {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub module_id: Uuid,
    pub title: String,
    pub content_type: String,
    pub content_url: Option<String>,
    pub summary: Option<String>,
    pub transcription: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
    pub grading_category_id: Option<Uuid>,
    pub is_graded: bool,
    pub max_attempts: Option<i32>,
    pub allow_retry: bool,
    pub position: i32,
    pub due_date: Option<DateTime<Utc>>,
    pub important_date_type: Option<String>, // "exam", "assignment", "milestone", etc.
    pub transcription_status: Option<String>,
    pub is_previewable: bool,
    pub content_blocks: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

impl Default for Lesson {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            module_id: Uuid::new_v4(),
            title: String::new(),
            content_type: String::new(),
            content_url: None,
            summary: None,
            transcription: None,
            metadata: None,
            content_blocks: None,
            grading_category_id: None,
            is_graded: false,
            max_attempts: None,
            allow_retry: false,
            position: 0,
            due_date: None,
            important_date_type: None,
            transcription_status: None,
            is_previewable: false,
            created_at: Utc::now(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct GradingCategory {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub name: String,
    pub weight: i32, // 0-100
    pub drop_count: i32,
    pub tipo_nota_id: Option<i32>, // Se mapea con idTipoNota en el sistema MySQL externo
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserGrade {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub score: f32, // 0.0 a 1.0
    pub attempts_count: i32,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LessonInteraction {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub lesson_id: Uuid,
    pub video_timestamp: Option<f64>,
    pub event_type: String,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct HeatmapPoint {
    pub second: i32,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Notification {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub message: String,
    pub notification_type: String,
    pub is_read: bool,
    pub link_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLogResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_full_name: Option<String>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub changes: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Enrollment {
    pub id: Uuid,
    pub user_id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub external_id: Option<i32>, // idDetalleContrato del sistema externo
    pub progress: f32,
    pub enrolled_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct UserBookmark {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct CourseInstructor {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub user_id: Uuid,
    pub role: String, // "primary", "instructor", "assistant"
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LtiRegistration {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub issuer: String,
    pub client_id: String,
    pub deployment_id: String,
    pub auth_token_url: String,
    pub auth_login_url: String,
    pub jwks_url: String,
    pub platform_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LtiResourceLink {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub resource_link_id: String,
    pub course_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LtiLaunchClaims {
    #[serde(rename = "iss")]
    pub issuer: String,
    #[serde(rename = "sub")]
    pub subject: String,
    #[serde(rename = "aud")]
    pub audience: serde_json::Value, // Puede ser una cadena o un array
    #[serde(rename = "exp")]
    pub expires_at: i64,
    #[serde(rename = "iat")]
    pub issued_at: i64,
    pub nonce: String,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/message_type")]
    pub message_type: String,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/version")]
    pub version: String,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/deployment_id")]
    pub deployment_id: String,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/resource_link")]
    pub resource_link: Option<LtiResourceLinkClaim>,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings")]
    pub deep_linking_settings: Option<LtiDeepLinkingSettings>,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/context")]
    pub context: Option<LtiContextClaim>,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/roles")]
    pub roles: Vec<String>,
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LtiResourceLinkClaim {
    pub id: String,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LtiContextClaim {
    pub id: String,
    pub label: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LtiDeepLinkingSettings {
    pub deep_link_return_url: String,
    pub accept_types: Vec<String>,
    pub accept_presentation_document_targets: Vec<String>,
    pub accept_media_types: Option<String>,
    pub accept_multiple: Option<bool>,
    pub accept_copy_advice: Option<bool>,
    pub auto_create: Option<bool>,
    pub title: Option<String>,
    pub text: Option<String>,
    pub data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LtiDeepLinkingResponseClaims {
    #[serde(rename = "iss")]
    pub issuer: String,
    #[serde(rename = "sub")]
    pub subject: String,
    #[serde(rename = "aud")]
    pub audience: String,
    #[serde(rename = "exp")]
    pub expires_at: i64,
    #[serde(rename = "iat")]
    pub issued_at: i64,
    pub nonce: String,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/message_type")]
    pub message_type: String, // "LtiDeepLinkingResponse"
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/version")]
    pub version: String, // "1.3.0"
    #[serde(rename = "https://purl.imsglobal.org/spec/lti/claim/deployment_id")]
    pub deployment_id: String,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti-dl/claim/content_items")]
    pub content_items: Vec<LtiDeepLinkingContentItem>,
    #[serde(rename = "https://purl.imsglobal.org/spec/lti-dl/claim/data")]
    pub data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LtiDeepLinkingContentItem {
    #[serde(rename = "type")]
    pub item_type: String, // "ltiResourceLink"
    pub title: Option<String>,
    pub text: Option<String>,
    pub url: Option<String>,
    pub icon: Option<LtiImage>,
    pub thumbnail: Option<LtiImage>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LtiImage {
    pub url: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Asset {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub uploaded_by: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub english_level: Option<String>,
    pub sam_plan_id: Option<i32>,
    pub sam_course_id: Option<i32>,
    pub unit_number: Option<i32>,
    pub filename: String,
    pub storage_path: String,
    pub mimetype: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Transaction {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub amount: f64,
    pub currency: String,
    pub status: String, // "pending", "success", "failure" (pendiente, éxito, falla)
    pub provider_reference: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[sqlx(default)]
pub struct User {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub full_name: String,
    pub role: String, // admin (administrador), instructor, student (estudiante)
    pub xp: i32,
    pub level: i32,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub language: Option<String>,
    pub is_public_profile: Option<bool>,
    pub linkedin_url: Option<String>,
    pub github_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Default for User {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            email: String::new(),
            password_hash: String::new(),
            full_name: String::new(),
            role: "student".to_string(),
            xp: 0,
            level: 1,
            avatar_url: None,
            bio: None,
            language: None,
            is_public_profile: Some(true),
            linkedin_url: None,
            github_url: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub organization_id: Uuid,
    pub xp: i32,
    pub level: i32,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
#[sqlx(default)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub domain: Option<String>,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub certificate_template: Option<String>,
    pub certificates_enabled: bool,
    pub platform_name: Option<String>,
    pub favicon_url: Option<String>,
    pub logo_variant: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Default for Organization {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            name: String::new(),
            domain: None,
            logo_url: None,
            primary_color: None,
            secondary_color: None,
            certificate_template: None,
            certificates_enabled: true,
            platform_name: None,
            favicon_url: None,
            logo_variant: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user: UserResponse,
    pub token: String,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct PublishedCourse {
    pub course: Course,
    pub organization: Organization,
    pub grading_categories: Vec<GradingCategory>,
    pub modules: Vec<PublishedModule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instructors: Option<Vec<CourseInstructor>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<LessonDependency>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublishedModule {
    pub module: Module,
    pub lessons: Vec<Lesson>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseAnalytics {
    pub course_id: Uuid,
    pub total_enrollments: i64,
    pub average_score: f32, // 0.0-1.0
    pub lessons: Vec<LessonAnalytics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonAnalytics {
    pub lesson_id: Uuid,
    pub lesson_title: String,
    pub average_score: f32, // 0.0-1.0
    pub submission_count: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CohortData {
    pub period: String,
    pub count: i64,
    pub completion_rate: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RetentionData {
    pub lesson_id: Uuid,
    pub lesson_title: String,
    pub student_count: i64,
    pub completion_rate: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedAnalytics {
    pub cohorts: Vec<CohortData>,
    pub retention: Vec<RetentionData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DailyProgress {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyticsFilter {
    pub cohort_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Recommendation {
    pub title: String,
    pub description: String,
    pub lesson_id: Option<Uuid>,
    pub priority: String, // "high", "medium", "low" (alta, media, baja)
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecommendationResponse {
    pub recommendations: Vec<Recommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressStats {
    pub total_lessons: i64,
    pub completed_lessons: i64,
    pub progress_percentage: f32,
    pub daily_completions: Vec<DailyProgress>,
    pub estimated_completion_date: Option<DateTime<Utc>>,
}
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Webhook {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub url: String,
    pub events: Vec<String>,
    pub secret: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct OrganizationSSOConfig {
    pub organization_id: Uuid,
    pub issuer_url: String,
    pub client_id: String,
    pub client_secret: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct AuditLog {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub event_type: String,
    pub old_data: Option<serde_json::Value>,
    pub new_data: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub changes: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}


// Modelos de Foros de Discusión
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DiscussionThread {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Option<Uuid>,
    pub author_id: Uuid,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub is_locked: bool,
    pub view_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DiscussionPost {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub thread_id: Uuid,
    pub parent_post_id: Option<Uuid>,
    pub author_id: Uuid,
    pub content: String,
    pub upvotes: i32,
    pub is_endorsed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DiscussionVote {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub post_id: Uuid,
    pub user_id: Uuid,
    pub vote_type: String, // 'upvote' o 'downvote'
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DiscussionSubscription {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub thread_id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// DTOs de respuesta para las APIs de Discusión
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ThreadWithAuthor {
    // Campos del hilo
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Option<Uuid>,
    pub author_id: Uuid,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub is_locked: bool,
    pub view_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Información del autor
    pub author_name: String,
    pub author_avatar: Option<String>,
    // Datos agregados
    pub post_count: i64,
    pub has_endorsed_answer: bool,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct PostWithAuthor {
    // Campos de la publicación
    pub id: Uuid,
    pub organization_id: Uuid,
    pub thread_id: Uuid,
    pub parent_post_id: Option<Uuid>,
    pub author_id: Uuid,
    pub content: String,
    pub upvotes: i32,
    pub is_endorsed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Author info
    pub author_name: String,
    pub author_avatar: Option<String>,
    // Interacción del usuario
    pub user_vote: Option<String>, // 'upvote', 'downvote' o nulo
    // Respuestas anidadas (no desde la BD, pobladas manualmente)
    #[sqlx(skip)]
    pub replies: Vec<PostWithAuthor>,
}

// Anuncios del Curso
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct CourseAnnouncement {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub author_id: Uuid,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[sqlx(skip)]
    pub cohort_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct AnnouncementWithAuthor {
    // Campos del anuncio
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub author_id: Uuid,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Author info
    pub author_name: String,
    pub author_avatar: Option<String>,
    #[sqlx(skip)]
    pub cohort_ids: Option<Vec<Uuid>>,
}

// Notas del Estudiante
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct StudentNote {
    pub id: Uuid,
    pub user_id: Uuid,
    pub lesson_id: Uuid,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SaveNotePayload {
    pub content: String,
}

// Cohortes y Grupos
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Cohort {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct UserCohort {
    pub id: Uuid,
    pub cohort_id: Uuid,
    pub user_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCohortPayload {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddMemberPayload {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct StudentGradeReport {
    pub user_id: Uuid,
    pub full_name: String,
    pub email: String,
    pub progress: f32,
    pub average_score: Option<f32>,
    pub last_active_at: Option<DateTime<Utc>>,
}

// Evaluación por Pares
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct CourseSubmission {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub content: String,
    pub submitted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub organization_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct PeerReview {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub reviewer_id: Uuid,
    pub score: i32,
    pub feedback: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub organization_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct SubmitAssignmentPayload {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct SubmitPeerReviewPayload {
    pub submission_id: Uuid,
    pub score: i32,
    pub feedback: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct SubmissionWithReviews {
    pub id: Uuid,
    pub user_id: Uuid,
    pub full_name: String,
    pub email: String,
    pub submitted_at: DateTime<Utc>,
    pub review_count: i64,
    pub average_score: Option<f64>,
}

// Librerías de Contenido
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LibraryBlock {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub created_by: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub block_type: String,
    pub block_data: serde_json::Value,
    pub tags: Option<Vec<String>>,
    pub usage_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateLibraryBlockPayload {
    pub name: String,
    pub description: Option<String>,
    pub block_type: String,
    pub block_data: serde_json::Value,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateLibraryBlockPayload {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LibraryTemplate {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub created_by: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub lesson_data: serde_json::Value,
    pub tags: Option<Vec<String>>,
    pub usage_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, Copy, PartialEq)]
#[sqlx(type_name = "dropout_risk_level", rename_all = "lowercase")]
pub enum DropoutRiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DropoutRisk {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub user_id: Uuid,
    pub risk_level: DropoutRiskLevel,
    pub score: f32, // 0.0 a 1.0 (Más alto significa mayor riesgo)
    pub reasons: Option<serde_json::Value>, // ej., ["low_grades", "inactivity"]
    pub last_calculated_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DropoutRiskReason {
    pub metric: String,
    pub value: f32,
    pub description: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_published_course_serialization() {
        let lesson_id = Uuid::new_v4();
        let module_id = Uuid::new_v4();
        let course_id = Uuid::new_v4();

        let lesson = Lesson {
            id: lesson_id,
            organization_id: course_id, // Usar course_id como proxi para org_id en la prueba
            module_id,
            title: "Test Lesson".to_string(),
            content_type: "activity".to_string(),
            content_url: None,
            summary: None,
            transcription: None,
            metadata: Some(json!({
                "blocks": [
                    {
                        "id": "b1",
                        "type": "fill-in-the-blanks",
                        "content": "The capital of France is [[Paris]]."
                    },
                    {
                        "id": "b2",
                        "type": "matching",
                        "pairs": [{"left": "Term", "right": "Definition"}]
                    }
                ]
            })),
            grading_category_id: None,
            is_graded: false,
            max_attempts: None,
            allow_retry: true,
            position: 1,
            due_date: None,
            important_date_type: None,
            transcription_status: None,
            is_previewable: true,
            content_blocks: None,
            created_at: Utc::now(),
        };

        let pub_module = PublishedModule {
            module: Module {
                id: module_id,
                organization_id: course_id,
                course_id,
                title: "Test Module".to_string(),
                position: 1,
                created_at: Utc::now(),
            },
            lessons: vec![lesson],
        };

        let pub_course = PublishedCourse {
            course: Course {
                id: course_id,
                organization_id: Uuid::new_v4(),
                title: "Test Course".to_string(),
                description: None,
                instructor_id: Uuid::new_v4(),
                pacing_mode: "self_paced".to_string(),
                start_date: None,
                end_date: None,
                passing_percentage: 70,
                certificate_template: None,
                price: 0.0,
                currency: "USD".to_string(),
                marketing_metadata: None,
                course_image_url: None,
                level: None,
                course_type: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            organization: Organization {
                id: Uuid::new_v4(),
                name: "Test Org".to_string(),
                domain: None,
                logo_url: None,
                primary_color: None,
                secondary_color: None,
                certificate_template: None,
                certificates_enabled: true,
                platform_name: None,
                favicon_url: None,
                logo_variant: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            grading_categories: vec![],
            modules: vec![pub_module],
            instructors: None,
            dependencies: None,
        };

        let course_with_price = Course {
            id: course_id,
            organization_id: Uuid::new_v4(),
            title: "Test Course".to_string(),
            description: None,
            instructor_id: Uuid::new_v4(),
            pacing_mode: "self_paced".to_string(),
            start_date: None,
            end_date: None,
            passing_percentage: 70,
            certificate_template: None,
            price: 29.99,
            currency: "USD".to_string(),
            marketing_metadata: None,
            course_image_url: None,
            level: None,
            course_type: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert_eq!(course_with_price.price, 29.99);

        let serialized = serde_json::to_string(&pub_course).unwrap();
        let deserialized: PublishedCourse = serde_json::from_str(&serialized).unwrap();

        assert_eq!(pub_course.course.title, deserialized.course.title);
        assert_eq!(pub_course.modules.len(), deserialized.modules.len());
        assert_eq!(deserialized.modules[0].lessons[0].title, "Test Lesson");
    }
}

// ==================== Calificación Avanzada / Rúbricas ====================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Rubric {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Option<Uuid>,
    pub created_by: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub total_points: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct RubricCriterion {
    pub id: Uuid,
    pub rubric_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub max_points: i32,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct RubricLevel {
    pub id: Uuid,
    pub criterion_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub points: i32,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LessonRubric {
    pub id: Uuid,
    pub lesson_id: Uuid,
    pub rubric_id: Uuid,
    pub is_active: bool,
    pub assigned_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RubricAssessment {
    pub id: Uuid,
    pub lesson_id: Uuid,
    pub rubric_id: Uuid,
    pub user_id: Uuid,
    pub graded_by: Option<Uuid>,
    pub submission_id: Option<Uuid>,
    pub total_score: f32,
    pub max_score: i32,
    pub feedback: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssessmentScore {
    pub id: Uuid,
    pub assessment_id: Uuid,
    pub criterion_id: Uuid,
    pub level_id: Option<Uuid>,
    pub points: f32,
    pub feedback: Option<String>,
    pub created_at: DateTime<Utc>,
}
// ==================== Secuencias de Aprendizaje / Dependencias ====================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LessonDependency {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub lesson_id: Uuid,
    pub prerequisite_lesson_id: Uuid,
    pub min_score_percentage: Option<f64>,
    pub created_at: DateTime<Utc>,
}

// ==================== Aprendizaje en Vivo (Reuniones) ====================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Meeting {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub provider: String, // "jitsi" | "bbb"
    pub meeting_id: String, // Nombre de la sala o ID externo
    pub start_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub join_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ==================== Portafolio del Estudiante e Insignias ====================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Badge {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub description: String,
    pub icon_url: String,
    pub criteria: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct UserBadge {
    pub id: Uuid,
    pub user_id: Uuid,
    pub badge_id: Uuid,
    pub awarded_at: DateTime<Utc>,
    pub evidence_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PublicProfile {
    pub user_id: Uuid,
    pub full_name: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub badges: Vec<Badge>,
    pub level: i32,
    pub xp: i32,
    pub completed_courses_count: i64,
}

// ==================== Plantillas de Examen ====================

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[sqlx(type_name = "course_level", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
#[allow(non_camel_case_types)]
pub enum CourseLevel {
    Beginner,
    Beginner_1,
    Beginner_2,
    Intermediate,
    Intermediate_1,
    Intermediate_2,
    Advanced,
    Advanced_1,
    Advanced_2,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[sqlx(type_name = "course_type", rename_all = "lowercase")]
#[serde(rename_all = "snake_case")]
pub enum CourseType {
    Intensive,
    Regular,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[sqlx(type_name = "test_type")]
pub enum TestType {
    #[sqlx(rename = "CA")]
    CA,   // Evaluación Continua
    #[sqlx(rename = "MWT")]
    MWT,  // Examen Escrito de Mitad de Ciclo
    #[sqlx(rename = "MOT")]
    MOT,  // Examen Oral de Mitad de Ciclo
    #[sqlx(rename = "FOT")]
    FOT,  // Examen Oral Final
    #[sqlx(rename = "FWT")]
    FWT,  // Examen Escrito Final
}

impl std::fmt::Display for TestType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TestType::CA => write!(f, "CA"),
            TestType::MWT => write!(f, "MWT"),
            TestType::MOT => write!(f, "MOT"),
            TestType::FOT => write!(f, "FOT"),
            TestType::FWT => write!(f, "FWT"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct TestTemplate {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub mysql_course_id: Option<i32>, // Referencia al curso de MySQL importado
    pub name: String,
    pub description: Option<String>,
    pub level: Option<CourseLevel>, // Depreciado: use mysql_course_id en su lugar
    pub course_type: Option<CourseType>, // Depreciado: use mysql_course_id en su lugar
    pub test_type: TestType,
    pub duration_minutes: i32,
    pub passing_score: i32, // Porcentaje 0-100
    pub total_points: i32,
    pub instructions: Option<String>,
    pub template_data: serde_json::Value, // Estructura completa del examen con secciones y preguntas
    pub tags: Option<Vec<String>>,
    pub is_active: bool,
    pub usage_count: i32,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct TestTemplateSection {
    pub id: Uuid,
    pub template_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub section_order: i32,
    pub points: i32,
    pub instructions: Option<String>,
    pub section_data: Option<serde_json::Value>, // Configuración específica de la sección
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct TestTemplateQuestion {
    pub id: Uuid,
    pub template_id: Uuid,
    pub section_id: Option<Uuid>,
    pub question_order: i32,
    pub question_type: String, // "multiple-choice", "true-false", "short-answer", "essay", "matching", "ordering"
    pub question_text: String,
    pub options: Option<serde_json::Value>, // Array of options for multiple choice
    pub correct_answer: Option<serde_json::Value>, // Can be index, array of indices, or text
    pub explanation: Option<String>,
    pub points: i32,
    pub metadata: Option<serde_json::Value>, // Metadatos adicionales de la pregunta
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateTestTemplatePayload {
    pub name: String,
    pub description: Option<String>,
    pub mysql_course_id: Option<i32>, // Referencia al curso de MySQL importado (preferido)
    pub level: Option<CourseLevel>, // Alternativa si no se proporciona mysql_course_id
    pub course_type: Option<CourseType>, // Alternativa si no se proporciona mysql_course_id
    pub test_type: TestType,
    pub duration_minutes: i32,
    pub passing_score: i32,
    pub total_points: i32,
    pub instructions: Option<String>,
    pub template_data: serde_json::Value,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateTestTemplatePayload {
    pub name: Option<String>,
    pub description: Option<String>,
    pub mysql_course_id: Option<i32>,
    pub level: Option<CourseLevel>,
    pub course_type: Option<CourseType>,
    pub test_type: Option<TestType>,
    pub duration_minutes: Option<i32>,
    pub passing_score: Option<i32>,
    pub total_points: Option<i32>,
    pub instructions: Option<String>,
    pub template_data: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestTemplateWithQuestions {
    pub template: TestTemplate,
    pub sections: Vec<TestTemplateSection>,
    pub questions: Vec<TestTemplateQuestion>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApplyTemplatePayload {
    pub lesson_id: Uuid,
    pub grading_category_id: Option<Uuid>,
}

// ==================== Banco de Preguntas ====================

#[derive(Debug, Serialize, Deserialize, Clone, Copy, sqlx::Type, PartialEq)]
#[sqlx(type_name = "question_bank_type")]
pub enum QuestionBankType {
    #[sqlx(rename = "multiple-choice")]
    MultipleChoice,
    #[sqlx(rename = "true-false")]
    TrueFalse,
    #[sqlx(rename = "short-answer")]
    ShortAnswer,
    #[sqlx(rename = "essay")]
    Essay,
    #[sqlx(rename = "matching")]
    Matching,
    #[sqlx(rename = "ordering")]
    Ordering,
    #[sqlx(rename = "fill-in-the-blanks")]
    FillInTheBlanks,
    #[sqlx(rename = "audio-response")]
    AudioResponse,
    #[sqlx(rename = "hotspot")]
    Hotspot,
    #[sqlx(rename = "code-lab")]
    CodeLab,
}

impl std::fmt::Display for QuestionBankType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            QuestionBankType::MultipleChoice => write!(f, "multiple-choice"),
            QuestionBankType::TrueFalse => write!(f, "true-false"),
            QuestionBankType::ShortAnswer => write!(f, "short-answer"),
            QuestionBankType::Essay => write!(f, "essay"),
            QuestionBankType::Matching => write!(f, "matching"),
            QuestionBankType::Ordering => write!(f, "ordering"),
            QuestionBankType::FillInTheBlanks => write!(f, "fill-in-the-blanks"),
            QuestionBankType::AudioResponse => write!(f, "audio-response"),
            QuestionBankType::Hotspot => write!(f, "hotspot"),
            QuestionBankType::CodeLab => write!(f, "code-lab"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct QuestionBank {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub question_text: String,
    pub question_type: QuestionBankType,
    pub options: Option<serde_json::Value>,
    pub correct_answer: Option<serde_json::Value>,
    pub explanation: Option<String>,
    pub audio_url: Option<String>,
    pub audio_text: Option<String>,
    pub audio_status: Option<String>,
    pub audio_metadata: Option<serde_json::Value>,
    pub media_url: Option<String>,
    pub media_type: Option<String>,
    pub points: i32,
    pub difficulty: Option<String>,
    pub tags: Option<Vec<String>>,
    pub skill_assessed: Option<String>, // lectura (reading), escucha (listening), habla (speaking), escritura (writing)
    pub source: Option<String>,
    pub source_metadata: Option<serde_json::Value>,
    pub imported_mysql_id: Option<i32>,
    pub imported_mysql_course_id: Option<i32>,
    pub usage_count: Option<i32>,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_active: bool,
    pub is_archived: bool,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub embedding: Option<String>, // Embedding de PGVector para búsqueda semántica
    pub embedding_updated_at: Option<chrono::DateTime<chrono::Utc>>,
    pub source_asset_id: Option<Uuid>, // Activo de audio/video que originó este fragmento RAG
    pub unit_number: Option<i32>,      // Número de unidad del sílabo desde la estructura de carpetas ZIP
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateQuestionBankPayload {
    pub question_text: String,
    pub question_type: QuestionBankType,
    pub options: Option<serde_json::Value>,
    pub correct_answer: Option<serde_json::Value>,
    pub explanation: Option<String>,
    pub points: Option<i32>,
    pub difficulty: Option<String>,
    pub tags: Option<Vec<String>>,
    pub media_url: Option<String>,
    pub media_type: Option<String>,
    pub skill_assessed: Option<String>, // lectura (reading), escucha (listening), habla (speaking), escritura (writing)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateQuestionBankPayload {
    pub question_text: Option<String>,
    pub question_type: Option<QuestionBankType>,
    pub options: Option<serde_json::Value>,
    pub correct_answer: Option<serde_json::Value>,
    pub explanation: Option<String>,
    pub points: Option<i32>,
    pub difficulty: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_active: Option<bool>,
    pub is_archived: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportQuestionFromMySQLPayload {
    pub mysql_course_id: Option<i32>,
    pub question_ids: Option<Vec<i32>>, // MySQL question IDs
    pub import_all: Option<bool>,       // Import all questions from MySQL
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestionBankFilters {
    pub question_type: Option<QuestionBankType>,
    pub difficulty: Option<String>,
    pub tags: Option<String>, // Comma-separated
    pub source: Option<String>,
    pub search: Option<String>,
    pub has_audio: Option<bool>,
}

// ==================== MODELOS DE RESPUESTA DE AUDIO ====================
// Para ejercicios de práctica de habla con evaluación de IA + Profesor

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AudioResponseStatus {
    Pending,
    AiEvaluated,
    TeacherEvaluated,
    BothEvaluated,
}

impl std::fmt::Display for AudioResponseStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AudioResponseStatus::Pending => write!(f, "pending"),
            AudioResponseStatus::AiEvaluated => write!(f, "ai_evaluated"),
            AudioResponseStatus::TeacherEvaluated => write!(f, "teacher_evaluated"),
            AudioResponseStatus::BothEvaluated => write!(f, "both_evaluated"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct AudioResponse {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub block_id: Uuid,
    pub prompt: String,
    pub transcript: Option<String>,
    pub audio_url: Option<String>,
    pub audio_data: Option<Vec<u8>>,
    
    // AI Evaluation
    pub ai_score: Option<i32>,
    pub ai_found_keywords: Option<Vec<String>>,
    pub ai_feedback: Option<String>,
    pub ai_evaluated_at: Option<DateTime<Utc>>,
    
    // Teacher Evaluation
    pub teacher_score: Option<i32>,
    pub teacher_feedback: Option<String>,
    pub teacher_evaluated_at: Option<DateTime<Utc>>,
    pub teacher_evaluated_by: Option<Uuid>,
    
    // Status and metadata
    pub status: AudioResponseStatus,
    pub attempt_number: i32,
    pub duration_seconds: Option<i32>,
    pub metadata: Option<serde_json::Value>,
    
    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioResponseWithUser {
    pub id: Uuid,
    pub user_id: Uuid,
    pub student_name: String,
    pub student_email: String,
    pub course_id: Uuid,
    pub course_title: String,
    pub lesson_id: Uuid,
    pub lesson_title: String,
    pub block_id: Uuid,
    pub prompt: String,
    pub transcript: Option<String>,
    pub ai_score: Option<i32>,
    pub ai_feedback: Option<String>,
    pub teacher_score: Option<i32>,
    pub teacher_feedback: Option<String>,
    pub status: AudioResponseStatus,
    pub created_at: DateTime<Utc>,
    pub attempt_number: i32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct AudioResponseStats {
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub total_responses: i64,
    pub ai_evaluated: i64,
    pub teacher_evaluated: i64,
    pub fully_evaluated: i64,
    pub pending: i64,
    pub avg_ai_score: Option<f32>,
    pub avg_teacher_score: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateAudioResponsePayload {
    pub lesson_id: Uuid,
    pub block_id: Uuid,
    pub prompt: String,
    pub transcript: Option<String>,
    pub duration_seconds: Option<i32>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateAudioResponsePayload {
    pub teacher_score: i32,
    pub teacher_feedback: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioResponseEvaluation {
    pub score: i32,
    pub found_keywords: Vec<String>,
    pub feedback: String,
}
