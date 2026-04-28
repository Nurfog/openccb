# OpenCCB: Hoja de Ruta (Roadmap) del Proyecto

## Fase 1: Cimientos ✅
- [x] Configuración del Workspace de Rust (Edición 2024)
- [x] Estructura de Microservicios (CMS y LMS)
- [x] Infraestructura Multi-Base de Datos
- [x] Inicialización del Frontend (Studio y Experience)
- [x] Dockerización y Script de instalación unificado

## Fase 2: Funcionalidades Core del CMS ✅
- [x] Editor de Estructura de Cursos
- [x] Sistema de Carga de Archivos
- [x] Constructor de Actividades Interactivas
- [x] Tipos de evaluación avanzada (Secuenciación, Emparejamiento, etc.)

## Fase 3: Autenticación y Seguridad ✅
- [x] Autenticación basada en JWT
- [x] Control de Acceso Basado en Roles (RBAC)
- [x] Registro e Interfaz de Auditoría

## Fase 4: Experiencia LMS y Calificaciones ✅
- [x] Portal del Estudiante (Experience)
- [x] Sistema de Calificación Holístico con pesos
- [x] Políticas de Evaluación e Intentos
- [x] Umbrales de Aprobación Dinámicos
- [x] Generación de Certificados básicos

## Fase 5: Analíticas e Insights ✅
- [x] Dashboard de Analíticas para Instructores
- [x] Dashboard de Progreso del Estudiante

## Fase 6: Refactorización a Single-Tenant ✅
- [x] Reposicionamiento como módulo premium
- [x] Personalización de Marca (Branding Premium)
- [x] Interfaz de Usuario e Inicio de Sesión Simplificados

## Fase 7: Compromiso y Social ✅
- [x] Analíticas de Vanguardia (Cohortes, Retención, Heatmaps)
- [x] Integración de IA (Resúmenes, Quices, Tutor RAG)
- [x] Rutas de Aprendizaje Personalizadas
- [x] Gamificación Base (XP, Niveles, Leaderboards)

## Fase 8: Funcionalidades Enterprise ✅
- [x] Perfil de Usuario y Ciclo de Vida
- [x] Reportes Avanzados exportables a CSV
- [x] SSO (Google, Okta, Azure AD)
- [x] LTI 1.3 Tool Provider (Interoperabilidad)

## Fase 9: Portabilidad de Cursos ✅
- [x] Esquema JSON Universal y Portabilidad de contenidos

## Fase 10: Consola de Administración Global ✅
- [x] Panel de control para organizaciones y auditoría universal

## Fase 11 - 14: IA y Gamificación Avanzada ✅
- [x] Quices de Código y Puntos Calientes (Hotspots)
- [x] Evaluaciones por Audio con IA
- [x] Generador de Cursos "Mágico"
- [x] Juegos para niños e Internacionalización (EN, ES, PT)

## Fase 15 - 19: UI Adaptativa y Monetización ✅
- [x] Dynamic API Resolution (Acceso LAN)
- [x] Optimización móvil completa
- [x] Monetización con Mercado Pago
- [x] Analíticas Predictivas (Riesgo de Abandono)
- [x] Integración de Videoconferencia (Jitsi)
- [x] Landing Pages para Marketing de Cursos

## Fase 20 - 21: IA Generativa y Búsqueda Semántica ✅
- [x] Diagramas Mermaid automáticos
- [x] Búsqueda Semántica con PGVector (Representación de 768 dim)
- [x] Detección de duplicados y RAG mejorado

---

## Fase 22: Estabilidad y Funcionalidades Pendientes 🛠️ (En Ejecución)
- [x] **Generación de Certificados Premium**: Mejorar UI de configuración de templates en Studio.
- [x] **Tracking de Progreso Atómico**: Reemplazar hardcodes por cálculo real de completitud.
- [x] **Notificaciones de Foros**: Implementar despacho de alertas vía SMTP.
- [x] **Importación Masiva (Excel)**: Finalizar soporte para Question Bank.

