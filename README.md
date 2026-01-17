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
4.  **AI Services**: stack local con Faster-Whisper (Transcripción) y Ollama (Traducción y Resúmenes).
    - **AI Course Wizard**: Generación automática de cursos a partir de prompts estructurados.
    - **Global Admin Console**: Panel estilo Django para gestión supervisada de tenants y auditoría.
    - **Course Portability**: Importación/Exportación de cursos completos mediante JSON.
    - **User Profiles**: Gestión completa de identidad (avatar, bio, preferencias).
    - **Engagement Heatmaps**: Visualización de retención segundo a segundo en videos.
    - **Smart Notifications**: Recordatorios de fechas límite y alertas in-app.
    - **Global i18n**: Interfaz multilingüe (EN, ES, PT) con persistencia por usuario.
    - **Document-Based Learning**: Soporte para actividades de lectura (PDF, DOCX, PPTX).

##  Requisitos del Sistema

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
- **IA Local**:
  - **Faster-Whisper**: Transcripción de audio a texto.
  - **Ollama**: Traducción inteligente (EN -> ES), resúmenes y generación de cuestionarios.
- **i18n Infrastructure**: Sistema de traducción reactivo para soporte global.
- **Document Management**: Motor de previsualización de documentos PDF nativo.

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

#### 📦 Course Portability
Manage content mobility across different organizations using standardized JSON exports.

#### GET /courses/{id}/export
Generates a complete bundle of the course, including modules, lessons, and grading settings.

#### POST /courses/import
Creates a new course based on a provided export bundle. Automatic dependency mapping ensures data integrity in the new organization.
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

#### SSO (OpenID Connect)
OpenCCB soporta integración con proveedores de identidad (IdP) externos como Google, Okta y Azure AD.
- **Configuración**: Los administradores de la organización pueden configurar sus credenciales OIDC en el panel de configuración de Studio.
- **Autoprovisionamiento**: Los nuevos usuarios se crean automáticamente en la plataforma tras una autenticación exitosa.
- **Flujo**: `/auth/sso/login/{org_id}` -> IdP -> `/auth/sso/callback` -> Redirección a Studio/Experience con JWT.

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
#### POST /courses/generate
Utiliza IA para generar la estructura completa de un curso basado en un prompt.

- **Lógica de Generación**: Utiliza modelos de lenguaje (LLM) para descomponer un tema complejo en una malla curricular lógica de módulos y lecciones.
- **Cuerpo de la Petición ( GenerateCourseRequest ):**
  ```json
  {
    "prompt": "string"
  }
  ```

#### GET /courses/{id}/export
Exporta un curso completo y su contenido a formato JSON para portabilidad.

- **Integridad Portátil**: Empaqueta metadatos, categorías de calificación, módulos y lecciones manteniendo sus relaciones jerárquicas.
- **Respuesta**: Archivo JSON estandarizado para importación.

#### POST /courses/import
Importa un curso a partir de un archivo JSON generado previamente.

- **Mapeo de Dependencias**: Re-mapea automáticamente los IDs de lecciones y módulos para la nueva organización, asegurando que las relaciones y ponderaciones se mantengan intactas.
- **Cuerpo de la Petición ( CourseBundle ):**
  ```json
  {
    "title": "string",
    "description": "string",
    "modules": []
  }
  ```

#### POST /lessons
Agrega contenido multimedia o evaluaciones a un módulo.

- **Configuración Graduable**: Si `is_graded` es true, los puntos sumarán al XP del estudiante en el LMS.
- **Nuevos Tipos Gamificados**:
    - `hotspot`: Identificación visual sobre imágenes (ideal para niños).
    - `memory-match`: Juego de memoria con pares conceptuales.
    - `video-marker`: Preguntas interactivas en timestamps específicos del video.
- **Cuerpo ( CreateLessonRequest ):**
    ```json
    {
      "module_id": "uuid",
      "title": "string",
      "content_type": "string (video | reading | quiz | hotspot | memory-match | document)",
      "content_url": "string (opcional)",
      "is_graded": "boolean"
    }
    ```

#### POST /assets
Sube un archivo multimedia o documento al servidor y devuelve sus metadatos.

- **Lógica de Almacenamiento**: Genera un UUID único para el archivo, extrae el mimetype y lo almacena físicamente en el volumen de `uploads`, registrando la entrada en la base de datos de activos.
- **Cuerpo de la Petición ( MultipartForm ):**
  - `file`: Archivo binario (PDF, Video, Imagen, Docx).
