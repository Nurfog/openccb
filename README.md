# OpenCCB: Open Comprehensive Course Backbone

OpenCCB es una infraestructura de código abierto para plataformas de gestión de aprendizaje y contenido (LMS/CMS), construida con rendimiento, seguridad y escalabilidad en mente.

## 🚀 Arquitectura Consolidada

El proyecto ha sido optimizado para reducir la complejidad de la infraestructura, consolidando los servicios de backend con sus respectivos frontends en contenedores unificados:

1.  **Studio + CMS (Puerto 3000/3001)**:
    - **Frontend**: Next.js app para administración y creación de contenido.
    - **Backend**: API de Rust para gestión (CMS).
2.  **Experience + LMS (Puerto 3003/3002)**:
    - **Frontend**: Next.js app para la experiencia del estudiante.
    - **Backend**: API de Rust para entrega de cursos y calificaciones (LMS).
3.  **Database**: PostgreSQL compartido.
4.  **AI Services**: Faster-Whisper para transcripción automática.

## � Requisitos del Sistema

OpenCCB es altamente escalable. A continuación se detallan los requisitos recomendados según la carga de usuarios concurrentes:

| Componente | **Pequeño (100 u.)** | **Mediano (500 u.)** | **Grande (1000+ u.)** |
| :--- | :--- | :--- | :--- |
| **CPU** | 4 vCPUs | 8 vCPUs (AVX2) | 16+ vCPUs |
| **RAM** | 8 GB | 16 GB | 32 GB+ |
| **Almacenamiento** | 50 GB SSD | 200 GB NVMe | 500 GB+ NVMe |
| **AI (Opcional)** | N/A (Solo CPU) | NVIDIA 8GB+ VRAM | Multi-GPU / Cloud API |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04+ | Cloud Managed (K8s) |

> [!NOTE]
> Los requisitos de AI son específicos para la función de transcripción local (Whisper). Si se utiliza una API externa, el requisito de GPU desaparece.

## �🛠 Stack Tecnológico

- **Backend**: Rust (Edition 2024), Axum, SQLx.
- **Frontend**: React, Next.js (App Router), Tailwind CSS, Lucide React.
- **Base de Datos**: PostgreSQL 16.
- **Infraestructura**: Docker & Docker Compose.
- **IA**: Faster-Whisper (Transcriptor de video).

## 📦 Guía de Inicio Rápido

### Requisitos Previos
- Docker y Docker Compose.
- Node.js 18+ (para desarrollo local).
- Rust (para desarrollo local).