## Fase 23 - 27: Infraestructura Crítica ✅ (Completado)
- [x] **Integración SMTP**: Password reset, notificaciones transaccionales (inscripción, completitud) y emails de marketing.
- [x] **Búsqueda Global Unificada**: Endpoint `/search` en LMS (cursos, lecciones, foros, anuncios) con full-text e índices GIN. Barra de búsqueda en navbar del Experience.
- [x] **Soporte SCORM/xAPI**: Player nativo (iframe) para lecciones `content_type=scorm|xapi` y bloque `scorm`, con tracking de statements xAPI en LMS.
- [x] **Accesibilidad WCAG 2.1**: Auditoría y ajustes de contraste/navegación.
- [x] **PWA y Soporte Offline**: Service workers para aprendizaje sin conexión. *(MVP base implementado: registro SW, caché estático, navegación network-first con fallback offline y API GET network-first; UX añadida: prompt de instalación PWA y banner online/offline; cola offline para progreso (grades/interactions/xAPI) con flush automático al reconectar; panel visible de sync, deduplicación por huella de mutación y pruebas E2E offline→online para grades/interactions; validado en producción con endpoints `/manifest.webmanifest`, `/sw.js` y `/offline.html` en HTTP 200).* 

---

## 🚀 Fases Estratégicas (Nuevas)

### Fase 32: IA de Moderación y Ética 🛡️
- [x] **Auditoría de IA**: Sistema de validación para prevenir "halucinaciones" en el Tutor RAG. *(MVP backend + UI Studio: endpoints protegidos para listar logs de chat con señales de riesgo y marcar revisión humana en `ai_usage_logs.request_metadata`, con panel operativo en Admin. Señales endurecidas a 10 reglas con score ponderado + endpoint `GET /ai/audit/metrics` con distribución de scores y ranking de señales.)*
- [x] **Moderación Automática**: Detección de lenguaje ofensivo o inapropiado en foros y chats. *(MVP backend por diccionario en creación de hilos/respuestas de foro y mensajes de chat tutor/role-play).* 
- [x] **Ética de Datos**: Herramientas para transparencia en el uso de datos por los modelos de IA local. *(MVP backend + UI Studio: endpoint protegido `/ai/data-ethics/summary` con métricas de uso, eventos recientes y campos almacenados; panel Admin en `/admin/data-ethics`.)*

### Fase 33: Aprendizaje Colaborativo Síncrono 🤝
- [x] **Pizarras Compartidas**: Espacio de dibujo colaborativo integrado en lecciones. *(MVP completo: backend REST + UI Experience con polling, autosave debounce 1.5s, control de conflictos optimista `revision`/`409` y panel de resolución con diff local vs remoto.)*
- [ ] **Edición Multiusuario**: Soporte para documentos compartidos en tiempo real (tipo Google Docs).
- [ ] **Salas de Estudio**: Grupos efímeros para resolución de dudas grupales por video.

### Fase 34: Análisis Pedagógico Profundo 📊
- [x] **Métricas de Calidad**: Análisis automático de la efectividad de las lecciones (completion_rate, failure_rate, abandonment, avg_attempts). *(Backend `GET /courses/{id}/pedagogical/quality-metrics` + UI Studio con barras proporcionales.)*
- [x] **Índice de Discriminación**: Estadísticas sobre qué preguntas de quiz discriminan mejor el conocimiento. *(Backend `GET /courses/{id}/pedagogical/discrimination-index` con agrupación por `metadata.block_scores` + clasificación Excelente/Buena/Aceptable/Revisar.)*
- [x] **Sugerencias Curriculares**: Reglas automáticas (5 tipos) recomendando cambios en la estructura del curso basada en rendimiento real. *(Backend `GET /courses/{id}/pedagogical/suggestions` + panel Studio con severidad alta/media/info/positivo.)*

### Fase 35: Ecosistema de Plugins 🔌
- [x] **Arquitectura Modular**: Tabla `org_plugins` con CRUD completo en `cms-service` (`GET /plugins`, `POST /plugins`, `PUT /plugins/{id}`, `DELETE /plugins/{id}`). Validación HTTPS obligatoria.
- [x] **Soporte para Web Components**: Bloque `plugin` en Experience carga el componente en `<iframe sandbox>` seguro con postMessage para config; sin acceso al DOM de OpenCCB.
- [x] **OpenCCB Market**: Galería en Studio (`/admin/plugins`) con toggle habilitado/deshabilitado, registro de nuevos plugins y tarjetas con estado visual.

