# OpenCCB: Hoja de Ruta (Roadmap) del Proyecto

## Fase 1: Cimientos ✅
- [x] Configuración del Workspace de Rust (Edición 2024)
- [x] Estructura de Microservicios (CMS y LMS)
- [x] Infraestructura Multi-Base de Datos (PostgreSQL con DBs separadas)
- [x] Inicialización del Frontend (Studio y Experience con Next.js)
- [x] Dockerización de todos los servicios
- [x] Integración de API (Dashboard <-> Servicio CMS)
- [x] Script de instalación unificado (`install.sh`) con detección de hardware y auto-configuración

## Fase 2: Funcionalidades Core del CMS ✅
- [x] Editor de Estructura de Cursos (Módulos y Lecciones)
- [x] Sistema de Carga de Archivos (Video, Audio, Recursos Nativos)
- [x] Contenido Interactivos (Constructor de Actividades)
  - [x] Reordenamiento de bloques (Subir/Bajar)
  - [x] Descripciones con texto enriquecido
  - [x] Bloques multimedia con restricciones de reproducción
  - [x] Bloques de Quiz (Opción múltiple, Verdadero/Falso, Selección múltiple)
  - [x] Tipos de evaluación avanzada:
    - [x] Completar espacios en blanco
    - [x] Emparejamiento de parejas
    - [x] Ordenamiento/Secuenciación
    - [x] Respuesta corta
- [x] Comunicación entre servicios (Sincronización CMS -> LMS)
- [x] Reproductor de video Premium con límites de visualización
- [x] Interfaz de Studio completa con gestión dinámica de cursos

## Fase 3: Autenticación y Seguridad ✅
- [x] **Autenticación Basada en JWT**: Auth común para todos los servicios
- [x] **Control de Acceso Basado en Roles (RBAC)**:
  - [x] Soporte multi-rol (Admin, Instructor, Estudiante)
  - [x] Permisos e interfaces específicas por rol
  - [x] Autorización basada en tokens para endpoints protegidos
- [x] **Registro de Auditoría (Audit Log)**: Seguimiento de todos los cambios en el CMS
- [x] **Interfaz de Auditoría**: Panel de administración para visualizar registros de cambios

## Fase 4: Experiencia LMS y Calificaciones ✅
- [x] **Portal del Estudiante (Experience)**:
  - [x] Catálogo de cursos e inscripciones
  - [x] Reproductor interactivo de lecciones
  - [x] Diseño responsivo (móviles/tablets) - **Optimizado y validado en Fase 15**
- [x] **Sistema de Calificación Holístico**:
  - [x] Categorías de calificación con pesos (porcentajes)
  - [x] Opción de eliminar las N puntuaciones más bajas por categoría
  - [x] Cálculo automático de la nota ponderada
- [x] **Políticas de Evaluación**:
  - [x] Intentos máximos configurables por lección
  - [x] Correcciones instantáneas y políticas de reintento
  - [x] Seguimiento atómico de intentos con validación de reglas
- [x] **Seguimiento del Progreso**:
  - [x] Visualización de puntuaciones en tiempo real
  - [x] Desglose categoría por categoría
- [x] **Umbrales de Aprobación Dinámicos**:
  - [x] Porcentaje de aprobación configurable por curso
  - [x] Visualización de rendimiento en 5 niveles
  - [x] Feedback por colores (desde Reprobado hasta Excelente)
- [x] **Certificados**: Generación automática de certificados al completar el curso

## Fase 5: Analíticas e Insights ✅
- [x] **Dashboard de Analíticas para Instructores**:
  - [x] Total de inscritos por curso
  - [x] Promedio general de notas
  - [x] Desglose de rendimiento por lección
  - [x] Detección de "lecciones difíciles"
  - [x] Aplicación de RBAC (los instructores solo ven sus cursos)
- [x] **Dashboard de Progreso del Estudiante**:
  - [x] Barra de rendimiento interactiva
  - [x] Visualización de feedback basada en niveles
  - [x] Actualización de notas en tiempo real

## Fase 6: Refactorización a Single-Tenant ✅
- [x] **Single-tenancy**: Reposicionamiento como módulo premium (Completado)
  - [x] Hardcoding del `organization_id` por defecto en middleware común
  - [x] Remoción de selectores de organización en Studio y Experience
  - [x] Simplificación de registros y logins para un solo inquilino
  - [x] Eliminación de rutas y controladores de gestión multi-empresa
  - [x] Limpieza de componentes frontend redundantes (Selector, Gestión de Orgs)
