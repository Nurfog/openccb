# OpenCCB - Project Context

## Project Overview

**OpenCCB (Open Comprehensive Course Backbone)** is an open-source Learning Management System (LMS) and Content Management System (CMS) platform built for performance, security, and scalability. It provides a complete infrastructure for course creation, student management, and AI-powered learning features.

### Architecture

The project uses a **unified container architecture** with the following structure:

| Service | Ports | Description |
|---------|-------|-------------|
| **Studio + CMS** | 3000/3001 | Next.js admin frontend + Rust CMS API |
| **Experience + LMS** | 3003/3002 | Next.js student frontend + Rust LMS API |
| **Database** | 5433 | PostgreSQL 16 (shared, separate DBs: `openccb_cms`, `openccb_lms`) |

### Technology Stack

**Backend:**
- Rust Edition 2024 (workspace with 3 crates)
- Web Framework: Axum 0.8
- Database: SQLx 0.8 with PostgreSQL 16
- Authentication: JWT (jsonwebtoken 9.3), bcrypt
- Security: HMAC, SHA2, OpenID Connect (SSO)
- Rate Limiting: tower-governor 0.7

**Frontend:**
- Next.js 14 (App Router)
- React 18 + TypeScript 5
- Styling: Tailwind CSS 3.4
- UI: Lucide React, Framer Motion, React Markdown
- Mermaid diagrams for dynamic visualization

**Infrastructure:**
- Docker & Docker Compose
- Single-tenant design (premium module)
- Local AI: Ollama (Llama 3.2) + Faster-Whisper

**Key Features:**
- AI-powered course generation and quiz creation
- Discussion forums with nested replies
- LTI 1.3 Tool Provider (Canvas, Moodle integration)
- Monetization via Mercado Pago
- Live learning with Jitsi integration
- Student portfolios with Open Badges
- Predictive analytics (dropout risk detection)
- Multi-language support (EN, ES, PT)
- Gamification (XP, levels, badges, leaderboards)

## Project Structure

```
openccb/
├── services/
│   ├── cms-service/       # Rust CMS API (course management, content creation)
│   │   ├── migrations/    # SQLx database migrations
│   │   └── src/
│   └── lms-service/       # Rust LMS API (student experience, grades)
│       └── src/
├── shared/
│   └── common/            # Shared Rust library (auth, models, utils)
├── web/
│   ├── studio/            # Next.js CMS frontend (admin/instructor)
│   └── experience/        # Next.js LMS frontend (student)
├── e2e/                   # Playwright end-to-end tests
├── scripts/               # Utility scripts (auth, database)
└── [config files]
```

### Rust Workspace Members

```toml
[workspace]
members = [
    "services/cms-service",
    "services/lms-service",
    "shared/common",
]
```

## Building and Running

### Docker (Recommended)

```bash
# Start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d

# Rebuild and start
docker-compose up -d --build

# Clean install (removes volumes)
docker-compose down -v && docker-compose up --build

# Run E2E tests
docker-compose --profile test up e2e
```

### Local Development

**Prerequisites:**
- Rust (Edition 2024)
- Node.js 18+
- PostgreSQL 16
- sqlx-cli: `cargo install sqlx-cli --no-default-features --features postgres`

**Backend (Rust):**

```bash
# CMS Service (port 3001)
cd services/cms-service
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms cargo run

# LMS Service (port 3002)
cd services/lms-service
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_lms cargo run

# With debug logging
RUST_LOG=debug cargo run -p cms-service
```

**Frontend (Next.js):**

```bash
# Studio (CMS Frontend - port 3000)
cd web/studio
npm install
npm run dev

# Experience (LMS Frontend - port 3003)
cd web/experience
npm install
npm run dev
```

### Installation Script

```bash
# Full installation with database setup
./install.sh

# Fast mode (skip dependency checks)
./install.sh --fast
```

## Development Commands

### Code Quality

```bash
# Frontend linting and formatting
cd web/studio && npm run lint:fix
cd web/studio && npm run format
cd web/studio && npm run type-check

# Same commands available in web/experience
```

### Database Management

```bash
# Reset database (delete and recreate)
./reset_db.sh

# Run migrations manually
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms \
  sqlx migrate run --source services/cms-service/migrations

DATABASE_URL=postgresql://user:password@localhost:5433/openccb_lms \
  sqlx migrate run --source services/lms-service/migrations
```

### Health Checks

```bash
# CMS Service
curl http://localhost:3001/health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready

# LMS Service
curl http://localhost:3002/health
curl http://localhost:3002/health/live
curl http://localhost:3002/health/ready
```

### Utilities

```bash
# Generate secure JWT secret
./generate_jwt_secret.sh

# Clear session
./clear_session.sh

# Validate authentication
./validate_auth.sh

# Diagnose auth issues
./diagnose_auth.sh
```

## API Endpoints

### Authentication (CMS - port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new user |
| POST | `/auth/login` | Login and get JWT token |
| GET | `/auth/profile` | Get current user profile |

### Course Management (CMS)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/courses` | Create course |
| POST | `/courses/generate` | AI-generate course structure |
| GET | `/courses/{id}/export` | Export course to JSON |
| POST | `/courses/import` | Import course from JSON |
| DELETE | `/courses/{id}` | Delete course |
| POST | `/lessons` | Add lesson to module |
| POST | `/assets/upload` | Upload media/document |

