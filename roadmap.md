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
  - [ ] Engagement heatmaps
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
    - [ ] Automated reminders for upcoming deadlines.

## Phase 8: Enterprise Features (In Progress)
- [x] **User Profiles & Lifecycle**:
  - [x] **Integrated Logout**: Standardized session management in both portals.
  - [x] **Profile Management**: Self-service user info updates (Avatar, Bio, Language).
- [ ] **Advanced Reporting**:
- [ ] **Integration Ecosystem**: (SSO Next)
- [ ] **Mobile Apps**:
- [ ] **Accessibility**:

## Current Status

**Platform Maturity**: Core multi-tenant architecture is stable and performance-optimized.

**Recent Milestones**:
- ✅ **Local AI Stack**: 100% free transcription and translation (Whisper + Ollama).
- ✅ **Native VTT Subtitles**: Enhanced video player with multi-language CC.
- ✅ **User Profiles**: Glassmorphism UI for identity management.

**Next Priorities**:
1. **SSO Integration**: SAML/OIDC support for enterprise clients.
2. **Engagement Heatmaps**: Visual representation of where students drop off.
3. **Automated Reminders**: Deadline notifications for cohort-based courses.
