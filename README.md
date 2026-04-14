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
    - **Course Portability**: Importación/Exportación de cursos completos mediante JSON.
    - **User Profiles**: Gestión completa de identidad (avatar, bio, preferencias).
    - **Engagement Heatmaps**: Visualización de retención segundo a segundo en videos.
    - **Smart Notifications**: Recordatorios de fechas límite y alertas in-app.
    - **Global i18n**: Interfaz multilingüe (EN, ES, PT) con persistencia por usuario.
    - **Document-Based Learning**: Soporte para actividades de lectura (PDF, DOCX, PPTX).
    - **AI English Teacher**: Persona especializada para generación de contenidos y tutoría personalizada.
    - **AI Audio Evaluation**: Evaluación inteligente de pronunciación y contenido con feedback en lenguaje natural.
    - **Custom AI Quizzes**: Generación de quices con contexto pedagógico y tipo de pregunta personalizable (opción múltiple, V/F, etc.).
    - **Course Deletion**: Funcionalidad de eliminación de cursos con verificación de permisos y limpieza en cascada.
    - **Gamified Activities**: Nuevos tipos de bloques interactivos incluyendo Juegos de Memoria (con generación automática por IA) y Puntos Calientes (Hotspots).
    - **Course Marketing & Summary**: Sistema de metadatos estructurados (objetivos, requisitos) y landing pages premium para una mejor presentación de cursos.
    - **Global AI Task Dashboard**: Panel unificado de control en consola administrativa para monitorear, reintentar y cancelar tareas de IA en segundo plano (transcripciones, quices, etc).
- **Dynamic API Resolution**: Resolución inteligente de endpoints que permite el acceso desde cualquier dispositivo en la red local (WiFi) sin configuración manual.
- **Responsive UI/UX**: Interfaces optimizadas para dispositivos móviles con menús adaptativos y escalado fluido de componentes.
- **AI Teaching Assistant (RAG)**: Tutor inteligente dentro de cada lección que ayuda a los estudiantes utilizando el contexto de la lección actual y el historial del curso.
- **Persistent Grade Locking**: Bloqueo persistente de lecciones calificadas tras agotar los intentos, con retroalimentación personalizada generada por IA.
- **Color-Coded Progress Navigation**: Sistema visual de seguimiento de progreso mediante colores (Verde: Completado, Amarillo: En Proceso, Rojo: Repetible) tanto a nivel de lección como de módulo.
- **Adaptive Skill Analysis**: Motor de análisis de etiquetas que calcula la maestría de habilidades (Gramática, Vocabulario, etc.) para personalizar las recomendaciones de IA.
- **Efficient Docker Builds**: Imágenes de contenedor optimizadas para desarrollo rápido y despliegue ligero.
- **Unified Authentication Flow**: Flujo de inicio de sesión simplificado para estudiantes e instructores.
- **Course Monetization**: Integración con Mercado Pago para venta de cursos, con inscripciones automáticas y paneles de precios para instructores.
- **Student Notes**: Sistema de anotaciones personales por lección con auto-guardado inteligente (debounced).
- **Interactive Gradebook**: Libro de calificaciones avanzado con filtrado por cohortes, exportación masiva a CSV con desgloses por categoría y pertenencia a cohortes.
- **Bulk Operations**: Herramientas administrativas para inscripción masiva de usuarios vía email y comunicación segmentada.
- **Course Teams**: Soporte para múltiples instructores por curso con roles granulares (Instructor Principal, Instructor, Asistente).
- **Course Preview**: Capacidad de marcar lecciones específicas como previsualizables para usuarios no inscritos (freemium).
- **Student Progress Dashboard**: Visualización avanzada del avance del estudiante con gráficos de actividad diaria y predicción de fecha de finalización basada en el ritmo de aprendizaje.
- **Segmented Announcements**: Sistema de anuncios con capacidad de dirigirse a cohortes específicas y notificaciones filtradas.
- **Content Libraries**: Repositorio centralizado de bloques y lecciones reutilizables entre múltiples cursos.
- **Advanced Grading (Rubrics)**: Sistema de evaluación basado en rúbricas detalladas con indicadores de desempeño por criterio.
- **Learning Sequences**: Gestión de prerrequisitos entre lecciones con cumplimiento forzado en el LMS.
- **LTI 1.3 Tool Provider**: Interoperabilidad completa para lanzar cursos de OpenCCB desde LMS externos (Canvas, Moodle) de manera segura y estandarizada, con soporte para **Deep Linking** (Content Picking).
- **Global Asset Library**: Repositorio centralizado de medios para toda la organización, permitiendo la reutilización de archivos en múltiples cursos con gestión de cuotas e integridad de datos.
- **Predictive Analytics (Dropout Risk)**: Motor de IA que analiza el desempeño, actividad y compromiso social del estudiante para detectar riesgos de abandono de forma proactiva, con alertas accionables para instructores.
- **Live Learning (Videoconference)**: Integración nativa con Jitsi para clases virtuales síncronas, con programación desde Studio y acceso integrado en Experience.
- **Student Portfolio & Badges**: Sistema de reconocimiento con Open Badges y perfiles públicos profesionales para mostrar logros y progreso verificado.
- **Dynamic Mermaid Diagrams**: Generación automática de diagramas (flowcharts, mapas mentales, secuencias) a partir del contenido de cada lección usando IA, con editor visual integrado para instructores.