- [x] **Personalización de Marca (Branding Premium)**: Identidad unificada (Completado)
  - [x] Endpoints singulares para gestión de marca sin parámetros de ID
  - [x] Carga y optimización de logotipos y favicons customizados
  - [x] Nombre de plataforma personalizado (White-label)
  - [x] Esquemas de colores personalizados aplicado globalmente
  - [x] Previsualización en vivo del branding en Studio renovada
- [x] **Interfaz de Usuario Simplificada**:
  - [x] **Login Unificado**: Eliminación de flujo dividido Personas/Empresas
  - [x] **Navegación Limpia**: Remoción de enlaces de administración de organizaciones

## Fase 7: Compromiso y Social (En Progreso)
- [x] **Analíticas de Vanguardia**:
  - [x] Análisis de cohortes (Implementado)
  - [x] Métricas de retención (Implementado)
  - [x] Mapas de calor de participación (Heatmaps) (Implementado)
- [x] **Integración de IA**:
  - [x] Resúmenes de lecciones generados por IA (Llama 3)
  - [x] Generación automática de quices (Llama 3)
  - [ ] Transcripción y traducción de video en tiempo real (Postpuesto - Reemplazado por Llama 3 para otras funciones)
- [x] **Rutas de Aprendizaje Personalizadas**: Recomendaciones impulsadas por Llama 3 (Implementado)
- [x] **Gamificación Base**: (Implementada a nivel de sistema)
  - [x] Medallas y logros
  - [x] Tablas de clasificación (Leaderboards)
  - [x] Sistema de XP y niveles
- [x] **Mejoras en la Gestión de Cursos**:
  - [x] Nombrado manual de módulos, lecciones y actividades
  - [x] Pacing de cursos: Modo autodidacta (Evergreen) o Dirigido por instructor (Cohort)

  - [x] Calendario de hitos y recordatorios automáticos de fechas límite

## Fase 8: Funcionalidades Enterprise (En Progreso)
- [x] **Perfil de Usuario y Ciclo de Vida**:
  - [x] **Cierre de Sesión Integrado**: Gestión estandarizada en ambos portales
  - [x] **Gestión del Perfil**: Actualización de avatar, bio e idioma por el usuario
- [x] **Reportes Avanzados**: Constructor de reportes personalizados y exportación a CSV (Implementado)
- [x] **Ecosistema de Integración**:
  - [x] **SSO (Single Sign-On)**: Soporte completo OIDC (Google, Okta, Azure AD) (Completado)
  - [x] **LTI 1.3 Tool Provider**: Integración segura con LMS externos como Canvas o Moodle (Completado)
- [ ] **Accesibilidad**: Auditoría y correcciones WCAG 2.1

## Fase 9: Portabilidad de Cursos ✅
- [x] **Esquema JSON Universal**: Formato estandarizado para intercambio de cursos (Completado)
- [x] **Exportador Recursivo**: Serialización de jerarquías completas de cursos (Completado)
- [x] **Importador Atómico**: Creación por lotes con re-mapeo de dependencias (Completado)
- [x] **Interfaz de Portabilidad**: Botones de Exportación/Importación en Ajustes (Completado)

## Fase 10: Consola de Administración Global ✅
- [x] **Panel "Estilo Django"**: Interfaz dedicada para Super-Admins para gestionar Orgs y Usuarios (Completado)
- [x] **Monitoreo del Sistema**: Estadísticas en tiempo real de uso de IA y estado de servicios (Completado)
- [x] **Auditoría Universal**: Panel centralizado de actividad para todos los tenants (Completado)

