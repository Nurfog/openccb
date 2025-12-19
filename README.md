# OpenCCB - Open Comprehensive Course Backbone

OpenCCB is a high-performance, microservices-based Learning Management System (LMS) and Content Management System (CMS) built with Rust (Edition 2024) and Next.js. The name stands for **Open Comprehensive Course Backbone**, representing the solid foundation for modern educational platforms.

## Architecture

- **CMS Service (Port 3001)**: Course management, content creation, and administrative configurations.
- **LMS Service (Port 3002)**: Student experience, course consumption, and enrollment.
- **Shared Library**: Core models and authentication logic.
- **Database**: PostgreSQL (shared/isolated schemas).
- **Studio (Frontend)**: Next.js application with a block-based **Activity Builder** for instructors.
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

## API Documentation

### CMS Service (`:3001`)

#### Create a Course
- **URL**: `/courses`
- **Method**: `POST`
- **Example**:
```bash
curl -X POST http://localhost:3001/courses \
  -H "Content-Type: application/json" \
  -d '{"title": "Advanced Rust 2024"}'
```
- **Response**:
```json
{
  "id": "uuid-v4",
  "title": "Advanced Rust 2024",
  "description": null,
  "instructor_id": "uuid-v4",
  "start_date": null,
  "end_date": null,
  "created_at": "2023-12-19T10:00:00Z",
  "updated_at": "2023-12-19T10:00:00Z"
}
```

#### Create a Module
- **URL**: `/modules`
- **Method**: `POST`
- **Example**:
```bash
curl -X POST http://localhost:3001/modules \
  -H "Content-Type: application/json" \
  -d '{"title": "Introduction", "course_id": "YOUR_COURSE_ID", "position": 1}'
```

### LMS Service (`:3002`)

#### Get Course Catalog
- **URL**: `/catalog`
- **Method**: `GET`
- **Example**:
```bash
curl http://localhost:3002/catalog
```

#### Enroll in a Course
- **URL**: `/enroll`
- **Method**: `POST`
- **Example**:
```bash
curl -X POST http://localhost:3002/enroll \
  -H "Content-Type: application/json" \
  -d '{"course_id": "YOUR_COURSE_ID"}'
```

Every mutation in the CMS (Create Course/Module/Lesson) is automatically recorded in the `audit_logs` table for compliance and debugging.

## Features
- **Block-Based Activity Builder**: Create lessons using text, media, and interactive quiz blocks.
- **Native File Uploads**: Drag-and-drop video/audio uploads with persistence.
- **Playback Constraints**: Limit how many times students can view specific media items.
- **Dynamic Reordering**: (Coming Soon) Organize content blocks with a single click.
