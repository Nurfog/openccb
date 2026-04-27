#![allow(dead_code)]

use utoipa::OpenApi;

#[derive(utoipa::ToSchema, serde::Serialize, serde::Deserialize)]
pub struct ExternalCreateCoursePayloadSchema {
    /// Obligatorio. No debe ser vacío.
    pub title: String,
    /// Opcional: puede omitirse o enviarse como `null`.
    pub description: Option<String>,
    /// Opcional: puede omitirse o enviarse como `null`.
    pub pacing_mode: Option<String>,
    /// Opcional: idCursoAbierto del sistema SAM.
    /// También se acepta como `idcursoabierto` o `id_curso_abierto` en el payload real.
    pub external_sam_id: Option<i64>,
    /// Opcional: UUID de plantilla específica.
    pub template_id: Option<String>,
    /// Opcional: fallback de selección de plantilla por nivel.
    pub template_level: Option<String>,
    /// Opcional: fallback de selección de plantilla por tipo de curso.
    pub template_course_type: Option<String>,
    /// Opcional: fallback de selección de plantilla por tipo de test.
    pub template_test_type: Option<String>,
    /// Opcional: título del módulo creado al aplicar plantilla.
    pub module_title: Option<String>,
    /// Opcional: título de la lección creada al aplicar plantilla.
    pub lesson_title: Option<String>,
}

#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct ExternalCourseEnvelopeSchema {
    pub course: serde_json::Value,
    pub template_applied: bool,
    pub template_id: Option<String>,
    pub lesson_id: Option<String>,
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "OpenCCB CMS API",
        version = "1.0.0",
        description = "API del CMS para gestión interna y endpoints externos por API key.\n\nReglas de nulabilidad y arreglos (aplican a todos los endpoints de esta API):\n- Campos opcionales (Option): pueden omitirse o enviarse como null.\n- Campos de arreglo no opcionales (Vec): deben enviarse como arreglo; pueden ser [] pero no null.\n- Objetos requeridos del payload: no deben enviarse como null."
    ),
    paths(
        create_course_external,
        get_course_external,
        trigger_transcription_external,
    ),
    components(
        schemas(
            ExternalCreateCoursePayloadSchema,
            ExternalCourseEnvelopeSchema,
        )
    ),
    tags(
        (name = "External", description = "Integración externa del CMS")
    )
)]
pub struct ApiDoc;

#[utoipa::path(
    post,
    path = "/api/external/v1/courses",
    tag = "External",
    request_body = ExternalCreateCoursePayloadSchema,
    responses(
        (status = 200, description = "Curso creado exitosamente"),
        (status = 400, description = "Payload inválido o plantilla no encontrada"),
        (status = 401, description = "X-API-Key inválida o ausente"),
        (status = 500, description = "Error interno del servidor")
    ),
    security(("ApiKey" = []))
)]
pub fn create_course_external() {}

#[utoipa::path(
    get,
    path = "/api/external/v1/courses/{id}",
    tag = "External",
    params(
        ("id" = String, Path, description = "UUID del curso")
    ),
    responses(
        (status = 200, description = "Curso encontrado"),
        (status = 401, description = "X-API-Key inválida o ausente"),
        (status = 404, description = "Curso no encontrado")
    ),
    security(("ApiKey" = []))
)]
pub fn get_course_external() {}

#[utoipa::path(
    post,
    path = "/api/external/v1/lessons/{id}/transcribe",
    tag = "External",
    params(
        ("id" = String, Path, description = "UUID de la lección")
    ),
    responses(
        (status = 202, description = "Transcripción encolada"),
        (status = 401, description = "X-API-Key inválida o ausente"),
        (status = 404, description = "Lección no encontrada")
    ),
    security(("ApiKey" = []))
)]
pub fn trigger_transcription_external() {}