## Fase 11: Evaluaciones y Quizzes Extendidos (En Progreso)
- [x] **Quices de Código**: Desafíos interactivos con reproductor tipo IDE (Completado)
- [x] **Identificación Visual**: Quices de "Puntos Calientes" (Hotspots) en imágenes (Completado)
- [x] **Tutor de IA Integrado**: Asistente basado en RAG con acceso a bloques interactivos e historial del curso (Completado)
- [x] **Evaluaciones por Audio**: Preguntas con respuesta oral para idiomas con feedback de IA detallado (Completado)
- [x] **Eliminación de Cursos**: Gestión completa del ciclo de vida del contenido (Completado)
- [x] **Quices con Contexto IA**: Generación de evaluaciones con enfoque y tipo personalizable (Completado)
- [x] **Actividades Gamificadas**: Nuevos tipos de bloques interactivos incluyendo Juegos de Memoria (con generación automática por IA) y Puntos Calientes (Hotspots). (Completado)
- [x] **Marcadores de Video**: Preguntas que pausan el video en timestamps específicos (Completado)

## Fase 12: Generador de Cursos "Mágico" con IA ✅
- [x] **Creación Instantánea**: Generación de estructura completa a partir de un prompt (Completado)
- [x] **Ingestión Atómica Transaccional**: Creación de módulos y lecciones en un solo paso (Completado)
- [x] **Ingeniería de Prompts**: Diseño curricular profesional optimizado para LLMs (Completado)

## Fase 13: Gamificación para Niños ✅
- [x] **Juego de Memoria**: Emparejamiento conceptual mediante cartas interactivas (Completado)
- [x] **Arrastrar al Cubo**: Categorización visual por arrastre (Completado)
- [x] **Feedback Animado**: Animaciones de celebración (confeti, estrellas) para éxitos (Completado)

## Fase 14: Globalización y Aprendizaje con Documentos ✅
- [x] **Internacionalización (i18n)**: Soporte de UI para Inglés, Español y Portugués (Completado)
- [x] **Selector de Idiomas**: Cambio dinámico en la barra de navegación y perfil (Completado)
- [x] **Bloque de Documentos**: Previsualización de PDF y descargas de DOCX/PPTX (Completado)
- [x] **IA Multi-idioma**: Las transcripciones y resúmenes siguen el contexto del curso (Completado)

---

## Fase 15: Conectividad y UI Adaptativa ✅
- [x] **Dynamic API Resolution**: Detección automática de IP del servidor para acceso multi-dispositivo y LAN (Completado)
- [x] **Menú Móvil (Experience)**: Implementación de navegación lateral (hamburger) para celulares (Completado)
- [x] **Optimización de Studio**: Interfaz de administración compacta y escalable para pantallas pequeñas (Completado)
- [x] **Tipografía Fluida**: Escalado de fuentes y márgenes adaptativos en todo el portal (Completado)
- [x] **Locked Lesson AI Feedback**: Generación de retroalimentación motivacional para lecciones bloqueadas (Completado)
- [x] **Context Enrichment**: Ingesta de bloques interactivos en el motor de RAG (Completado)
- [x] **Course History Context**: Capacidad del tutor para recordar lecciones previas (Completado)
- [x] **Color-Coded Progress Status**: Seguimiento visual por colores (Verde/Amarillo/Rojo) en sidebar y cabeceras (Completado)

## Fase 16: Estabilidad y UX Avanzada ✅
- [x] **QA y Estabilidad**: Verificación del flujo completo de evaluación en entornos de producción.
- [x] **Rutas de Aprendizaje**: Recomendaciones basadas en el historial personalizadas y perfiles de habilidades.
- [x] **Optimización de Contenedores**: Limpieza automatizada y reducción de huella de infraestructura mediante Build Context optimizado.
- [x] **Split Login Flow**: Separación de flujos de autenticación para Personas y Empresas.

## Fase 17: Funcionalidades Estilo Open edX (En Progreso)
- [x] **Discussion Forums**: Sistema de foros por curso con hilos, respuestas anidadas y moderación.
  - [x] Base de datos (4 tablas: threads, posts, votes, subscriptions)
  - [x] Backend API (10 endpoints para gestión completa)
  - [x] Permisos diferenciados (estudiante vs instructor)
  - [x] Sistema de votación y endorsement
  - [x] Frontend (componentes React)
  - [x] Integración con notificaciones
