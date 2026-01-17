# OpenCCB: Open Comprehensive Course Backbone - Roadmap

## Phase 1: Foundation ✅
- [x] Rust Workspace Setup (Edition 2024)
- [x] Microservices Scaffolding (CMS & LMS)
- [x] Multi-Database Infrastructure (PostgreSQL with separate DBs)
- [x] Frontend Initialization (Next.js Studio & Experience)
- [x] Dockerization of all services
- [x] API Integration (Dashboard <-> CMS Service)
- [x] Unified `install.sh` script with hardware detection & auto-config

## Phase 2: Core CMS Features ✅
- [x] Course Outline Editor (Modules & Lessons)
- [x] File Upload System (Video/Audio/Native Assets)
- [x] Interactive Content (Activity Builder)
  - [x] Block Reordering (Move Up/Down)
  - [x] Rich Text Descriptions
  - [x] Media Blocks with Playback Constraints
  - [x] Quiz Blocks (Multiple Choice, True/False, Multiple Select)
  - [x] Advanced Assessment Types:
    - [x] Fill-in-the-Blanks
    - [x] Matching Pairs
    - [x] Ordering/Sequencing
    - [x] Short Answer
- [x] Service-to-Service Communication (CMS -> LMS sync)
- [x] Premium Video Player with playback limits
- [x] Full Studio UI with dynamic course management

## Phase 3: Authentication & Security ✅
- [x] **JWT-Based Authentication**: Common auth across all services
- [x] **Role-Based Access Control (RBAC)**:
  - [x] Multi-role support (Admin, Instructor, Student)
  - [x] Role-specific permissions and UI
  - [x] Token-based authorization for protected endpoints
- [x] **Audit Logging**: All CMS mutations tracked
- [x] **Audit UI**: Admin interface to view audit logs

## Phase 4: LMS Experience & Grading ✅
- [x] **Student Portal (Experience)**:
  - [x] Course catalog and enrollment
  - [x] Interactive lesson player
  - [x] Mobile-responsive design
- [x] **Holistic Grading System**:
  - [x] Weighted grading categories
  - [x] Drop lowest N scores per category
  - [x] Automatic weighted grade calculation
- [x] **Assessment Policies**:
  - [x] Configurable max attempts per lesson
  - [x] Instant corrections and retry policies
  - [x] Atomic attempt tracking with enforcement
- [x] **Progress Tracking**:
  - [x] Real-time score visualization
  - [x] Category-by-category breakdown
  - [x] Weighted grade calculation
- [x] **Dynamic Passing Thresholds**:
  - [x] Configurable passing percentage per course
  - [x] 5-tier performance visualization
  - [x] Color-coded feedback (Reprobado to Excelente)
- [x] **Certificates**: Automated certificate generation upon completion

## Phase 5: Analytics & Insights ✅
- [x] **Instructor Analytics Dashboard**:
  - [x] Total enrollments per course
  - [x] Overall average score
  - [x] Per-lesson performance breakdown
  - [x] "Struggling lessons" detection
  - [x] RBAC enforcement (instructors see only their courses)
- [x] **Student Progress Dashboard**:
  - [x] Interactive performance bar
  - [x] Tier-based feedback visualization
  - [x] Real-time grade updates

## Phase 6: Advanced Features ✅
- [x] **Multi-tenancy**: Support for multiple organizations (Completed)
  - [x] Database schema migration (add `organization_id`)
  - [x] Update Rust models & JWT Claims
  - [x] Implement Axum middleware for organization context
  - [x] Update Frontend registration to support organizations
  - [x] **Super Admin & Default Org**: Global management of all tenants.
  - [x] **Global Course Visibility**: System-wide courses available to all organizations.
- [x] **Organization Branding**: Custom identity per tenant (Completed)
  - [x] Logo upload & optimization
  - [x] Custom color schemes (Primary/Secondary)
  - [x] Dynamic Experience Portal adaptation
  - [x] Live Branding Preview in Studio
- [x] **Advanced UI**:
  - [x] **Premium Organization Selector**: For search-as-you-type multi-tenant management.
  - [x] **Searchable Combobox**: Elegant glassmorphism filtering component.

## Phase 7: User Engagement & Social (In Progress)
- [x] **Advanced Analytics**:
  - [x] Cohort analysis (Implemented)
  - [x] Retention metrics (Implemented)
  - [x] Engagement heatmaps (Implemented)
- [x] **AI Integration**:
  - [x] AI-driven lesson summaries (Implemented)
  - [x] Real-time video transcription & translation via Local AI (Implemented)
  - [x] Automated quiz generation (Implemented)
  - [ ] Personalized learning paths