### Fase 36: LTI 1.3 Tool Consumer 🔗
- [x] **Consumo de herramientas externas**: MVP implementado con `lti_external_tools` por curso, gestión en Studio (`/courses/[id]/lti-tools`), selector visual en editor de lecciones y bloque embebido `lti-tool` en Experience vía iframe sandbox.
- [x] **Delegación de Calificaciones**: MVP implementado con endpoint público `POST /lti/tools/{tool_id}/grade-passback`, firma HMAC-SHA256 (`x-openccb-lti-signature` + `x-openccb-lti-timestamp`), registro de eventos y sincronización a `user_grades`.

---

**Estado Actual**: Plataforma madura con IA generativa integrada, arquitectura Premium Single-Tenant, búsqueda semántica y monetización operativa.

### Fase 37: Tiempo Real y Seguridad Operacional ⚡
- [x] **SSE para Pizarras Colaborativas**: Reemplazado polling de 5s por `EventSource` en `CollaborativeWhiteboard.tsx`. Endpoint `GET /lessons/{id}/collaborative-canvas/stream` en `lms-service` usa canal `tokio::sync::mpsc` + `ReceiverStream`; el servidor consulta la DB cada 2s y emite eventos SSE solo cuando cambia la `revision`. El cliente cierra la conexión al desmontar el componente.
- [x] **Rotación de Secretos LTI**: Endpoint `POST /courses/{id}/lti-tools/{tool_id}/rotate-secret` genera un nuevo secreto alfanumérico de 32 chars, actualiza la DB y lo retorna una sola vez. UI en Studio (`/courses/[id]/lti-tools`) con botón 🔑 por herramienta, modal de confirmación de riesgo, y panel de copia-única del nuevo secreto con botón clipboard.

### Fase 38: Salas de Estudio con BigBlueButton 🎥
- [x] **Tabla `study_rooms`**: migración con campos `status` (pending/active/ended), `bbb_meeting_id`, `attendee_pw`, `moderator_pw`, `max_participants`, `scheduled_at`, `started_at`, `ended_at`.
- [x] **Integración BBB**: `handlers_study_rooms.rs` construye URLs BBB con checksum SHA256 (`action + params + BBB_SECRET`). Endpoints: `GET /courses/{id}/study-rooms`, `POST /courses/{id}/study-rooms`, `POST .../join`, `POST .../end`, `DELETE .../`. Variables de entorno: `BBB_URL` y `BBB_SECRET`.
- [x] **Studio**: página `/courses/[id]/study-rooms` — crear sala, lista con estado, botones Iniciar/Unirse (BBB en nueva pestaña)/Finalizar/Eliminar, instrucciones de configuración integradas. Tab "Salas de Estudio" en `CourseEditorLayout`.
- [x] **Experience**: página `/courses/[id]/study-rooms` con lista de salas activas/programadas y botón "Unirse". Acceso directo desde la página del curso como tarjeta de navegación.

### Fase 39: Grabaciones BBB + OAuth2 AGS ✅
- [x] **Grabaciones BBB**: `GET /courses/{id}/study-rooms/{room_id}/recordings` — llama a `getRecordings` de la API BBB y parsea XML de respuesta. Struct `BbbRecording` con `record_id`, `name`, `state`, `start_time`, `end_time`, `participants`, `playback_url`, `duration_minutes`.
- [x] **Studio study-rooms**: botón "Grabaciones" en salas finalizadas — panel expandible con lista de grabaciones + links de reproducción.
- [x] **Experience study-rooms**: sección de grabaciones en salas finalizadas con botón toggle y lista de grabaciones con links.
- [x] **OAuth2 AGS** (`handlers_lti_consumer.rs`): `POST /lti/tools/{tool_id}/ags-score` — token caching en tabla `lti_ags_tokens`, client_credentials grant, POST de scores al `ags_lineitem_url` del LMS externo. Modo dual: HMAC legacy sigue funcionando.
- [x] **Migración AGS**: ALTER TABLE `lti_external_tools` agrega campos `ags_client_id`, `ags_client_secret`, `ags_token_url`, `ags_lineitem_url`. CREATE TABLE `lti_ags_tokens`.
- [x] **Studio lti-tools**: sección AGS colapsable en el formulario de creación — 4 campos opcionales (client_id, client_secret, token_url, lineitem_url).
- [x] **api.ts**: Interface `BbbRecording`, `getStudyRoomRecordings()` en Studio y Experience. Campos AGS en `LtiExternalTool`, `CreateLtiExternalToolPayload`, `UpdateLtiExternalToolPayload`.

