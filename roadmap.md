# OpenCCB: Open Comprehensive Course Backbone - Roadmap

## Phase 1: Foundation ✅
- [x] Rust Workspace Setup (Edition 2024)
- [x] Microservices Scaffolding (CMS & LMS)
- [x] Multi-Database Infrastructure (PostgreSQL with separate DBs)
- [x] Frontend Initialization (Next.js Studio & Experience)
- [x] Dockerization of all services
- [x] API Integration (Dashboard <-> CMS Service)

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

## Phase 6: Advanced Features (In Progress)
- [x] **Multi-tenancy**: Support for multiple organizations (Completed)
  - [x] Database schema migration (add `organization_id`)
  - [x] Update Rust models & JWT Claims
  - [x] Implement Axum middleware for organization context
  - [x] Update Frontend registration to support organizations
- [ ] **Advanced Analytics**:
  - [ ] Cohort analysis
  - [ ] Retention metrics
  - [ ] Engagement heatmaps
- [ ] **AI Integration** (Next Up):
  - [x] AI-driven lesson summaries (Implemented)
  - [ ] Implement real-time video transcription via external API
  - [x] Automated quiz generation (Implemented)
  - [ ] Personalized learning paths
- [ ] **Gamification**:
  - [x] Badges and achievements (Implemented base system)
  - [ ] Leaderboards
  - [ ] XP and leveling system
- [ ] **Communication**:
  - [ ] Discussion forums
  - [ ] Direct messaging
  - [ ] Announcements
- [ ] **Content Library**:
  - [ ] Reusable content blocks
  - [ ] Template courses
  - [ ] Shared resource pool

## Phase 7: Enterprise Features (Future)
- [ ] **Advanced Reporting**:
  - [ ] Custom report builder
  - [ ] Export to PDF/CSV
  - [ ] Scheduled reports
- [ ] **Integration Ecosystem**:
  - [ ] LTI 1.3 support
  - [ ] SCORM compliance
  - [ ] Third-party integrations (Zoom, Google Meet)
- [ ] **Mobile Apps**:
  - [ ] Native iOS app
  - [ ] Native Android app
  - [ ] Offline mode
- [ ] **Accessibility**:
  - [ ] WCAG 2.1 AA compliance
  - [ ] Screen reader optimization
  - [ ] Keyboard navigation

## Current Status

**Platform Maturity**: Core functionality is production-ready. Advanced features like AI integration are under active development.

**Recent Milestones**:
- ✅ **Multi-Tenancy**: Full support for multiple organizations, from the database to the frontend.
- ✅ **Holistic Grading System**: Weighted categories, attempt tracking, and dynamic passing thresholds.
- ✅ **Analytics Dashboards**: Performance insights for both instructors and students.
- ✅ **Full Content Editor**: Robust activity builder with multiple interactive block types.

**Next Priorities**:
1. **AI Integration**: Implement real-time video transcription.
2. **Gamification**: Introduce badges and achievements.
3. **Advanced Analytics**: Develop cohort analysis and retention metrics.
