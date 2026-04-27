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
**Próximas Prioridades**:
1. Migrar passback LTI de HMAC custom a **OAuth2 AGS** (estándar IMS) manteniendo compatibilidad transitoria.
2. Añadir **rotación/revocación de secretos** y auditoría de intentos fallidos de passback.
3. Evolucionar **Pizarras Compartidas** de polling a WebSocket/SSE tras validar carga en producción.