- [x] **Course Announcements**: Sistema de anuncios de instructores con notificaciones.
- [x] **Student Notes**: Anotaciones personales por lección con exportación a PDF.
- [x] **Peer Assessment**: Evaluación entre pares con rúbricas configurables.
- [x] **Cohorts & Groups**: Segmentación de estudiantes con contenido específico.
- [x] **Content Libraries**: Repositorio reutilizable de bloques y lecciones.
- [x] **Advanced Grading**: Rúbricas detalladas y workflows de calificación.
- [x] **Learning Sequences**: Prerequisitos y rutas condicionales entre lecciones.
- [x] **Bulk Operations**: Bulk enrollment, advanced grade export, and segmented announcements.
- [x] **Course Teams**: Support for multiple instructors per course with granular roles.
- [x] **Course Preview**: Vista previa de lecciones sin inscripción.
- [x] **Bookmarks**: Sistema de favoritos para lecciones importantes.
- [x] **Progress Dashboard**: Gráficos de progreso temporal y predicción de finalización.

## Fase 18: Monetización y Estandarización ✅
- [x] **E-Commerce & Monetización**: (Completado)
  - [x] Integración con Mercado Pago (Preferencia de pago y Webhooks).
  - [x] Sistema de precios y moneda por curso.
  - [x] Inscripción automática tras pago exitoso.
  - [x] Verificación de seguridad de acceso a lecciones basada en inscripción.
  - [x] Dashboard de transacciones básico en base de datos.
- [x] **Interoperabilidad**: ✅
  - [x] Implementación de LTI 1.3 (Tool Provider) con soporte para Deep Linking.
  - [x] Conectividad segura con LMS externos (Moodle/Canvas) via OIDC y JWKS.
- [x] **Analíticas Predictivas**: ✅
  - [x] Motor de IA para detección de riesgo de abandono.
  - [x] Notificaciones proactivas para instructores.
- [x] **Gestión de Activos**: ✅
  - [x] Biblioteca de medios global (Global Asset Manager).
  - [x] Reutilización de recursos multi-curso.
- [x] **Aprendizaje en Vivo**: ✅
  - [x] Integración con Jitsi para aulas virtuales en tiempo real.
  - [x] Gestión de reuniones y programación desde Studio.
  - [x] Acceso directo para estudiantes desde Experience.
- [x] **Portafolio del Estudiante**: ✅
  - [x] Sistema de medallas y logros (Open Badges).
  - [x] Perfiles profesionales públicos con control de privacidad.
  - [x] Visualización de progreso y nivel de XP.

## Fase 19: Presentación Visual y Marketing de Cursos ✅
- [x] **Metadatos de Marketing Estructurados**: Captura de objetivos, requisitos, público objetivo y certificación en Studio. (Completado)
- [x] **Premium Course Summary**: Nueva interfaz de "Acerca del Curso" en Experience con diseño de alta fidelidad y navegación por pestañas. (Completado)
- [x] **Dashboard Global de Tareas AI**: Panel unificado de control en consola administrativa para monitorear, reintentar y cancelar todas las generaciones en segundo plano (transcripciones, quices, juegos de memoria, etc). (Completado)

---

**Estado Actual**: La plataforma cuenta con un motor de IA avanzado, gestión multi-tenant completa, tutoría inteligente con memoria histórica, una **interfaz 100% responsiva**, flujos de autenticación diferenciados, **sistema de foros de discusión funcional**, **gestión de anuncios segmentados**, **monetización integrada con Mercado Pago**, **Inscripción Masiva de Usuarios**, **Exportación Avanzada de Calificaciones**, **Librerías de Contenido reutilizables**, **Sistema de Rúbricas Avanzado**, **Secuencias de Aprendizaje**, **Gestión de Equipos Docentes**, **Vista Previa de Cursos**, **Dashboard de Progreso Estudiantil**, **Sistema de Marcadores**, **Biblioteca Global de Activos**, **Interoperabilidad LTI 1.3**, **Analíticas Predictivas**, **Integración de Jitsi**, **Portafolios con Perfiles Públicos** y **Landing Pages de Cursos (Marketing) automatizadas**.

## Fase 20: IA Generativa Avanzada (En Ejecución) 🧠
- [x] **Generación de Juegos de Memoria Conceptuales**: Creación automática de parejas (concepto/definición) a partir de transcripciones. (Completado)
- [x] **Simulaciones de Rol y Diálogos Ramificados**: Motor de escenarios interactivos con respuestas dinámicas de la IA. (Completado)
- [x] **Auto-Hotspots Pedagógicos**: Identificación automática de puntos de interés en imágenes con descripciones técnicas. (Completado)
- [x] **Diagramas de Mermaid Dinámicos**: Visualización automática de procesos y mapas mentales a partir del contenido de la lección. (Completado)
- [x] **Laboratorios de Código con Hints de IA**: Generación de desafíos de programación con pistas contextuales basadas en errores. (Completado)

