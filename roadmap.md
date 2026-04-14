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
- [ ] **Generación de Certificados Premium**: Mejorar UI de configuración de templates en Studio.
- [ ] **Tracking de Progreso Atómico**: Reemplazar hardcodes por cálculo real de completitud.
- [ ] **Notificaciones de Foros**: Implementar despacho de alertas vía SMTP.
- [ ] **Importación Masiva (Excel)**: Finalizar soporte para Question Bank.

## Fase 23 - 27: Infraestructura Crítica 📋 (Planificado)
- [ ] **Integración SMTP**: Password reset, notificaciones transaccionales y de marketing.
- [ ] **Búsqueda Global Unificada**: Búsqueda full-text y semántica en toda la plataforma.
- [ ] **Soporte SCORM/xAPI**: Player nativo para contenidos legados.
- [ ] **Accesibilidad WCAG 2.1**: Auditoría y ajustes de contraste/navegación.
- [ ] **PWA y Soporte Offline**: Service workers para aprendizaje sin conexión.

---

## 🚀 Fases Estratégicas (Nuevas)

### Fase 32: IA de Moderación y Ética 🛡️
- [ ] **Auditoría de IA**: Sistema de validación para prevenir "halucinaciones" en el Tutor RAG.
- [ ] **Moderación Automática**: Detección de lenguaje ofensivo o inapropiado en foros y chats.
- [ ] **Ética de Datos**: Herramientas para transparencia en el uso de datos por los modelos de IA local.

### Fase 33: Aprendizaje Colaborativo Síncrono 🤝
- [ ] **Pizarras Compartidas**: Espacio de dibujo colaborativo integrado en lecciones.
- [ ] **Edición Multiusuario**: Soporte para documentos compartidos en tiempo real (tipo Google Docs).
- [ ] **Salas de Estudio**: Grupos efímeros para resolución de dudas grupales por video.

### Fase 34: Análisis Pedagógico Profundo 📊
- [ ] **Métricas de Calidad**: Análisis automático de la efectividad de las lecciones generadas.
- [ ] **Índice de Discriminación**: Estadísticas sobre qué preguntas de quiz discriminan mejor el conocimiento.
- [ ] **Sugerencias Curriculares**: IA recomendando cambios en la estructura del curso basada en el rendimiento real.

### Fase 35: Ecosistema de Plugins 🔌
- [ ] **Arquitectura Modular**: Sistema para que desarrolladores externos agreguen nuevos "Content Blocks".
- [ ] **Soporte para Web Components**: Permitir la inclusión de herramientas interactivas externas de forma segura.
- [ ] **OpenCCB Market**: Galería interna para descargar y habilitar extensiones.

### Fase 36: LTI 1.3 Tool Consumer 🔗
- [ ] **Consumo de herramientas externas**: Capacidad de embeber laboratorios externos (ej: MATLAB, Labster) dentro de OpenCCB.
- [ ] **Delegación de Calificaciones**: Recibir notas de herramientas externas y sincronizarlas con el Gradebook de OpenCCB.

---

**Estado Actual**: Plataforma madura con IA generativa integrada, arquitectura Premium Single-Tenant, búsqueda semántica y monetización operativa.
**Próximas Prioridades**:
1. Finalización de **Certificados y Progreso Real**.
2. Despliegue de **Infraestructura SMTP** para comunicación global.
3. Auditoría de **Accesibilidad Universal (WCAG)**.
4. Implementación de **IA de Moderación (Seguridad)**.
