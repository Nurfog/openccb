use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct GradingCategory {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub name: String,
    pub weight: i32, // 0-100
    pub drop_count: i32,
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
    pub enrolled_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Asset {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Option<Uuid>,
    pub filename: String,
    pub storage_path: String,
    pub mimetype: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedAnalytics {
    pub cohorts: Vec<CohortData>,
    pub retention: Vec<RetentionData>,
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
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            grading_categories: vec![],
            modules: vec![pub_module],
        };

        let serialized = serde_json::to_string(&pub_course).unwrap();
        let deserialized: PublishedCourse = serde_json::from_str(&serialized).unwrap();

        assert_eq!(pub_course.course.title, deserialized.course.title);
        assert_eq!(pub_course.modules.len(), deserialized.modules.len());
        assert_eq!(deserialized.modules[0].lessons[0].title, "Test Lesson");
    }
}