---

## Fase 21: Búsqueda Semántica y RAG Avanzado ✅
- [x] **PGVector Integration**: Implementación de búsqueda semántica con embeddings de 768 dimensiones. (Completado)
- [x] **Semantic Question Search**: Búsqueda por similitud de coseno en question bank. (Completado)
- [x] **Duplicate Detection**: Detección automática de preguntas duplicadas (>95% similitud). (Completado)
- [x] **RAG Mejorado para Generación**: Contexto semántico + verificación de 4 habilidades. (Completado)
- [x] **Knowledge Base Embeddings**: Búsqueda semántica en base de conocimiento para tutor IA. (Completado)
- [x] **Índices IVFFlat**: Optimización para >100k filas (25-100x más rápido). (Completado)
- [x] **MySQL Integration Completa**: Importación de study plans y courses con tracking. (Completado)
- [x] **Test Templates con Filtros**: Filtrado por mysql_course_id, level, course_type. (Completado)

---

**Estado Actual**: La plataforma cuenta con un motor de IA avanzado, gestión multi-tenant completa, tutoría inteligente con memoria histórica, una **interfaz 100% responsiva**, flujos de autenticación diferenciados, **sistema de foros de discusión funcional**, **gestión de anuncios segmentados**, **monetización integrada con Mercado Pago**, **Inscripción Masiva de Usuarios**, **Exportación Avanzada de Calificaciones**, **Librerías de Contenido reutilizables**, **Sistema de Rúbricas Avanzado**, **Secuencias de Aprendizaje**, **Gestión de Equipos Docentes**, **Vista Previa de Cursos**, **Dashboard de Progreso Estudiantil**, **Sistema de Marcadores**, **Biblioteca Global de Activos**, **Interoperabilidad LTI 1.3**, **Analíticas Predictivas**, **Integración de Jitsi**, **Portafolios con Perfiles Públicos**, **Landing Pages de Cursos (Marketing) automatizadas**, **Diagramas de Mermaid Dinámicos**, **Laboratorios de Código con Hints de IA**, y **Búsqueda Semántica con PGVector**.

**Próximas Prioridades**:
1. **Accesibilidad Universal**: Auditoría y ajustes de contraste para cumplimiento WCAG 2.1.
2. **Integraciones Empresariales**: Conectividad con HRIS y ERPs externos.
3. **Optimización de Performance**: Refactorización de componentes críticos y carga diferida (lazy loading).

---

## Fase 22: Finalización de Funcionalidades Pendientes 🛠️
- [ ] **Generación de Certificados**: Implementación de lógica de generación automática al completar curso.
  - [ ] Backend: Endpoint para verificar completitud y generar certificado (PDF)
  - [ ] Frontend: UI para configurar templates de certificados en Studio
  - [ ] Frontend: Botón de descarga en Experience al completar curso
  - [ ] Schema de BD ya existe (`certificate_template`), solo falta implementación
- [ ] **Tracking de Progreso Real**: Cálculo y visualización de progreso real del estudiante.
  - [ ] Backend: Endpoint para calcular % de completitud basado en lecciones completadas
  - [ ] Frontend: Reemplazar hardcoded `progress = 0` en `my-learning/page.tsx`
  - [ ] Frontend: Barra de progreso real en catálogo de cursos
- [ ] **Notificaciones de Foros**: Despacho de alertas cuando hay respuestas en hilos suscritos.
  - [ ] Backend: Implementar lógica de notificación en `handlers_discussions.rs` (línea 352 tiene TODO)
  - [ ] Frontend: Ver que las notificaciones se muestran correctamente en NotificationCenter
- [ ] **Importación Excel para Question Bank**: Fix del código comentado.
  - [ ] Backend: Descomentar y implementar `import_from_excel` en `handlers_question_bank.rs`
  - [ ] Frontend: Agregar botón de importación Excel en UI de Question Bank
  - [ ] Documentación: Formato esperado del archivo Excel
