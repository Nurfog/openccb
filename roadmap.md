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
  - [x] Diseño responsivo (móviles/tablets)
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

## Fase 6: Funcionalidades Avanzadas ✅
- [x] **Multi-tenancy**: Soporte para múltiples organizaciones (Completado)
  - [x] Migración del esquema DB (añadir `organization_id`)
  - [x] Actualización de modelos Rust y Claims de JWT
  - [x] Middleware en Axum para contexto de organización
  - [x] Registro en frontend con soporte para organizaciones
  - [x] **Super Admin y Org por Defecto**: Gestión global de todos los inquilinos
  - [x] **Visibilidad Global de Cursos**: Cursos de sistema disponibles para todas las organizaciones
- [x] **Personalización de Marca (Branding)**: Identidad propia por organización (Completado)
  - [x] Carga y optimización de logotipos
  - [x] Esquemas de colores personalizados (Primario/Secundario)
  - [x] Adaptación dinámica del portal de Experience
  - [x] Previsualización en vivo del branding en Studio
- [x] **Interfaz de Usuario Avanzada**:
  - [x] **Selector de Organizaciones Premium**: Gestión multi-tenant con búsqueda predictiva
  - [x] **Combobox de Búsqueda**: Componente elegante con filtrado y estilo glassmorphism

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
- [ ] **Apps Móviles**: (Postpuesto por ahora)
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
- [ ] **Tutor de IA Integrado**: Asistente basado en RAG dentro del reproductor de lecciones
- [x] **Evaluaciones por Audio**: Preguntas con respuesta oral para idiomas con feedback de IA detallado (Completado)
- [x] **Eliminación de Cursos**: Gestión completa del ciclo de vida del contenido (Completado)
- [x] **Quices con Contexto IA**: Generación de evaluaciones con enfoque y tipo personalizable (Completado)
- [x] **Actividades Gamificadas**: Nuevos bloques de Juego de Memoria e Identificación Visual (Hotspots) (Completado)
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

**Estado Actual**: La plataforma cuenta con un motor de IA avanzado que permite la generación de contenidos con una "Persona" docente experta, evaluaciones de audio automatizadas y quices personalizables con contexto. Se ha completado el ciclo de vida de gestión de cursos con la integración de la funcionalidad de borrado.

**Próximas Prioridades**:
1. **QA y Estabilidad**: Verificación del flujo completo de evaluación en entornos de producción.
2. **IA Teaching Assistant**: Tutor RAG personalizado por curso.
3. **Rutas de Aprendizaje**: Recomendaciones basadas en el historial.
