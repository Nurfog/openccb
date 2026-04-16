# OpenCCB: Open Comprehensive Course Backbone

OpenCCB es una infraestructura de código abierto para plataformas de gestión de aprendizaje y contenido (LMS/CMS), construida con rendimiento, seguridad y escalabilidad en mente.

---

## 📖 Tabla de Contenidos
- [🚀 Arquitectura Consolidada](#-arquitectura-consolidada)
- [✨ Funcionalidades Destacadas](#-funcionalidades-destacadas)
- [🛠 Stack Tecnológico](#-stack-tecnológico)
- [ requisitos-del-sistema](#requisitos-del-sistema)
- [📦 Guía de Inicio Rápido](#-guía-de-inicio-rápido)
- [📊 Estado de Funcionalidades](#-estado-de-funcionalidades)
- [🔌 Recursos para Desarrolladores](#-recursos-para-desarrolladores)
- [📈 Roadmap](#-roadmap)

---

## 🚀 Arquitectura Consolidada

El proyecto optimiza la complejidad de infraestructura consolidando servicios de backend en Rust con frontends modernos en Next.js:

1.  **Studio + CMS (Puertos 3000/3001)**: Next.js app para administración y API de Rust para gestión de contenido.
2.  **Experience + LMS (Puertos 3003/3002)**: Next.js app para estudiantes y API de Rust para entrega y calificaciones.
3.  **Database**: PostgreSQL 16 compartido con soporte para **PGVector**.
4.  **AI Services**: Stack local con Faster-Whisper (Transcripción) y Ollama (Inferencia LLM).

---

## ✨ Funcionalidades Destacadas

### 🧠 Inteligencia Artificial Avanzada
- **AI Course Wizard**: Generación instantánea de currículos completos a partir de un prompt.
- **AI Teaching Assistant (RAG)**: Tutor inteligente con memoria histórica y contexto de la lección actual.
- **Evaluación por Audio**: Análisis de pronunciación y feedback en lenguaje natural usando IA.
- **Diagramas Dinámicos**: Generación automática de diagramas Mermaid (mapas mentales, flujos) desde el contenido.
- **Analíticas Predictivas**: Motor que detecta riesgos de abandono escolar antes de que ocurran.

### 🎓 Gestión Académica Premium
- **Library of Content**: Repositorio centralizado de bloques y lecciones reutilizables.
- **Advanced Gradebook**: Libro de calificaciones con rúbricas detalladas y filtrado por cohortes.
- **Learning Sequences**: Gestión de prerrequisitos y rutas de aprendizaje condicionales.
- **LTI 1.3 Provider**: Interoperabilidad completa con Canvas, Moodle y otros LMS estándar.

### 🎮 Experiencia de Aprendizaje
- **Gamificación Integrada**: Sistema de XP, niveles, Badges (Open Badges) y juegos interactivos (Memoria, Hotspots).
- **Engagement Heatmaps**: Visualización para instructores de la retención segundo a segundo en videos.
- **Student Portfolio**: Perfiles públicos profesionales que muestran logros y progreso verificado.
- **Anotaciones Inteligentes**: Sistema de notas personales con auto-guardado por lección.

### 📱 Conectividad y Acceso
- **Dynamic LAN Access**: Resolución automática de IP para acceder desde cualquier dispositivo en la red WiFi.
- **Responsive UI/UX**: Interfaces optimizadas con diseño *Glassmorphism* y navegación móvil fluida.
- **White-Label Branding**: Personalización completa de marca, colores, logos y favicons por organización.

---

## 🛠 Stack Tecnológico

- **Backend**: [Rust](https://www.rust-lang.org/) (axum, sqlx).
- **Frontend**: [Next.js 14+](https://nextjs.org/) (App Router), [Tailwind CSS](https://tailwindcss.com/).
- **Base de Datos**: [PostgreSQL 16](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector).
- **IA In-house**: Faster-Whisper, Ollama (Llama 3.2, Nomic-Embed).

---

## 💻 Requisitos del Sistema

| Componente | **Pequeño (100 u.)** | **Mediano (500 u. concurrentes)** | **Grande (1000+ u.)** |
| :--- | :--- | :--- | :--- |
| **CPU** | 4 vCPUs | 8-12 vCPUs (AVX2+) | 16-32+ vCPUs |
| **RAM** | 8 GB | 16-32 GB | 64 GB+ |
| **GPU (IA)** | Opcional | NVIDIA RTX 3060+ (12GB) | Multi-GPU (A100/H100) |

> [!NOTE]
> Los requisitos de GPU son específicos para la autogestión de IA local. Si se utilizan APIs externas, estos requisitos disminuyen drásticamente.

---

## 📦 Guía de Inicio Rápido

### Requisitos Previos
- Docker & Docker Compose
- Node.js 18+ & Rust (para desarrollo local)

### Ejecución con Docker (Recomendado)
```bash
docker-compose up --build
```
- **Studio**: http://localhost:3000
- **Experience**: http://localhost:3003

### Comandos de Utilidad
```bash
# Instalación y configuración automática
./install.sh

# Instalación local usando IA en red LAN (ejemplo)
LOCAL_OLLAMA_URL=http://192.168.0.5:11434 LOCAL_WHISPER_URL=http://192.168.0.5:9000 ./install.sh

# Instalación local con URLs SAM compartidas explícitas
SAM_SHARED_URL=mysql://user:pass@host:3306/sige_sam_v3 SAM_DIAG_SHARED_URL=mysql://user:pass@host:3306/SAM_diagnostico ./install.sh

# Resetear base de datos de desarrollo
./scripts/reset_db.sh
```

---

## 🔌 Recursos para Desarrolladores

Para una guía detallada sobre cómo integrar o extender OpenCCB, consulta la documentación técnica:

- 📘 [Referencia de la API](docs/API.md)
- ⚙️ [Manual de Configuración](ManualDeConfiguracion.md)
- 🏗️ [Guía de Despliegue](DESPLIEGUE.md)

---

## 📊 Estado de Funcionalidades

### ✅ Implementado
- CRUD de Cursos e IA Generation.
- 16+ tipos de bloques interactivos.
- Sistema de foros, anuncios y gamificación.
- Soporte LTI 1.3 y SSO (OIDC).
- Monetización con Mercado Pago.

### ⚠️ En Desarrollo
- **Generación de Certificados**: Implementando lógica de PDF automático.
- **Progreso Real**: Refactorizando visualización en catálogo.
- **Email/SMTP**: Integración de notificaciones transaccionales.

---

## 📈 Roadmap

OpenCCB evoluciona constantemente. Consulta el [roadmap.md](roadmap.md) para ver el plan detallado de las Fases 22 a 36, incluyendo IA de Moderación y Ecosistemas de Plugins.

---

## 📄 Licencia
Este proyecto es código abierto y está disponible bajo los términos de la licencia especificada en el repositorio.