- [ ] **Re-habilitar Rate Limiting**: Solución de incompatibilidad con middleware de auth.
  - [ ] Backend: Fix de `GovernorLayer` para que funcione después del middleware de auth
  - [ ] Backend: Configurar límites apropiados por tipo de ruta (pública vs protegida)
  - [ ] Testing: Verificar que no bloquea peticiones legítimas

---

## Fase 23: Integración de Email/SMTP 📧
- [ ] **Configuración SMTP**: Variables de entorno para configuración de servidor de correo.
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
  - [ ] Soporte para providers: SendGrid, AWS SES, SMTP genérico
- [ ] **Notificaciones por Email**:
  - [ ] Recordatorios de deadlines próximos
  - [ ] Alertas de respuestas en foros suscritos
  - [ ] Notificaciones de nuevas calificaciones
  - [ ] Anuncios de curso de instructores
- [ ] **Autenticación por Email**:
  - [ ] Password reset vía link de email
  - [ ] Verificación de email al registrar cuenta
  - [ ] Magic link login (opcional)
- [ ] **Emails Transaccionales**:
  - [ ] Welcome email para nuevos usuarios
  - [ ] Notificación de inscripción exitosa
  - [ ] Certificado de completación por email
  - [ ] Recibo de pago de Mercado Pago
- [ ] **Template de Emails**:
  - [ ] Templates HTML responsivos con branding personalizado
  - [ ] Soporte multi-idioma (EN, ES, PT)
  - [ ] Preview de templates en panel de administración

---

## Fase 24: Búsqueda Global 🔍
- [ ] **Search Endpoint Unificado**: API de búsqueda across cursos, lecciones, contenidos.
  - [ ] Backend: Endpoint `/search` con filtros por tipo, categoría, instructor
  - [ ] Backend: Búsqueda full-text con PostgreSQL (tsvector)
  - [ ] Backend: Opcionalmente agregar búsqueda semántica con embeddings (similar a question bank)
- [ ] **UI de Búsqueda**:
  - [ ] Frontend: Barra de búsqueda global en navbar de Studio y Experience
  - [ ] Frontend: Resultados en tiempo real con autocompletado
  - [ ] Frontend: Filtros avanzados (fecha, instructor, tipo de contenido, nivel)
- [ ] **Búsqueda en Contenidos**:
  - [ ] Indexación de transcripciones de video para búsqueda
  - [ ] Búsqueda en documentos PDF y DOCX
  - [ ] Búsqueda en preguntas de quizzes

---

## Fase 25: Soporte SCORM/xAPI 📦
- [ ] **SCORM 1.2/2004 Player**:
  - [ ] Backend: Endpoint para subir paquetes SCORM (.zip)
  - [ ] Backend: Extracción y almacenamiento de metadatos SCORM
  - [ ] Frontend: Player SCORM embebido en Experience
  - [ ] Frontend: Preview de paquetes SCORM en Studio
- [ ] **xAPI (Tin Can) Tracking**:
  - [ ] Backend: Endpoint para recibir statements xAPI
  - [ ] Backend: Almacenamiento de statements en base de datos separada
  - [ ] Backend: Endpoint para consultar historial xAPI por usuario/curso
  - [ ] Frontend: Dashboard de analíticas xAPI para instructores
- [ ] **Import/Export SCORM**:
  - [ ] Backend: Generador de paquetes SCORM desde cursos OpenCCB
  - [ ] Backend: Validador de paquetes SCORM importados
  - [ ] Frontend: UI para import/export SCORM en Studio
- [ ] **Compatibilidad con Contenidos de Terceros**:
  - [ ] Soporte para H5P, Articulate, Adobe Captivate
  - [ ] Tracking de progreso y calificaciones desde contenidos SCORM

---

## Fase 26: Accesibilidad WCAG 2.1 ♿
- [ ] **Auditoría de Accesibilidad**:
  - [ ] Herramientas: axe-core, Lighthouse, WAVE
  - [ ] Reporte de problemas de contraste de color
  - [ ] Verificación de navegación por teclado
  - [ ] Testing con screen readers (NVDA, VoiceOver, JAWS)
- [ ] **Correcciones de Accesibilidad**:
  - [ ] Ajustes de contraste para cumplir WCAG AA (4.5:1 para texto normal)
  - [ ] Labels ARIA en todos los componentes interactivos
  - [ ] Navegación por teclado completa (Tab, Enter, Escape, flechas)
  - [ ] Focus indicators visibles en todos los elementos
  - [ ] Skip links para saltar a contenido principal