- [x] **Gamification**: (Broadly implemented)
  - [x] Badges and achievements (Implemented base system)
  - [x] Leaderboards (Implemented)
  - [x] XP and leveling system (Implemented)
- [x] **Course Management Enhancements**:
  - [x] Manual naming for modules, lessons, and activities during creation.
  - [x] Reordering for modules, lessons, and activities (Level up/down).
  - [x] Deletion of modules and lessons with confirmation.
  - [x] **Pacing Control**:
    - [x] Self-paced mode (Evergreen).
    - [x] Instructor-led mode (Cohort-based with start/end dates).
  - [x] **Course Calendar**:
    - [x] Management of important dates (exams, assignments, milestones).
    - [x] Automated reminders for upcoming deadlines. (Implemented)

## Phase 8: Enterprise Features (In Progress)
- [x] **User Profiles & Lifecycle**:
  - [x] **Integrated Logout**: Standardized session management in both portals.
  - [x] **Profile Management**: Self-service user info updates (Avatar, Bio, Language).
- [x] **Advanced Reporting**: Custom report builder and CSV exports. (Implemented)
- [x] **Integration Ecosystem**:
  - [x] **SSO (Single Sign-On)**: Soporte completo para OIDC (Google, Okta, Azure AD) con autoprovisionamiento. (Completado)
- [ ] **Mobile Apps**:
- [ ] **Accessibility**:

## Phase 9: Course Portability (Import/Export) ✅
- [x] **Universal JSON Schema**: Standardized format for course interchange. (Completed)
- [x] **Recursive Exporter**: Serialization of full course hierarchies. (Completed)
- [x] **Atomic Importer**: Batch creation with dependency re-mapping. (Completed)
- [x] **Portability UI**: Integrated Export/Import buttons in Settings. (Completed)

## Phase 10: Global Admin Console (Admin Interface) ✅
- [x] **The "Django" Panel**: Dedicated UI for Super-Admins to manage Orgs, Users, and Health. (Completed)
- [x] **System Monitoring**: Real-time stats on AI usage and service heartbeats. (Completed)
- [x] **Universal Audit Log**: Centralized dashboard for cross-tenant activity. (Completed)

## Phase 11: Extended Assessments & Quizzes (In Progress)
- [x] **Code Quizzes**: Interactive coding challenges with IDE-like player. (Completed)
- [ ] **Image Labeling**: Hotspot quizzes for technical training.
- [ ] **AI Teaching Assistant**: RAG-powered tutor within the lesson player.

## Phase 12: AI-Powered "Auto-Course" Generator ✅
- [x] **Magic Course Creation**: Structure generation from a single prompt. (Completed)
- [x] **Atomic Transactional Ingestion**: Create whole structures (Module -> Lesson) in one go. (Completed)
- [x] **LLM Prompt Engineering**: Professional curriculum design via AI. (Completed)

## Phase 13: Kid-Friendly Gamified Assessments ✅
- [x] **Image Hotspots**: Visual identification quizzes. (Completed)
- [x] **Memory Match**: Educational card games. (Completed)
- [x] **AI Prompt Tuning**: LLM awareness of child-friendly formats. (Completed)

## Phase 14: Globalization & Document-Based Learning ✅
- [x] **Internationalization (i18n)**: UI support for English, Spanish, and Portuguese. (Completed)
- [x] **Language Switcher**: Dynamic locale switching in Navbar and User Profile. (Completed)
- [x] **Document Block**: In-platform PDF preview and DOCX/PPTX downloads. (Completed)
- [x] **Academic Language Consistency**: Content (graded activities) remains in original language. (Completed)
- [x] **Multi-language AI Support**: Transcriptions and summaries follow the course context. (Completed)

## Current Status

**Platform Maturity**: Core multi-tenant architecture is stable and performance-optimized.

**Recent Milestones**:
- ✅ **Globalization (i18n)**: Multi-language UI (EN/ES/PT) for Studio and Experience.
- ✅ **Document Learning**: Support for PDF, DOCX, and PPTX reading activities.
- ✅ **Course Portability**: JSON-based import/export system for multi-tenant mobility.
- ✅ **Gamified Kids Assessments**: Image Hotspots and Memory Match features.
- ✅ **AI Course Wizard**: Instant course structure generation from prompts.
- ✅ **Global Admin Panel**: Centralized control center for system administrators.
- ✅ **Interactive Code Player**: New technical assessment type for developers.
- ✅ **SSO Integration**: OIDC support for corporate clients with self-service config.

**Next Priorities**:
1. **Personalized Learning Paths**: AI-driven content recommendations.
2. **Mobile Apps**: Dedicated iOS and Android wrappers.
3. **Accessibility**: WCAG 2.1 compliance audit and fixes.