##  Requisitos del Sistema

OpenCCB es altamente escalable. A continuación se detallan los requisitos recomendados según la carga de usuarios concurrentes:

| Componente | **Pequeño (100 u.)** | **Mediano (500 u. concurrentes)** | **Grande (1000+ u.)** |
| :--- | :--- | :--- | :--- |
| **CPU** | 4 vCPUs | 8-12 vCPUs (AVX2/AVX-512) | 16-32+ vCPUs |
| **RAM** | 8 GB | 16-32 GB (Recomendado 24GB+) | 64 GB+ |
| **Almacenamiento** | 50 GB SSD | 250 GB+ NVMe (RAID-1) | 1 TB+ NVMe (S3 Backup) |
| **AI (Opcional)** | N/A (Solo CPU) | NVIDIA RTX 3060+ (12GB VRAM) | Multi-GPU (A100/H100) |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS / Debian | Cloud Native (K8s / Terraform) |

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

> [!TIP]
> **Acceso desde Móviles**: Gracias a la *Dynamic API Resolution*, puedes acceder desde tu celular conectado al mismo WiFi usando la IP de tu computadora (ej: `http://192.168.1.15:3000`). La interfaz se adaptará automáticamente.

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

#### 📦 Portabilidad de Cursos
Gestiona la movilidad de contenidos entre diferentes organizaciones utilizando exportaciones estandarizadas en JSON.

#### GET /courses/{id}/export
Genera un paquete completo del curso, incluyendo módulos, lecciones y configuraciones de calificación.

#### POST /courses/import
Crea un nuevo curso basado en un paquete de exportación proporcionado. El mapeo automático de dependencias asegura la integridad de los datos en la nueva organización.
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

#### 🧹 Mantenimiento de Base de Datos
Para resetear completamente el entorno de desarrollo y empezar desde cero:
```bash
# Borra las bases de datos openccb_cms/lms y las vuelve a migrar
./scripts/reset_db.sh
```

## 🔌 Manual del Desarrollador (API)

### 1. Autenticación y Cuentas
Gestión de registro, login y perfiles organizacionales.

#### POST /auth/register
Crea un nuevo usuario vinculado a la organización por defecto.

- **Cuerpo de la Petición ( AuthPayload ):**
  ```json
  {
    "email": "string",
    "password": "string",
    "full_name": "string",
    "role": "string (admin | instructor | student)"
  }
  ```

#### SSO (OpenID Connect)
OpenCCB soporta integración con proveedores de identidad (IdP) externos como Google, Okta y Azure AD.
- **Configuración**: Los administradores de la organización pueden configurar sus credenciales OIDC en el panel de configuración de Studio.
- **Autoprovisionamiento**: Los nuevos usuarios se crean automáticamente en la plataforma tras una autenticación exitosa.
#### LTI 1.3 e Interoperabilidad
OpenCCB actúa como un Tool Provider LTI 1.3 moderno, utilizando OIDC y JWKS para máxima seguridad.
- **JWKS Endpoint**: `/lti/jwks` expone las claves públicas para verificación de firmas.
- **Deep Linking**: Permite que instructores seleccionen cursos o lecciones específicas desde el LMS externo mediante una interfaz de Studio embebida.
- **Autoprovisionamiento**: Los usuarios lanzados vía LTI se crean automáticamente con los roles correspondientes.