### Learning Experience (LMS - port 3002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/enroll` | Enroll in course |
| POST | `/grades` | Submit lesson score |
| GET | `/notifications` | Get user notifications |
| POST | `/notifications/{id}/read` | Mark notification as read |

### Discussion Forums (LMS)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/{id}/discussions` | List threads |
| POST | `/courses/{id}/discussions` | Create thread |
| GET | `/discussions/{id}` | Get thread with replies |
| POST | `/discussions/{id}/posts` | Reply to thread |
| POST | `/posts/{id}/vote` | Vote on post |
| POST | `/posts/{id}/endorse` | Mark post as correct (instructor) |

### AI Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/lessons/{id}/transcribe` | Start transcription |
| POST | `/lessons/{id}/generate-quiz` | Generate quiz with AI |
| POST | `/lessons/{id}/chat` | Chat with lesson tutor |
| GET | `/lessons/{id}/feedback` | Get AI feedback |
| GET | `/courses/{id}/dropout-risks` | Get dropout risk analysis |

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
CMS_DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms
LMS_DATABASE_URL=postgresql://user:password@localhost:5433/openccb_lms

# JWT Secret (generate with ./generate_jwt_secret.sh)
JWT_SECRET=your_secure_secret

# AI Configuration
AI_PROVIDER=local
LOCAL_WHISPER_URL=http://localhost:9000
LOCAL_OLLAMA_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3.2:3b

# Frontend URLs
NEXT_PUBLIC_CMS_API_URL=http://localhost:3001
NEXT_PUBLIC_LMS_API_URL=http://localhost:3002
```

### Default Credentials

After running `./install.sh`, the default admin user is:
- **Email**: `admin@norteamericano.cl`
- **Password**: `Admin123!`

You can customize these during installation.

## Testing

### E2E Tests (Playwright)

```bash
# Run all tests
cd e2e && npx playwright test

# Run with UI
cd e2e && npx playwright test --ui

# Run specific test file
cd e2e && npx playwright test tests/auth.spec.ts

# Generate report
cd e2e && npx playwright show-report
```

### Backend Tests

```bash
# Run Rust tests
cargo test -p cms-service
cargo test -p lms-service
cargo test -p common
```

## Key Conventions

### Rust Code Style

- Use workspace dependencies from root `Cargo.toml`
- Shared code goes in `shared/common`
- Use `sqlx::query!` macros for compile-time SQL verification
- Error handling with `thiserror` and `anyhow`
- Tracing for logging (`tracing::info!`, `tracing::debug!`)

### Frontend Code Style

- TypeScript strict mode enabled
- Tailwind CSS for styling
- Lucide React for icons
- Framer Motion for animations
- Components in `src/components/`
- Pages in `src/app/` (Next.js App Router)

### Database

- Separate databases for CMS and LMS
- Migrations managed by SQLx
- UUIDs for primary keys
- Timestamps with timezone (timestamptz)

### Authentication

- JWT-based authentication
- Bcrypt password hashing
- Role-based access control (admin, instructor, student)
- OpenID Connect support for SSO

## Common Issues

### CORS Errors (Login/Registro)

Si ves errores de CORS al intentar loguearte:

```
Access to fetch at 'http://localhost:3001/auth/login' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Solución**: Asegúrate de que el rate limiter NO esté aplicado a las rutas de autenticación.
En `services/cms-service/src/main.rs`, el `GovernorLayer` debe estar solo en `protected_routes`,
no en `public_routes`.

### Rate Limiter Bloqueando Peticiones

**Estado actual**: El rate limiter (`tower_governor`) está **deshabilitado** debido a problemas de compatibilidad con el middleware de autenticación.

Si quieres habilitarlo en producción:

1. Agrega `GovernorLayer` solo a rutas protegidas usando `.route_layer()`
2. Configúralo después del middleware de autenticación
3. Ajusta los límites (por defecto: 10 req/s, burst 50)

```rust
.protected_routes
    .route_layer(middleware::from_fn(org_extractor_middleware))
    .route_layer(GovernorLayer { config: governor_conf })
```

**Advertencia**: Si el rate limiter está mal configurado, las peticiones a `/courses`, `/auth/login`, etc. pueden fallar con error 500 sin logs.

### Port Conflicts

If port 5432 is occupied, the setup uses 5433:
```bash
# Check if port is in use
lsof -i :5432
lsof -i :5433
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check database connectivity
docker exec openccb-db-1 pg_isready -U user
```

### Frontend Build Issues

```bash
# Clear Next.js cache
rm -rf web/studio/.next
rm -rf web/experience/.next

# Reinstall dependencies
cd web/studio && rm -rf node_modules && npm install
```

### Rust Compilation Issues

```bash
# Clean and rebuild
cargo clean
cargo build

# Update dependencies
cargo update
```

## Related Documentation

- `README.md` - Comprehensive user documentation with API manual
- `OPTIMIZATIONS.md` - Performance optimizations implemented
- `roadmap.md` - Project roadmap and feature status
- `diagnose_auth.sh` - Authentication debugging script