### Ejecución con Docker (Recomendado)
```bash
docker-compose up --build
```
Esto iniciará todos los servicios:
- **Studio**: [http://localhost:3000](http://localhost:3000)
- **Experience**: [http://localhost:3003](http://localhost:3003)

### Desarrollo Local

#### Studio & CMS
```bash
# Iniciar backend CMS
cd services/cms-service
cargo run

# Iniciar frontend Studio
cd web/studio
npm install
npm run dev
```

#### Experience & LMS
```bash
# Iniciar backend LMS
cd services/lms-service
cargo run

# Iniciar frontend Experience
cd web/experience
npm install
npm run dev
```

## 🔌 Manual del Desarrollador (API)

### 1. Autenticación y Cuentas
Gestión de registro, login y perfiles organizacionales.

#### POST /auth/register
Crea una nueva organización y el usuario administrador inicial.

- **Lógica Inteligente**: Si `organization_name` está vacío, se utiliza el dominio del email. El primer usuario es marcado como `role: admin`.
- **Cuerpo de la Petición ( AuthPayload ):**
  ```json
  {
    "email": "string",
    "password": "string",
    "full_name": "string",
    "organization_name": "string",
    "role": "string (admin | instructor | student)"
  }
  ```
- **Respuesta Exitosa (200 OK) ( AuthResponse ):**
  ```json
  {
    "token": "string (JWT)",
    "user": {
      "id": "uuid",
      "email": "string",
      "full_name": "string",
      "role": "string",
      "organization_id": "uuid"
    }
  }
  ```

```bash
# Registrar un nuevo administrador y empresa
curl -X POST "http://localhost:3001/auth/register" \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@empresa.com", "password": "pass", "organization_name": "OpenCCB Corp"}'
```

---

### 2. Gestión de Contenidos (CMS)
Herramientas para instructores y administradores.

#### POST /courses
Crea un nuevo curso vinculado a la organización del usuario.

- **Lógica**: El `instructor_id` se asigna automáticamente desde el token JWT.
- **Cuerpo ( CreateCourseRequest ):**
  ```json
  {
    "title": "string",
    "pacing_mode": "string (self_paced | instructor_led)"
  }
  ```

```bash
# Crear curso básico
curl -X POST "http://localhost:3001/courses" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"title": "Curso de Rust", "pacing_mode": "self_paced"}'
```

#### POST /lessons
Agrega contenido multimedia o evaluaciones a un módulo.

- **Configuración Graduable**: Si `is_graded` es true, los puntos sumarán al XP del estudiante en el LMS.
- **Cuerpo ( CreateLessonRequest ):**
  ```json
  {
    "module_id": "uuid",
    "title": "string",
    "content_type": "string (video | reading | quiz)",
    "content_url": "string (opcional)",
    "is_graded": "boolean",
    "grading_category_id": "uuid (opcional)"
  }
  ```

```bash
# Agregar lección de video
curl -X POST "http://localhost:3001/lessons" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"module_id": "...", "title": "Intro", "content_type": "video", "is_graded": false}'
```

---

### 3. Experiencia de Aprendizaje (LMS)
Endpoints para estudiantes y seguimiento de progreso.

#### POST /enroll
Inscribe al usuario en un curso.

- **Lógica**: Verifica que el curso pertenezca a la misma organización que el usuario.
- **Cuerpo ( EnrollPayload ):**
  ```json
  {
    "course_id": "uuid"
  }
  ```

```bash
# Inscribirse en un curso
curl -X POST "http://localhost:3002/enroll" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"course_id": "uuid-del-curso"}'
```

#### POST /grades
Registra el puntaje de una lección y actualiza la gamificación.

- **Lógica Inteligente**: Actualiza automáticamente el XP del usuario y despacha webhooks si el curso se completa.
- **Cuerpo ( GradeSubmissionPayload ):**
  ```json
  {
    "course_id": "uuid",
    "lesson_id": "uuid",
    "score": "float (0.0 a 1.0)",
    "metadata": "object (opcional)"
  }
  ```

```bash
# Enviar calificación de 90%
curl -X POST "http://localhost:3002/grades" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"course_id": "...", "lesson_id": "...", "score": 0.9}'
```

---

### 4. IA y Analíticas Avanzadas
Funcionalidades inteligentes y métricas de negocio.

#### POST /chat (Streaming)
Conversación en tiempo real con la base de conocimientos.

- **Nueva Sesión**: Omite `session_id`. La API creará uno nuevo y generará un título automático.
- **Continuar Sesión**: Envía el `session_id` devuelto anteriormente.
- **RAG (Base de Conocimiento)**: Envía `"use_kb": true` para que la IA busque en los documentos de S3.
- **Cuerpo ( ChatPayload ):**
  ```json
  {
    "username": "string",
    "prompt": "string",
    "session_id": "uuid (opcional)",
    "use_kb": "boolean"
  }
  ```

```bash
# Iniciar chat con RAG
curl -X POST "http://localhost:8000/chat" \
     -H "Content-Type: application/json" \
     -d '{
           "username": "juan",
           "prompt": "Explícame qué es Docker en una frase",
           "use_kb": true
         }'
```
**Respuesta**: Stream de texto plano. Al final incluye un JSON con el ID de sesión: `{"session_id": "..."}`.

#### GET /courses/{id}/analytics/advanced
Métricas de retención y análisis de cohortes.

---

### 5. Multi-tenencia y Gestión (Solo Admin)
OpenCCB permite gestionar múltiples organizaciones desde un único punto de acceso.

#### X-Organization-Id Header
Los administradores pueden simular el contexto de cualquier organización enviando este encabezado:
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Organization-Id: $ORG_ID" \
     http://localhost:3001/courses
```

#### GET /organizations
Lista todas las organizaciones registradas.

---

## 🏆 Gamificación y Analíticas
OpenCCB incluye un sistema integrado de:
- **XP y Niveles**: Los estudiantes progresan al completar lecciones.
- **Leaderboards**: Rankings dentro de la organización.
- **Analíticas Avanzadas**: Análisis de cohortes y mapas de calor de retención para instructores.
- **Multi-tenencia Nativa**: Aislamiento total de datos entre organizaciones.

## 📄 Licencia
Este proyecto es código abierto y está disponible bajo los términos de la licencia especificada en el repositorio.