```bash
# Registrar un nuevo administrador
curl -X POST "http://localhost:3001/auth/register" \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@empresa.com", "password": "pass", "full_name": "Admin Name"}'
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

#### POST /assets/upload
Sube un archivo multimedia o documento a la biblioteca global de la organización.

- **Lógica de Reutilización**: Los activos se asocian a la organización y pueden vincularse opcionalmente a un curso específico. El motor de búsqueda permite localizar rápidamente recursos existentes para evitar duplicados.
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

#### POST /audio/evaluate
Evalúa una respuesta oral del estudiante utilizando IA.

#### POST /lessons/{id}/generate-quiz
Genera un quiz basado en el contenido de la lección.
- **Cuerpo ( QuizAIRequest ):**
  ```json
  {
    "context": "focused on irregular verbs",
    "quiz_type": "true-false"
  }
  ```

#### POST /lessons/{id}/dependencies
Asigna una lección como prerrequisito de otra.
- **Cuerpo ( LessonDependencyRequest ):**
  ```json
  {
    "prerequisite_lesson_id": "uuid",
    "min_score_percentage": "number (opcional)"
  }
  ```

#### GET /lessons/{id}/dependencies
Lista los prerrequisitos de una lección específica.

#### DELETE /lessons/{lesson_id}/dependencies/{prereq_id}
Elimina un prerrequisito de una lección.

#### DELETE /courses/{id}
Elimina un curso y todos sus contenidos relacionados (módulos, lecciones, assets).

- **Procesamiento Asíncrono**: Despacha una tarea en segundo plano que utiliza Whisper para transcripción y Ollama para generar la traducción y el resumen inteligente.
- **Cuerpo de la Petición**: Vacío.

#### GET /lessons/{id}/feedback
Obtiene retroalimentación personalizada de IA basada en el desempeño del estudiante y el contexto de la lección.

- **Uso Crítico**: Se llama automáticamente cuando una lección calificada es bloqueada por intentos agotados.
- **Respuesta**: Un objeto JSON con la respuesta motivacional del tutor.

#### POST /lessons/{id}/chat
Interactúa con el tutor de IA específico para la lección.

- **Contexto Inteligente**: La IA tiene acceso a la transcripción del video, el contenido de los bloques interactivos y el historial de lecciones pasadas del curso.
- **Cuerpo ( ChatPayload ):**
  ```json
  {
    "message": "string"
  }
  ```

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

#### GET /courses/{id}/dropout-risks
Obtiene el reporte de riesgo de abandono para todos los estudiantes del curso.

- **Inteligencia Predictiva**: Calcula en tiempo real (o consulta caché) el nivel de riesgo (Critical, High, Medium, Low) basándose en promedios, frecuencia de actividad y participación en foros.
- **Seguridad**: Solo accesible para usuarios con rol `instructor` o `admin`.
- **Respuesta**: Array de objetos `DropoutRisk`.

---

### 5. Discussion Forums (Foros de Discusión)
Sistema completo de foros por curso con hilos, respuestas anidadas y moderación.

#### GET /courses/{id}/discussions
Lista todos los hilos de discusión de un curso.

- **Filtros Disponibles**:
  - `filter=all`: Todos los hilos (por defecto)
  - `filter=my_threads`: Solo hilos creados por el usuario
  - `filter=unanswered`: Hilos sin respuestas
  - `filter=resolved`: Hilos con respuestas marcadas como correctas
  - `lesson_id={uuid}`: Filtrar por lección específica
- **Paginación**: `page=1` (50 hilos por página)
- **Respuesta**: Array de `ThreadWithAuthor` con información del autor y estadísticas agregadas.

```bash
# Listar hilos sin responder
curl "http://localhost:3002/courses/{course_id}/discussions?filter=unanswered" \
     -H "Authorization: Bearer $TOKEN"
