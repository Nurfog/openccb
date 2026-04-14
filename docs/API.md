# Referencia de API de OpenCCB

Esta guía proporciona detalles técnicos sobre los endpoints disponibles en OpenCCB para desarrolladores e integradores.

## 1. Autenticación y Cuentas
Gestión de registro, login y perfiles organizacionales.

### POST /auth/register
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

### SSO (OpenID Connect)
OpenCCB soporta integración con proveedores de identidad (IdP) externos como Google, Okta y Azure AD.
- **Configuración**: Los administradores de la organización pueden configurar sus credenciales OIDC en el panel de configuración de Studio.
- **Autoprovisionamiento**: Los nuevos usuarios se crean automáticamente en la plataforma tras una autenticación exitosa.

### LTI 1.3 e Interoperabilidad
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

## 2. Gestión de Contenidos (CMS)
Herramientas para instructores y administradores.

### POST /courses
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

### POST /courses/generate
Utiliza IA para generar la estructura completa de un curso basado en un prompt.

### GET /courses/{id}/export
Exporta un curso completo y su contenido a formato JSON para portabilidad.

### POST /courses/import
Importa un curso a partir de un archivo JSON generado previamente.

### POST /lessons
Agrega contenido multimedia o evaluaciones a un módulo.

- **Configuración Graduable**: Si `is_graded` es true, los puntos sumarán al XP del estudiante en el LMS.
- **Nuevos Tipos Gamificados**:
    - `hotspot`: Identificación visual sobre imágenes.
    - `memory-match`: Juego de memoria con pares conceptuales.
    - `video-marker`: Preguntas interactivas en timestamps específicos del video.

### POST /assets/upload
Sube un archivo multimedia o documento a la biblioteca global de la organización.

---

## 3. Experiencia de Aprendizaje (LMS)
Endpoints para estudiantes y seguimiento de progreso.

### POST /enroll
Inscribe al usuario en un curso.

### POST /grades
Registra el puntaje de una lección y actualiza la gamificación.

### GET /notifications
Obtiene las notificaciones pendientes del usuario.

---

## 4. IA y Analíticas Avanzadas
Funcionalidades inteligentes 100% locales y gratuitas.

### POST /lessons/{id}/transcribe
Inicia el proceso de transcripción y traducción.

### POST /audio/evaluate
Evalúa una respuesta oral del estudiante utilizando IA.

### POST /lessons/{id}/generate-quiz
Genera un quiz basado en el contenido de la lección.

### POST /chat (Streaming)
Conversación en tiempo real con la base de conocimientos (RAG).

### GET /lessons/{id}/heatmap
Devuelve los puntos de concentración de visualización para una lección.

---

## 5. Foros de Discusión (Discussion Forums)
Sistema completo de foros por curso con hilos, respuestas anidadas y moderación.

### GET /courses/{id}/discussions
Lista todos los hilos de discusión de un curso.

### POST /courses/{id}/discussions
Crea un nuevo hilo de discusión.

### POST /posts/{id}/vote
Vota por una respuesta (upvote/downvote).

---

## 6. Anuncios del Curso (Announcements)

| Acción | Método | Endpoint |
|--------|--------|----------|
| Listar | GET | `/courses/{id}/announcements` |
| Crear | POST | `/courses/{id}/announcements` |
| Eliminar | DELETE| `/announcements/{id}` |
