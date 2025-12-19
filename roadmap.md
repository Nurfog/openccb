# OpenCCB: Open Comprehensive Course Backbone - Roadmap

## Phase 1: Foundation (Current)
- [x] Rust Workspace Setup (Edition 2024).
- [x] Microservices Scaffolding (CMS & LMS).
- [x] Multi-Database Infrastructure (Postgres with separate DBs).
- [x] Frontend Initialization (Next.js Studio).
- [x] Dockerization of all services.
- [x] API Integration (Dashboard <-> CMS Service).

## Phase 2: Core CMS Features (Current Focus)
- [/] Course Outline Editor (Modules & Lessons).
- [x] File Upload System (Video/Audio/Native Assets).
- [/] Interactive Content (**Activity Builder Refinement**).
  - [ ] Block Reordering (Move Up/Down).
  - [ ] Rich Text Editor Integration.
  - [ ] Quiz Refinements (True/False, Multi-Response).
- [ ] Service-to-Service Communication (CMS -> LMS sync).
- [x] **Video Player**: Integrated premium video player with playback limits.
- [ ] **Full Studio UI**: Drag-and-drop course builder.

## Phase 3: Authentication & Security
- [ ] **Auth Service**: Integrated OIDC/OAuth2 or custom JWT provider.
- [ ] **RBAC**: Role-Based Access Control (Admin, Instructor, Student).
- [ ] **Audit UI**: Admin interface to view audit logs.

## Phase 4: LMS Experience
- [ ] **Progress Tracking**: Track student completion of lessons and modules.
- [ ] **Certificates**: Automated certificate generation upon completion.
- [ ] **Mobile Responsive**: Optimize student interface for mobile devices.

## Phase 5: Advanced Features
- [ ] **Multi-tenancy**: Support for multiple organizations.
- [ ] **Analytics**: Insight dashboards for instructors.
- [ ] **AI Integration**: AI-driven lesson summaries and quiz generation.