```

#### POST /courses/{id}/discussions
Crea un nuevo hilo de discusión.

- **Auto-suscripción**: El autor se suscribe automáticamente para recibir notificaciones.
- **Cuerpo ( CreateThreadPayload ):**
  ```json
  {
    "title": "string",
    "content": "string",
    "lesson_id": "uuid (opcional)"
  }
  ```

#### GET /discussions/{id}
Obtiene un hilo completo con todas sus respuestas anidadas.

- **Contador de Vistas**: Incrementa automáticamente el `view_count`.
- **Árbol de Respuestas**: Las respuestas se devuelven en estructura jerárquica con anidación infinita.
- **Respuesta**: Objeto con `thread` y `posts` (árbol de respuestas).

#### POST /discussions/{id}/posts
Crea una respuesta en un hilo.

- **Respuestas Anidadas**: Usa `parent_post_id` para responder a un post específico.
- **Validación**: No permite responder si el hilo está bloqueado.
- **Cuerpo ( CreatePostPayload ):**
  ```json
  {
    "content": "string",
    "parent_post_id": "uuid (opcional, null para respuesta directa al hilo)"
  }
  ```

#### POST /posts/{id}/vote
Vota por una respuesta (upvote/downvote).

- **Lógica**: Un usuario solo puede votar una vez por post. Cambiar el voto actualiza el registro existente.
- **Recalculo Automático**: El contador de upvotes se actualiza inmediatamente.
- **Cuerpo ( VotePayload ):**
  ```json
  {
    "vote_type": "upvote" // o "downvote"
  }
  ```

#### POST /posts/{id}/endorse (Solo Instructores)
Marca una respuesta como correcta/aprobada.

- **Indicador Visual**: Las respuestas endorsadas aparecen primero en la lista.
- **Permiso**: Solo instructores y administradores pueden endorsar.

#### POST /discussions/{id}/pin (Solo Instructores)
Fija/desfija un hilo en la parte superior de la lista.

- **Uso**: Para destacar anuncios importantes o FAQs.
- **Permiso**: Solo instructores y administradores.

#### POST /discussions/{id}/lock (Solo Instructores)
Bloquea/desbloquea un hilo para prevenir nuevas respuestas.

- **Uso**: Para cerrar discusiones resueltas o inapropiadas.
- **Permiso**: Solo instructores y administradores.

#### POST /discussions/{id}/subscribe
Suscribe al usuario a las notificaciones del hilo.

- **Notificaciones**: El usuario recibirá alertas cuando haya nuevas respuestas.

#### POST /discussions/{id}/unsubscribe
Cancela la suscripción del usuario al hilo.

```bash
# Crear hilo
curl -X POST "http://localhost:3002/courses/{course_id}/discussions" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"title": "Pregunta sobre Módulo 2", "content": "No entiendo la sección de..."}'

# Responder a hilo
curl -X POST "http://localhost:3002/discussions/{thread_id}/posts" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"content": "Aquí está mi respuesta..."}'

# Votar respuesta
curl -X POST "http://localhost:3002/posts/{post_id}/vote" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"vote_type": "upvote"}'
```

---

### 5. Anuncios del Curso (Announcements)

| Acción | Método | Endpoint | Descripción |
|--------|--------|----------|-------------|
| Listar | GET | `/courses/{id}/announcements` | Obtiene todos los anuncios de un curso |
| Crear | POST | `/courses/{id}/announcements` | Crea un nuevo anuncio (Solo Instructor/Admin) |
| Actualizar | PUT | `/announcements/{id}` | Actualiza un anuncio (Solo Instructor/Admin) |
| Eliminar | DELETE| `/announcements/{id}` | Elimina un anuncio (Solo Instructor/Admin) |

#### Ejemplo de Creación de Anuncio
```bash
curl -X POST http://localhost:3002/courses/{course_id}/announcements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bienvenida al curso",
    "content": "Bienvenidos a todos a este emocionante curso.",
    "is_pinned": true
  }'