- [ ] **Accesibilidad de Formularios**:
  - [ ] Labels asociados correctamente a inputs
  - [ ] Mensajes de error accesibles por screen reader
  - [ ] Autocomplete en campos apropiados
- [ ] **Accesibilidad de Multimedia**:
  - [ ] Subtítulos obligatorios para videos
  - [ ] Transcripciones para contenido de audio
  - [ ] Alt text para imágenes importantes
- [ ] **Testing Continuo**:
  - [ ] Integración de axe-core en CI/CD
  - [ ] Testing manual regular con usuarios de screen readers
  - [ ] Documentación de accesibilidad para contribuidores

---

## Fase 27: PWA y Soporte Offline 📱
- [ ] **Progressive Web App (PWA)**:
  - [ ] Service worker para caching de assets estáticos
  - [ ] Manifest.json para instalación en móviles/desktop
  - [ ] Offline fallback page
  - [ ] Push notifications para alertas críticas
- [ ] **Descarga de Lecciones**:
  - [ ] Frontend: Botón de descarga por lección en Experience
  - [ ] Frontend: UI para gestionar descargas (ver/eliminar)
  - [ ] Service worker: Caching de contenido de video/audio
  - [ ] IndexedDB: Almacenamiento de progreso offline
- [ ] **Sincronización Offline**:
  - [ ] Service worker: Queue de acciones offline (calificaciones, notas, progreso)
  - [ ] Frontend: Sync automático al reconectar
  - [ ] Backend: Endpoint para recibir sync data y reconciliar
  - [ ] Manejo de conflictos (última escritura gana, o merge)
- [ ] **Experiencia Offline**:
  - [ ] Indicador de estado de conexión en UI
  - [ ] Contenido disponible sin conexión claramente marcado
  - [ ] Límite de almacenamiento configurable
  - [ ] Limpieza automática de caché antiguo

---

## Fase 28: Sistema de Mentoría 🎓
- [ ] **Gestión de Mentores**:
  - [ ] Backend: CRUD de asignaciones mentor-estudiante
  - [ ] Backend: Endpoints para disponibilidad de mentores
  - [ ] Frontend: UI para asignar mentores en panel de administración
  - [ ] Frontend: Perfil de mentor con bio, especialidades, disponibilidad
- [ ] **Sesiones 1-a-1**:
  - [ ] Backend: Sistema de agendamiento de sesiones
  - [ ] Backend: Integración con Jitsi para sesiones virtuales
  - [ ] Frontend: Calendario de sesiones para mentores y estudiantes
  - [ ] Frontend: Recordatorios por email/notificación
- [ ] **Seguimiento Personalizado**:
  - [ ] Backend: Notas de mentor por estudiante
  - [ ] Backend: Plan de aprendizaje personalizado por estudiante
  - [ ] Frontend: Dashboard de mentor con vista de estudiantes asignados
  - [ ] Frontend: Reportes de progreso para mentores

---

## Fase 29: Integraciones Empresariales 🏢
- [ ] **HRIS Connectors**:
  - [ ] Integración con Workday (API REST)
  - [ ] Integración con SAP SuccessFactors (OData)
  - [ ] Integración con BambooHR
  - [ ] Sync automático de usuarios, departamentos, managers
- [ ] **LDAP/Active Directory**:
  - [ ] Backend: Autenticación vía LDAP
  - [ ] Backend: Sync de atributos de usuario desde AD
  - [ ] Frontend: Configuración de LDAP en panel de administración
  - [ ] Soporte para SSO híbrido (LDAP + OIDC)
- [ ] **Webhooks Salientes**:
  - [ ] Backend: Sistema de webhooks configurables por evento
  - [ ] Backend: Retry logic con exponential backoff
  - [ ] Backend: Dashboard de entrega de webhooks (éxito/fallo)
  - [ ] Frontend: UI para gestionar webhooks en Studio
  - [ ] Frontend: Test de webhook desde UI
- [ ] **ERP Integrations**:
  - [ ] Integración con sistemas de facturación
  - [ ] Sync de inscripciones y pagos con ERP
  - [ ] Reportes financieros para administradores

---