- **Respuesta ( UploadResponse ):**
  ```json
  {
    "id": "uuid",
    "url": "string",
    "mimetype": "string"
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
- **Engagement Tracking**: Si la lección contiene video, el frontend envía eventos de "heartbeat" cada 5 segundos para generar mapas de calor.

#### GET /notifications
Obtiene las notificaciones pendientes del usuario.

- **Filtro de Relevancia**: Devuelve únicamente alertas no leídas sobre fechas límite próximas o logros de gamificación recientes.
- **Respuesta**: Array de `Notification`.

#### POST /notifications/{id}/read
Marca una notificación específica como leída.

- **Persistencia**: Actualiza el estado en la base de datos para que no reaparezca en el feed del usuario.
- **Cuerpo de la Petición**: Vacío.

```bash
# Enviar calificación de 90%
curl -X POST "http://localhost:3002/grades" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"course_id": "...", "lesson_id": "...", "score": 0.9}'
```

---

### 4. IA y Analíticas Avanzadas
Funcionalidades inteligentes 100% locales y gratuitas.

#### POST /lessons/{id}/transcribe
Inicia el proceso de transcripción y traducción para una lección de video/audio.

- **Procesamiento Asíncrono**: Despacha una tarea en segundo plano que utiliza Whisper para transcripción y Ollama para generar la traducción y el resumen inteligente.
- **Cuerpo de la Petición**: Vacío.

#### GET /lessons/{id}/vtt?lang=en|es
Devuelve los subtítulos en formato WebVTT para integración nativa.

- **Internacionalización**: Filtra los subtítulos por el parámetro `lang` y los devuelve con el formato de tiempo compatible con reproductores de video HTML5.
- **Respuesta**: Archivo de texto WebVTT.

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
Métricas de retención y análisis de cohortes para un curso.

- **Inteligencia de Datos**: Cruza información de intentos de evaluaciones y tiempos de visualización para identificar patrones de deserción.
- **Respuesta**: Dashboard JSON con métricas agregadas.

#### GET /lessons/{id}/heatmap
Devuelve los puntos de concentración de visualización para una lección.

- **Engagement Visual**: Analiza los eventos de heartbeat para determinar cuáles segundos del video son los más vistos o repetidos por los estudiantes.
- **Respuesta**: Array de `(second, count)`.

#### GET /courses/{id}/analytics/reports
Generador de reportes personalizados para exportación.

- **Flexibilidad Administrativa**: Permite filtrar el desempeño por cohortes específicas y devuelve la estructura necesaria para generar archivos CSV profesionales.
- **Respuesta**: Stream de datos o estructura de reporte.

---

### 5. Multi-tenancy and Global Management (Super Admin)
OpenCCB is built for multi-tenancy. Organizations are isolated, but a **Super Admin** can manage everything.

#### Super Admin Definition
- **Default Organization ID**: `00000000-0000-0000-0000-000000000001`
- Any user with `role: admin` in this organization is a **Super Admin**.
#### Global Control Panel (`/admin`)
- **Dashboard**: Resumen de organizaciones, usuarios y salud del sistema.
- **Audit Logs**: Seguimiento detallado de todas las acciones administrativas.
- **Service Monitor**: Estado en tiempo real del API Cluster, AI Services y Background Workers.

#### Global Courses
Courses created by Super Admins in the **Default Organization** are automatically marked as **Global**.
- They appear in the catalog of **all organizations**.
- Users from any organization can enroll in global courses.

#### Cross-Tenant Publishing
Super Admins can publish courses to **any organization**. When publishing through the Studio, a premium **Organization Selector** (with search-as-you-type) allows choosing the target destination.

#### X-Organization-Id Header
Super Admins can simulate the context of any organization by sending this header in their requests:
```bash
curl -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
     -H "X-Organization-Id: $TARGET_ORG_ID" \
     http://localhost:3001/courses
```

#### GET /organizations
Obtiene una lista de todas las organizaciones registradas.

- **Control Global**: Accesible únicamente para usuarios con rol `admin` dentro de la organización `Default`. Permite supervisar el crecimiento del ecosistema.
- **Respuesta**: Array de `Organization`.

---

## 🏆 Premium UI Components
- **Course Portability**: Full JSON-based import/export system for multi-tenant content mobility.
- **AI Course Wizard**: Instant curriculum generation from natural language prompts.
- **Global Admin Console**: Centralized control for organizations, users, and audit logs.
- **Experience Player**: A high-performance, accessible learning interface with glassmorphism design.
- **Organization Selector**: A searchable combobox for managing large lists of tenants.
- **Engagement Heatmaps**: Dynamic bar charts showing video retention signatures.
- **Notification Center**: Real-time alerts for deadlines and achievements.
- **Custom Report Builder**: Professional reports with one-click CSV export.
- **Glassmorphism Design**: Consistent aesthetic across Studio and Experience portals.
- **Global Localization**: Native support for English, Spanish, and Portuguese.
- **PDF Integrated Viewer**: Read academic documents without leaving the platform.
- **Interactive Video Markers**: Pause-and-answer questions embedded in video lessons.

## 📄 Licencia
Este proyecto es código abierto y está disponible bajo los términos de la licencia especificada en el repositorio.