```

---

### 6. Estructura Single-Tenant
OpenCCB está diseñado como un módulo premium single-tenant. Todas las operaciones se realizan bajo una única organización preconfigurada.

#### Organización por Defecto
- **ID de Organización**: `00000000-0000-0000-0000-000000000001`
- El sistema utiliza este ID de forma transparente para todas las consultas y recursos.

#### Branding Unificado
- La personalización de marca se aplica globalmente a través del panel de Ajustes en Studio, afectando tanto a la interfaz administrativa como al portal del estudiante.

---

## 🏆 Componentes UI Premium
- **Advanced Grading (Rubrics)**: Sistema completo de evaluación por rúbricas configurables.
- **Content Libraries**: Repositorio reutilizable de bloques y lecciones para máxima eficiencia.
- **Course Portability**: Sistema de importación/exportación basado en JSON para movilidad de contenidos.
- **AI Course Wizard**: Generación instantánea de currículos a partir de prompts.
- **Global Admin Console**: Control centralizado para organizaciones, usuarios y registros de auditoría.
- **Experience Player**: Interfaz de aprendizaje de alto rendimiento y accesible con diseño glassmorphism.
- **Organization Selector**: Combobox con búsqueda para gestionar grandes listas de inquilinos.
- **Engagement Heatmaps**: Gráficos dinámicos que muestran la retención en videos.
- **Notification Center**: Alertas en tiempo real para fechas límite y logros.
- **Custom Report Builder**: Reportes profesionales con exportación a CSV en un clic.
- **Glassmorphism Design**: Estética consistente en los portales Studio y Experience.
- **Global Localization**: Soporte nativo para Inglés, Español y Portugués.
- **PDF Integrated Viewer**: Lectura de documentos académicos sin salir de la plataforma.
- **Interactive Video Markers**: Preguntas que pausan el video integradas en las lecciones.
- **White-Label Branding**: Nombre de plataforma, logo, favicon y temas de color personalizados por organización.
- **Dynamic LAN Connectivity**: Detección automática de la IP del servidor para acceso fluido multi-dispositivo.
- **Mobile-First Navigation**: Menús laterales responsivos y diseños adaptativos para todas las pantallas.
- **Context-Aware AI Tutor**: Asistente inteligente con RAG que recuerda lecciones pasadas y protege respuestas.
- **Personalized AI Feedback**: Retroalimentación motivacional e instruccional generada únicamente para cada estudiante.
- **Color-Coded Navigation**: Indicadores visuales de progreso en tiempo real (Verde/Amarillo/Rojo).
- **Discussion Forums**: Sistema completo de foros con hilos, votos, moderación y suscripciones.
- **Course Announcements**: Sistema de comunicación instructor-estudiante con notificaciones automáticas.
- **Split Authentication**: Flujos de inicio de sesión separados para usuarios personales y empresas con soporte SSO.
- **Mercado Pago Monetization**: Pasarela de pagos integrada con desbloqueo automático de cursos.
- **Student Notes Panel**: Anotaciones personales con interfaz glassmorphism y autoguardado inteligente.
- **Cohort Management**: Sistema de gestión de grupos con seguimiento de progreso por cohorte.
- **Advanced Gradebook**: Seguimiento del desempeño estudiantil con analíticas y filtrado avanzado.
- **Learning Sequences UI**: Interfaz visual para gestionar dependencias y visualización de bloqueos con iconos de candado.
- **Student Progress Dashboard**: Panel de control con gráficos interactivos (Recharts) que muestran la actividad de aprendizaje y estiman el tiempo restante del curso.
- **Course Teams UI**: Panel de gestión para añadir y configurar roles de instructores secundarios y asistentes.
- **Course Preview Badges**: Indicadores visuales y lógica de acceso para lecciones accesibles sin suscripción.
- **Global Asset Manager**: Interfaz avanzada para la administración masiva de archivos con previsualización inteligente y filtros por curso o tipo.
- **Premium Course Summaries**: Presentación de cursos con diseño de alta fidelidad y desgloses de objetivos de aprendizaje.


---

## 📊 Estado de Funcionalidades

OpenCCB es una plataforma madura con la mayoría de sus funcionalidades core implementadas y operativas. Esta sección documenta transparentemente el estado actual de las características principales para que desarrolladores y administradores puedan planificar su uso.

### ✅ Completamente Implementado

| Categoría | Funcionalidades |
|-----------|-----------------|
| **Gestión de Cursos** | CRUD completo, AI generation, export/import JSON, templates, marketing metadata, teams, preview tokens |
| **Contenidos** | 16 tipos de bloques (video, quiz, hotspot, memory, mermaid, code lab, etc.) |
| **IA Integrada** | Transcripción, traducción, resúmenes, quiz generation, tutor RAG, audio evaluation, diagramas |
| **Question Bank** | CRUD completo, semantic search (PGVector), duplicate detection, AI generation con 4 skills |
| **Calificaciones** | Rubrics, weighted categories, drop-lowest policy, gradebook con cohortes, export CSV |
| **Foros** | Hilos, respuestas anidadas, votos, endorsements, moderación, suscripciones |
| **Gamificación** | XP, niveles, badges, leaderboards, Open Badges |
| **Monetización** | Mercado Pago integration, pricing, webhooks, auto-enrollment |
| **LTI 1.3** | Tool Provider con Deep Linking, JWKS, autoprovisionamiento |
| **Live Learning** | Integración Jitsi, scheduling desde Studio |
| **Analíticas** | Dashboard instructores, heatmaps, dropout risk prediction, advanced analytics |
| **Single-Tenant** | White-label branding, SSO/OIDC, exercise settings |
| **Responsive UI** | Mobile-first, dynamic API resolution, fluid typography |

### ⚠️ En Progreso / Pendiente de Finalización

| Funcionalidad | Estado Actual | Impacto |
|---------------|---------------|---------|
| **Generación de Certificados** | Schema de BD existe, falta implementación de generación y UI | Los estudiantes que completan cursos no reciben certificado |
| **Tracking de Progreso** | Hardcodeado a 0% en `my-learning/page.tsx` | Los estudiantes no ven su progreso real en el catálogo |
| **Notificaciones de Foros** | Suscripciones existen pero no se envían alertas | Usuarios suscritos no reciben notificaciones de respuestas |
| **Importación Excel (Question Bank)** | Código comentado con `unimplemented!()` | Solo se puede importar manualmente o vía AI |
| **Rate Limiting** | Deshabilitado por compatibilidad con middleware | APIs sin protección contra abuso en producción |

### 📋 Planned (Ver roadmap.md para detalles)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Email/SMTP Integration** | Notificaciones por email, password reset, welcome emails |
| **Búsqueda Global** | Search unificado en cursos, lecciones, contenidos |
| **SCORM/xAPI Support** | Importación de paquetes SCORM, tracking xAPI |
| **Accesibilidad WCAG 2.1** | Auditoría y correcciones de contraste, navegación por teclado |
| **PWA y Offline** | Service workers, descarga de lecciones, sync offline |
| **Integraciones Empresariales** | HRIS (Workday, SAP), LDAP/Active Directory, webhooks salientes |

> [!NOTE]
> Si encuentras alguna funcionalidad marcada como "En Progreso" que necesitas urgentemente, por favor abre un issue en el repositorio o contribuye con un PR. ¡Las contribuciones son bienvenidas!

---

## 📚 Documentación

### Guías Principales

| Archivo | Descripción |
|---------|-------------|
| **README.md** | Este archivo - Visión general y características |
| **roadmap.md** | Hoja de ruta completa del proyecto (Fases 1-21) |
| **ManualDeConfiguracion.md** | Guía completa de instalación, configuración y troubleshooting |

### Comandos Rápidos

```bash
# Instalación estándar (detecta dev/prod automáticamente)
./install.sh

