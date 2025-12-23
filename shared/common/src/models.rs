use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Course {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub instructor_id: Uuid,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub passing_percentage: i32,
    pub certificate_template: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Module {
    pub id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Lesson {
    pub id: Uuid,
    pub module_id: Uuid,
    pub title: String,
    pub content_type: String, 
    pub content_url: Option<String>,
    pub transcription: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
    pub grading_category_id: Option<Uuid>,
    pub is_graded: bool,
    pub max_attempts: Option<i32>,
    pub allow_retry: bool,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct GradingCategory {
    pub id: Uuid,
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

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub user_id: Uuid,
    pub action: String,
    pub entity_type: String, 
    pub entity_id: Uuid,
    pub changes: serde_json::Value,
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
    pub course_id: Uuid,
    pub enroled_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Asset {
    pub id: Uuid,
    pub filename: String,
    pub storage_path: String,
    pub mimetype: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub full_name: String,
    pub role: String, // admin, instructor, student
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user: UserResponse,
    pub token: String,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct PublishedCourse {
    pub course: Course,
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
            module_id,
            title: "Test Lesson".to_string(),
            content_type: "activity".to_string(),
            content_url: None,
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
            created_at: Utc::now(),
        };

        let pub_module = PublishedModule {
            module: Module {
                id: module_id,
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
                title: "Test Course".to_string(),
                description: None,
                instructor_id: Uuid::new_v4(),
                start_date: None,
                end_date: None,
                passing_percentage: 70,
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
