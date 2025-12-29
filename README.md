# OpenCCB: Open Comprehensive Course Backbone

OpenCCB es una infraestructura de código abierto para plataformas de gestión de aprendizaje y contenido (LMS/CMS), construida con rendimiento, seguridad y escalabilidad en mente.

## 🚀 Estado del Proyecto

El sistema se encuentra en una fase avanzada (**Phase 6 en progreso**), ofreciendo una infraestructura multi-inquilino de alto rendimiento, gestión de marcas por organización (branding), autenticación segura y análisis detallado de datos.

Consulta el archivo [ROADMAP.md](./roadmap.md) para ver el desglose detallado de funcionalidades.

## 🛠 Stack Tecnológico

- **Core**: Rust (Edition 2024)
- **API Framework**: Axum
- **Base de Datos**: PostgreSQL (con `sqlx`)
- **Autenticación**: JWT + RBAC (Roles: Admin, Instructor, Student)
- **Infraestructura**: Docker & Docker Compose

## 🔌 API Reference (CMS Service)

El servicio CMS expone una API RESTful en el puerto `3001`. A continuación se detallan los contratos de los endpoints principales.

### 🔐 Autenticación

#### Registrar Usuario
- **URL**: `POST /auth/register`
- **Descripción**: Crea una nueva cuenta de usuario.
- **Body (JSON)**:
  ```json
  {
    "email": "string (email format)",
    "password": "string (min 8 chars)",
    "role": "string ('instructor' | 'student')",
    "organization_name": "string (optional)"
  }
  ```

#### Iniciar Sesión
- **URL**: `POST /auth/login`
- **Descripción**: Autentica un usuario y devuelve un token JWT.
- **Body (JSON)**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```

### 📚 Gestión de Cursos

#### Listar Cursos
- **URL**: `GET /courses`
- **Descripción**: Obtiene la lista de cursos visibles para el usuario.

#### Crear Curso
- **URL**: `POST /courses`
- **Descripción**: Inicializa un nuevo curso.
- **Body (JSON)**:
  ```json
  {
    "title": "string",
    "description": "string (optional)",
    "passing_percentage": "integer (0-100, default: 70)"
  }
  ```

#### Actualizar Curso
- **URL**: `PUT /courses/{id}`
- **Descripción**: Modifica metadatos del curso.
- **Body (JSON)**:
  ```json
  {
    "title": "string",
    "description": "string",
    "passing_percentage": "integer",
    "certificate_template": "string (HTML content)"
  }
  ```

#### Publicar Curso
- **URL**: `POST /courses/{id}/publish`
- **Descripción**: Sincroniza el curso y su contenido con el servicio LMS.
- **Body**: `{}` (Vacío)

### 📦 Contenido (Módulos y Lecciones)

#### Crear Módulo
- **URL**: `POST /modules`
- **Body (JSON)**:
  ```json
  {
    "course_id": "uuid",
    "title": "string",
    "order_index": "integer"
  }
  ```

#### Crear Lección
- **URL**: `POST /lessons`
- **Body (JSON)**:
  ```json
  {
    "module_id": "uuid",
    "title": "string",
    "content_type": "string ('video' | 'article' | 'quiz')",
    "max_attempts": "integer (optional, null = unlimited)",
    "allow_retry": "boolean (default: true)"
  }
  ```

#### Actualizar Lección
- **URL**: `PUT /lessons/{id}`
- **Body (JSON)**:
  ```json
  {
    "title": "string",
    "content_blocks": "array (JSON objects)",
    "max_attempts": "integer",
    "allow_retry": "boolean"
  }
  ```

#### Transcripción AI (Simulado)
- **URL**: `POST /lessons/{id}/transcribe`
- **Descripción**: Inicia el proceso de generación de subtítulos/resumen.
- **Body**: `{}` (Vacío)

### 📂 Sistema & Assets

#### Subir Archivo
- **URL**: `POST /assets/upload`
- **Tipo**: `multipart/form-data`
- **Campo**: `file` (Binary)

#### Logs de Auditoría
- **URL**: `GET /audit-logs`
- **Query Params**: `?page=1&limit=50`

### 🏢 Organizaciones & Branding

#### Listar Organizaciones (Admin)
- **URL**: `GET /organizations`
- **Descripción**: Obtiene la lista completa de inquilinos del sistema.

#### Configurar Branding
- **URL**: `PUT /organizations/{id}/branding`
- **Descripción**: Actualiza los colores primario y secundario de la organización.
- **Body (JSON)**:
  ```json
  {
    "primary_color": "#hex",
    "secondary_color": "#hex"
  }
  ```

#### Subir Logo de Organización
- **URL**: `POST /organizations/{id}/logo`
- **Tipo**: `multipart/form-data`
- **Campo**: `file` (Binary)

#### Obtener Branding Público
- **URL**: `GET /organizations/{id}/branding`
- **Descripción**: Recupera la identidad visual (logo y colores) de una organización.

### 👥 Gestión de Usuarios (Admin)

#### Listar Usuarios
- **URL**: `GET /users`
- **Descripción**: Obtiene todos los usuarios registrados en el sistema.

#### Actualizar Usuario
- **URL**: `PUT /users/{id}`
- **Descripción**: Permite cambiar el rol o la organización de un usuario.
- **Body (JSON)**:
  ```json
  {
    "role": "string",
    "organization_id": "uuid"
  }
  ```

## 📦 Configuración y Ejecución

1. **Variables de Entorno**:
   Asegúrate de tener configurado `DATABASE_URL` en tu archivo `.env`.

2. **Base de Datos**:
   El sistema utiliza migraciones automáticas de `sqlx` al iniciar.

3. **Ejecutar Servicio**:
   ```bash
   cargo run --bin cms-service
   ```
   O mediante Docker:
   ```bash
   docker-compose up --build
   ```