# Instalación rápida (omite chequeos)
./install.sh --fast

# Despliegue a producción (sincroniza con servidor remoto)
./install.sh --deploy

# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Health checks
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### URLs de Acceso

| Servicio | Puerto | URL |
|----------|--------|-----|
| **Studio (CMS)** | 3000 | http://localhost:3000 |
| **Experience (LMS)** | 3003 | http://localhost:3003 |
| **CMS API** | 3001 | http://localhost:3001 |
| **LMS API** | 3002 | http://localhost:3002 |

### Credenciales por Defecto

Después de ejecutar `./install.sh`:

- **Email**: `admin@norteamericano.cl`
- **Contraseña**: `Admin123!`

---
## �️ Próximos Pasos (Roadmap 2024-2025)

OpenCCB evoluciona constantemente. Estos son los pilares de nuestro desarrollo futuro:

### 📱 Movilidad Nativa
- **Apps Android/iOS**: Aplicaciones nativas desarrolladas con Flutter para aprendizaje offline y notificaciones push críticas.
- **Offline Sync**: Capacidad de descargar lecciones y sincronizar progreso al recuperar conexión.

### 🧠 Inteligencia Artificial Avanzada
- **AI Video Generation (v1)**: ✅ Generación de clips a partir de prompts y guiones de lecciones.
- **AI Proctoring**: Monitoreo basado en visión artificial para exámenes de alta integridad, 100% privado y local.
- **Multimodal Tutoring**: El tutor de IA podrá analizar imágenes y videos subidos por el alumno para dar feedback.
- **Automated Grading for Open Questions**: Evaluación masiva de ensayos y respuestas abiertas con rúbricas personalizadas.

### 🔌 Interoperabilidad y Estándares
- **SCORM 1.2 / 2004 Support**: Player nativo para contenidos legados de la industria.
- **Advanced xAPI (Tin Can)**: Recolección detallada de experiencias de aprendizaje granulares.
- **Microsoft Teams / Slack Integration**: Recibe anuncios y tareas directamente en tus herramientas de trabajo.

### 🏗️ Infraestructura y Escalabilidad
- **Multi-Cloud Terraform Provider**: Despliegues automatizados en AWS, GCP y Azure.
- **Edge Content Delivery**: Caché de videos y assets en el borde para mínima latencia global.

### 🎮 Gamificación y Comunidad
- **Real-time Leaderboards**: Tablas de clasificación en vivo por cohorte y organización.
- **Social Learning Groups**: Grupos de estudio auto-organizados con chats integrados.

---

## �📄 Licencia
Este proyecto es código abierto y está disponible bajo los términos de la licencia especificada en el repositorio.