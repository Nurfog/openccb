# OpenCCB - Open Comprehensive Course Backbone

OpenCCB is a high-performance, microservices-based Learning Management System (LMS) and Content Management System (CMS) built with Rust (Edition 2024) and Next.js. The name stands for **Open Comprehensive Course Backbone**, representing the solid foundation for modern educational platforms.

## Architecture

- **CMS Service (Port 3001)**: Course management, content creation, grading policies, and administrative configurations.
- **LMS Service (Port 3002)**: Student experience, course consumption, enrollment, and grade tracking.
- **Shared Library**: Core models, authentication logic, and cross-service data contracts.
- **Database**: PostgreSQL with separate databases for CMS and LMS.
- **Studio (Frontend)**: Next.js application for instructors with block-based Activity Builder.
- **Experience (Frontend)**: Next.js student portal with interactive lesson player and progress dashboard.
- **Asset Storage**: Persistent local storage for native video/audio uploads.

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Rust (Edition 2024)
- Node.js (v18+)

### Running with Docker

```bash
docker compose up -d --build
```

### Access Points
- **Studio (Instructors)**: http://localhost:3000
- **Experience (Students)**: http://localhost:3003
- **CMS API**: http://localhost:3001
- **LMS API**: http://localhost:3002

## Core Features

### 🎨 Content Creation & Management
- **Block-Based Activity Builder**: Create rich lessons using text, media, and interactive assessment blocks
- **Advanced Assessment Types**: 
  - Multiple Choice & True/False
  - Fill-in-the-Blanks
  - Matching Pairs
  - Ordering/Sequencing
  - Short Answer (with configurable correct answers)
- **Native File Uploads**: Drag-and-drop video/audio uploads with persistent storage
- **Playback Constraints**: Limit media views per student
- **Dynamic Content Reordering**: Organize blocks with move up/down controls
- **Course Settings**: Configure passing percentages and grading criteria

### 📊 Advanced Grading System
- **Holistic Grading Policy**: 
  - Create weighted grading categories (e.g., Homework 30%, Exams 70%)
  - Drop lowest N scores per category
  - Automatic weighted grade calculation
- **Configurable Assessment Policies**:
  - Set maximum attempts per lesson (1-10 or unlimited)
  - Enable/disable instant corrections and retries
  - Atomic attempt tracking with enforcement
- **Dynamic Passing Thresholds**:
  - Instructors set custom passing percentages (0-100%)
  - 5-tier performance visualization for students:
    - **Reprobado (Red)**: 0% to P-1%
    - **Rendimiento Bajo (Orange)**: P% to P+9%
    - **Rendimiento Medio (Yellow)**: P+10% to P+15%
    - **Buen Rendimiento (Green)**: P+16% to 90%
    - **Excelente (Blue)**: 91%+

### 📈 Analytics & Insights
- **Instructor Analytics Dashboard**:
  - Total enrollments per course
  - Overall average score across all assessments
  - Per-lesson performance breakdown
  - Automatic detection of "struggling lessons" (avg score < 70%)
  - Visual performance charts
- **Student Progress Dashboard**:
  - Real-time weighted grade calculation
  - Category-by-category breakdown
  - Interactive performance bar with tier visualization
  - Lesson completion tracking

### 🔐 Authentication & Security
- **JWT-Based Authentication**: Secure token-based auth across all services
- **Role-Based Access Control (RBAC)**:
  - **Administrators**: Full platform access, global analytics, all course management
  - **Instructors**: Course creation, analytics for assigned courses only
  - **Students**: Course enrollment, lesson consumption, progress tracking
- **Service-to-Service Authorization**: Secure internal API calls with token validation
- **Audit Logging**: All CMS mutations recorded for compliance and debugging

### 🚀 Service Integration
- **Automatic Sync**: One-click publish from CMS to LMS
- **Cross-Service Data Flow**: Courses, modules, lessons, and grading policies synchronized
- **Real-Time Updates**: Student progress immediately reflected in analytics

## API Documentation

### CMS Service (`:3001`)

#### Authentication
```bash
# Register (Instructor/Admin)
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "instructor@example.com", "password": "secure123", "full_name": "John Doe", "role": "instructor"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "instructor@example.com", "password": "secure123"}'
```

#### Course Management
```bash
# Create Course
curl -X POST http://localhost:3001/courses \
  -H "Content-Type: application/json" \
  -d '{"title": "Advanced Rust 2024"}'

# Update Course Settings
curl -X PUT http://localhost:3001/courses/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"passing_percentage": 75}'

# Publish Course to LMS
curl -X POST http://localhost:3001/courses/{id}/publish \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Course Analytics (RBAC enforced)
curl http://localhost:3001/courses/{id}/analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### LMS Service (`:3002`)

#### Student Operations
```bash
# Register Student
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "student@example.com", "password": "secure123", "full_name": "Jane Smith"}'

# Get Course Catalog
curl http://localhost:3002/catalog

# Enroll in Course
curl -X POST http://localhost:3002/enroll \
  -H "Content-Type: application/json" \
  -d '{"user_id": "USER_UUID", "course_id": "COURSE_UUID"}'

# Submit Lesson Score
curl -X POST http://localhost:3002/grades \
  -H "Content-Type: application/json" \
  -d '{"user_id": "USER_UUID", "lesson_id": "LESSON_UUID", "score": 0.85}'

# Get Student Grades
curl http://localhost:3002/users/{user_id}/courses/{course_id}/grades
```

## Technology Stack

### Backend
- **Rust 2024**: High-performance, memory-safe backend services
- **Axum 0.8**: Modern async web framework
- **SQLx**: Compile-time verified SQL queries
- **PostgreSQL**: Robust relational database
- **JWT**: Secure authentication tokens

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe frontend development
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Modern icon library

### DevOps
- **Docker**: Containerized deployment
- **Docker Compose**: Multi-service orchestration

## Project Structure

```
openccb/
├── services/
│   ├── cms-service/          # Course management backend
│   │   ├── src/
│   │   │   ├── handlers.rs   # API handlers
│   │   │   └── main.rs       # Service entry point
│   │   └── migrations/       # Database migrations
│   └── lms-service/          # Learning management backend
│       ├── src/
│       │   ├── handlers.rs   # API handlers
│       │   └── main.rs       # Service entry point
│       └── migrations/       # Database migrations
├── shared/
│   └── common/               # Shared models and auth
│       └── src/
│           ├── models.rs     # Data models
│           └── auth.rs       # JWT utilities
├── web/
│   ├── studio/               # Instructor frontend
│   │   └── src/
│   │       ├── app/          # Next.js pages
│   │       ├── components/   # React components
│   │       └── lib/          # API client
│   └── experience/           # Student frontend
│       └── src/
│           ├── app/          # Next.js pages
│           ├── components/   # React components
│           └── lib/          # API client
└── docker-compose.yml        # Service orchestration
```

## Recent Enhancements

### December 2024
- ✅ **Holistic Grading System**: Weighted categories, drop policies, and automatic calculation
- ✅ **Attempt Tracking**: Configurable max attempts and retry policies per lesson
- ✅ **Instructor Analytics**: Course-level insights with RBAC enforcement
- ✅ **Dynamic Passing Thresholds**: Customizable pass marks with 5-tier performance visualization
- ✅ **Role-Based Access Control**: Admin, Instructor, and Student roles with granular permissions
- ✅ **Enhanced Progress Dashboard**: Real-time weighted grades and visual performance bars

## Contributing

Contributions are welcome! Please ensure all tests pass and follow the existing code style.

## License

MIT License - see LICENSE file for details.
