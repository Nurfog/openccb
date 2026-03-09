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
    pub pacing_mode: String, // "self_paced" or "instructor_led"
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub passing_percentage: i32,
    pub certificate_template: Option<String>,
    pub price: f64,
    pub currency: String,
    pub marketing_metadata: Option<serde_json::Value>,
    pub course_image_url: Option<String>,
    pub generation_status: Option<String>,
    pub generation_progress: Option<i32>,
    pub generation_error: Option<String>,
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
            generation_status: None,
            generation_progress: None,
            generation_error: None,
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
            grading_category_id: None,
            is_graded: false,
            max_attempts: None,
            allow_retry: false,
            position: 0,
            due_date: None,
            important_date_type: None,
            transcription_status: None,
            video_generation_status: None,
            video_generation_error: None,
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
    pub tipo_nota_id: Option<i32>, // Maps to idTipoNota in external MySQL system
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserGrade {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub lesson_id: Uuid,
    pub score: f32, // 0.0 to 1.0
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
    pub external_id: Option<i32>, // idDetalleContrato from the external system
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
    pub audience: serde_json::Value, // Can be string or array
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
    pub status: String, // "pending", "success", "failure"
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
    pub role: String, // admin, instructor, student
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
    pub priority: String, // "high", "medium", "low"
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


// Discussion Forums Models
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
    pub vote_type: String, // 'upvote' or 'downvote'
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

// Response DTOs for Discussion APIs
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ThreadWithAuthor {
    // Thread fields
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
    // Author info
    pub author_name: String,
    pub author_avatar: Option<String>,
    // Aggregated data
    pub post_count: i64,
    pub has_endorsed_answer: bool,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct PostWithAuthor {
    // Post fields
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
    // User interaction
    pub user_vote: Option<String>, // 'upvote', 'downvote', or null
    // Nested replies (not from DB, populated manually)
    #[sqlx(skip)]
    pub replies: Vec<PostWithAuthor>,
}

// Course Announcements
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
    // Announcement fields
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

// Student Notes
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

// Cohorts & Groups
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

// Peer Assessment
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

// Content Libraries
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
    pub score: f32, // 0.0 to 1.0 (Higher means higher risk)
    pub reasons: Option<serde_json::Value>, // e.g., ["low_grades", "inactivity"]
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
            organization_id: course_id, // Use course_id as proxy for org_id in test
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
                platform_name: None,
                favicon_url: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            grading_categories: vec![],
            modules: vec![pub_module],
            instructors: None,
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

// ==================== Advanced Grading / Rubrics ====================

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
// ==================== Learning Sequences / Dependencies ====================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LessonDependency {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub lesson_id: Uuid,
    pub prerequisite_lesson_id: Uuid,
    pub min_score_percentage: Option<f64>,
    pub created_at: DateTime<Utc>,
}

// ==================== Live Learning (Meetings) ====================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Meeting {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub provider: String, // "jitsi" | "bbb"
    pub meeting_id: String, // Room name or external ID
    pub start_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub join_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ==================== Student portfolio & Badges ====================

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