## Fase 30: Reportes Avanzados y Business Intelligence 📊
- [ ] **Reportes para Estudiantes**:
  - [ ] Dashboard de analíticas personales (tiempo de estudio, skills, tendencias)
  - [ ] Reporte de progreso semanal/mensual por email
  - [ ] Exportación de historial de aprendizaje (PDF, Excel)
- [ ] **Reportes para Instructores**:
  - [ ] Reportes automáticos programables (diario, semanal, mensual)
  - [ ] Exportación en múltiples formatos (PDF, Excel, CSV)
  - [ ] Reportes comparativos entre cohortes
  - [ ] Análisis de efectividad de contenido (qué funciona mejor)
- [ ] **Reportes para Administradores**:
  - [ ] Dashboard de uso de la plataforma (DAU, WAU, MAU)
  - [ ] Análisis de ROI de cursos (costo vs completitud)
  - [ ] Reportes de uso de IA (tokens, costo, efectividad)
  - [ ] Exportación de datos completos de la plataforma
- [ ] **Business Intelligence**:
  - [ ] Integración con herramientas BI externas (Metabase, Tableau)
  - [ ] API de datos para dashboards externos
  - [ ] Data warehouse schema optimizado para queries analíticos

---

## Fase 31: Mejoras de Seguridad y GDPR 🛡️
- [ ] **Two-Factor Authentication (2FA)**:
  - [ ] Backend: Soporte para TOTP (Google Authenticator, Authy)
  - [ ] Backend: Backup codes para recuperación
  - [ ] Frontend: Setup de 2FA en perfil de usuario
  - [ ] Frontend: Login con 2FA
- [ ] **GDPR Compliance**:
  - [ ] Backend: Endpoint para exportar todos los datos de un usuario
  - [ ] Backend: Endpoint para eliminar todos los datos de un usuario (right to be forgotten)
  - [ ] Frontend: UI para solicitar exportación/eliminación
  - [ ] Frontend: Consent management para cookies y tracking
- [ ] **Audit Logs Mejorados**:
  - [ ] Backend: Exportación de audit logs (CSV, JSON)
  - [ ] Backend: Alertas de actividad sospechosa
  - [ ] Frontend: Filtros avanzados de audit logs
  - [ ] Frontend: Dashboard de seguridad
- [ ] **Mejoras de Seguridad**:
  - [ ] CSRF protection en todos los endpoints
  - [ ] Content Security Policy headers
  - [ ] Rate limiting por IP y por usuario
  - [ ] IP allowlisting para admin endpoints

---

**Estado Actual**: La plataforma cuenta con un motor de IA avanzado, gestión multi-tenant completa, tutoría inteligente con memoria histórica, una **interfaz 100% responsiva**, flujos de autenticación diferenciados, **sistema de foros de discusión funcional**, **gestión de anuncios segmentados**, **monetización integrada con Mercado Pago**, **Inscripción Masiva de Usuarios**, **Exportación Avanzada de Calificaciones**, **Librerías de Contenido reutilizables**, **Sistema de Rúbricas Avanzado**, **Secuencias de Aprendizaje**, **Gestión de Equipos Docentes**, **Vista Previa de Cursos**, **Dashboard de Progreso Estudiantil**, **Sistema de Marcadores**, **Biblioteca Global de Activos**, **Interoperabilidad LTI 1.3**, **Analíticas Predictivas**, **Integración de Jitsi**, **Portafolios con Perfiles Públicos**, **Landing Pages de Cursos (Marketing) automatizadas**, **Diagramas de Mermaid Dinámicos**, **Laboratorios de Código con Hints de IA**, y **Búsqueda Semántica con PGVector**.

**Próximas Prioridades**:
1. **Finalización de Funcionalidades Pendientes**: Certificados, progreso real, notificaciones de foros, importación Excel, rate limiting.
2. **Integración de Email/SMTP**: Notificaciones por email, password reset, emails transaccionales.
3. **Accesibilidad Universal**: Auditoría y ajustes de contraste para cumplimiento WCAG 2.1.
4. **Búsqueda Global**: Search unificado en cursos, lecciones y contenidos.
5. **Integraciones Empresariales**: Conectividad con HRIS, LDAP/Active Directory, webhooks salientes.
6. **PWA y Offline**: Service workers, descarga de lecciones, sync offline.
7. **Seguridad**: 2FA, GDPR compliance, rate limiting re-habilitado.