### Fase 40: Edición Colaborativa de Documentos 📝 ✅
- [x] **Tabla `lesson_collaborative_docs`**: migración con campos `content TEXT`, `revision BIGINT`, `last_modified_by UUID`. Índice único por `(lesson_id, organization_id)`.
- [x] **Backend**: 3 endpoints — `GET /lessons/{id}/collaborative-doc`, `PUT /lessons/{id}/collaborative-doc` (concurrencia optimista por `revision`), `GET /lessons/{id}/collaborative-doc/stream` (SSE, polling 2s). Respuesta 409 con `server_content`/`server_revision` en conflicto.
- [x] **Experience — CollaborativeDocEditor**: componente SSE con autosave debounce 1.5s, toolbar Markdown básico (negrita, cursiva, H1/H2, listas), resolución de conflictos con diff visual (conservar la mía / usar la del servidor). Solo actualiza desde SSE si no hay cambios locales pendientes.
- [x] **Experience — Lesson Player**: sección "Documento Colaborativo" integrada en la página de la lección, después de la pizarra colaborativa.
- [x] **Studio**: página `/courses/[id]/lessons/[lessonId]/collaborative-doc` con metadatos (revisión, palabras, caracteres, última edición) + vista previa + botón "Borrar documento". Link desde el breadcrumb del editor de lección.
- [x] **api.ts Studio + Experience**: funciones `getLessonCollaborativeDoc`, `updateLessonCollaborativeDoc`, interfaces `CollaborativeDoc`, `UpdateCollaborativeDocPayload`, `UpdateCollaborativeDocResponse`.

**Próximas Prioridades**:
1. ~~**Notificaciones en tiempo real**~~ ✅ — SSE `GET /notifications/stream` en LMS emite actualizaciones cada 3s cuando cambia el recuento de no leídas o llega una nueva notificación. `NotificationCenter.tsx` reemplaza polling de 5 min por `EventSource`; se cierra al desmontar el componente.
2. ~~**Progreso del curso**~~ ✅ — Endpoint ligero `GET /courses/{id}/progress` en LMS con `progress_percentage`, `completed_lessons`, `total_lessons`. Barra de progreso integrada en la página del curso (visible solo al estar inscrito): muestra % actual, verde al completar 100%. `getCourseProgress()` en `api.ts`.

---

### Fase 41: Operaciones de Instructor y Experiencia del Estudiante 🎓

- [x] **A. Panel de Instructor Operacional** — Vista unificada por curso: lista de alumnos con % de progreso en tiempo real, alertas de "estudiante en riesgo" (sin actividad en X días / bajo rendimiento), acción rápida para enviar notificación. *(Implementado: tabla enriquecida en Studio con progreso, promedio, última actividad, semáforo de riesgo y modal de notificación directa al alumno.)*
- [x] **B. Anotaciones en Lecciones** — Los alumnos pueden dejar notas privadas en lecciones (timestamp en video, posición en texto). Panel "Mis Notas" para repasar todo el contenido anotado.
- [x] **C. Sistema de Mentoría** — Asignación de instructor/tutor a grupos de alumnos. Panel de seguimiento con mensajería 1-a-1 y visibilidad del progreso del grupo asignado.
- [x] **D. Importación/Exportación de Cursos** — Backup completo en JSON portátil (estructura + contenido + preguntas). Restauración/duplicación de cursos.
- [x] **F. Evaluación entre Pares Mejorada** — Asignación automática con rúbricas configurables. Calificación promediada pares + instructor con peso configurable.

### Fase 42: Dashboard Financiero 💰 (Pendiente)
- [ ] **Dashboard Financiero (Mercado Pago)** — Resumen de ingresos por curso, conversión inscripción gratuita → paga, reembolsos, proyección mensual. Solo visible para admin.