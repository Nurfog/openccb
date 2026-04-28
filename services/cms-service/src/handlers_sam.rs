/// Manejadores de Integración con SAM (Sistema de Administración Académica)
/// 
/// Este módulo maneja la sincronización entre OpenCCB y el sistema externo SAM.
/// SAM tables: sige_sam_v3.alumnos, sige_sam_v3.detalle_contrato

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::handlers::Claims;
use crate::handlers::Org;

/// SAM Student info from external database
#[derive(Debug, Serialize, Deserialize)]
pub struct SamStudentInfo {
    pub id_alumno: String,
    pub nombre: String,
    pub email: String,
    pub telefono: Option<String>,
    pub activo: bool,
}

/// SAM Course Assignment from detalle_contrato
#[derive(Debug, Serialize, Deserialize)]
pub struct SamAssignmentInfo {
    pub id_contrato: String,
    pub id_alumno: String,
    pub id_curso_abierto: i32,
    pub estado: String,
}

/// Response for sync operation
#[derive(Debug, Serialize)]
pub struct SamSyncResponse {
    pub students_synced: usize,
    pub assignments_synced: usize,
    pub errors: Vec<String>,
}

/// Filters for SAM queries
#[derive(Debug, Deserialize)]
pub struct SamStudentFilters {
    pub email: Option<String>,
    pub nombre: Option<String>,
}

/// ==================== Manejadores de Sincronización SAM ====================

/// POST /api/sam/sync-students
/// Sincronizar estudiantes de sige_sam_v3.alumnos a la tabla de usuarios de OpenCCB
pub async fn sync_sam_students(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<SamSyncResponse>, (StatusCode, String)> {
    // Conectar a la base de datos externa de SAM
    let sam_url = std::env::var("SAM_DIAGNOSTICO_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "SAM_DIAGNOSTICO_DATABASE_URL no configurada".to_string()))?;

    let sam_pool = sqlx::PgPool::connect(&sam_url)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let mut errors = Vec::new();
    let mut students_synced = 0;

    // Obtener estudiantes activos de SAM usando una consulta genérica
    let rows = sqlx::query(
        r#"
        SELECT 
            id_alumno,
            nombre,
            email,
            telefono,
            activo
        FROM sige_sam_v3.alumnos
        WHERE activo = true AND email IS NOT NULL
        "#
    )
    .fetch_all(&sam_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Convertir a SamStudentInfo
    let sam_students: Vec<SamStudentInfo> = rows.iter().map(|row| {
        SamStudentInfo {
            id_alumno: row.get("id_alumno"),
            nombre: row.get("nombre"),
            email: row.get("email"),
            telefono: row.get::<Option<String>, _>("telefono"),
            activo: row.get("activo"),
        }
    }).collect();

    // Sincronizar cada estudiante con OpenCCB
    for sam_student in sam_students {
        // Comprobar si el usuario existe por correo electrónico
        let existing_user: Option<(Uuid, Option<String>)> = sqlx::query_as(
            "SELECT id, sam_student_id FROM users WHERE email = $1"
        )
        .bind(&sam_student.email)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            errors.push(format!("Error al comprobar el usuario {}: {}", sam_student.email, e));
            (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string())
        })
        .ok()
        .flatten();

        match existing_user {
            Some((user_id, _existing_sam_id)) => {
                // Actualizar usuario existente con información de SAM
                let update_result = sqlx::query(
                    r#"
                    UPDATE users 
                    SET sam_student_id = $1, 
                        is_sam_student = TRUE, 
                        sam_verified_at = NOW(),
                        full_name = COALESCE($2, full_name)
                    WHERE id = $3
                    "#
                )
                .bind(&sam_student.id_alumno)
                .bind(&sam_student.nombre)
                .bind(user_id)
                .execute(&pool)
                .await;

                if update_result.is_ok() {
                    students_synced += 1;
                } else {
                    errors.push(format!("Error al actualizar el usuario {}", sam_student.email));
                }
            }
            None => {
                // Crear nuevo usuario para el estudiante de SAM
                let insert_result = sqlx::query(
                    r#"
                    INSERT INTO users (
                        email, 
                        password_hash, 
                        full_name, 
                        role, 
                        organization_id,
                        sam_student_id,
                        is_sam_student,
                        sam_verified_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
                    RETURNING id
                    "#
                )
                .bind(&sam_student.email)
                .bind(format!("sam_managed_{}", sam_student.id_alumno)) // Contraseña provisional
                .bind(&sam_student.nombre)
                .bind("student")
                .bind(Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()) // Organización por defecto
                .bind(&sam_student.id_alumno)
                .fetch_optional(&pool)
                .await;

                match insert_result {
                    Ok(Some(_)) => students_synced += 1,
                    Ok(None) => errors.push(format!("Error al crear el usuario para {}", sam_student.email)),
                    Err(e) => errors.push(format!("Error al crear el usuario {}: {}", sam_student.email, e)),
                }
            }
        }
    }

    sam_pool.close().await;

    Ok(Json(SamSyncResponse {
        students_synced,
        assignments_synced: 0,
        errors,
    }))
}

/// POST /api/sam/sync-assignments
/// Sincronizar asignaciones de cursos desde sige_sam_v3.detalle_contrato
pub async fn sync_sam_assignments(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<SamSyncResponse>, (StatusCode, String)> {
    // Conectar a la base de datos externa de SAM
    let sam_url = std::env::var("SAM_DIAGNOSTICO_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "SAM_DIAGNOSTICO_DATABASE_URL no configurada".to_string()))?;

    let sam_pool = sqlx::PgPool::connect(&sam_url)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let mut errors = Vec::new();
    let mut assignments_synced = 0;

    // Obtener asignaciones de cursos activas de SAM
    let rows = sqlx::query(
        r#"
        SELECT 
            id_contrato,
            id_alumno,
            id_curso_abierto,
            estado
        FROM sige_sam_v3.detalle_contrato
        WHERE estado = 'activo' OR estado = 'vigente'
        "#
    )
    .fetch_all(&sam_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Convertir a SamAssignmentInfo
    let sam_assignments: Vec<SamAssignmentInfo> = rows.iter().map(|row| {
        SamAssignmentInfo {
            id_contrato: row.get("id_contrato"),
            id_alumno: row.get("id_alumno"),
            id_curso_abierto: row.get("id_curso_abierto"),
            estado: row.get("estado"),
        }
    }).collect();

    // Sincronizar cada asignación
    for assignment in sam_assignments {
        // Obtener el ID del curso de OpenCCB a partir del ID del curso SAM
        // Esto asume que tienes una tabla de mapeo o que el ID del curso SAM coincide con el external_id del curso en OpenCCB
        let course_result = sqlx::query_as::<_, (Uuid,)>(
            "SELECT id FROM courses WHERE external_sam_id = $1"
        )
        .bind(assignment.id_curso_abierto as i64)
        .fetch_optional(&pool)
        .await;

        let course_id = match course_result {
            Ok(Some((id,))) => Some(id),
            Ok(None) => None,
            Err(e) => {
                errors.push(format!("Error al encontrar el curso {}: {}", assignment.id_curso_abierto, e));
                continue;
            }
        };

        if let Some(course_id) = course_id {
            // Actualizar o insertar asignación
            let upsert_result = sqlx::query(
                r#"
                INSERT INTO sam_course_assignments (sam_student_id, sam_contrato_id, course_id, is_active, synced_at)
                VALUES ($1, $2, $3, TRUE, NOW())
                ON CONFLICT (sam_student_id, course_id) 
                DO UPDATE SET 
                    is_active = TRUE,
                    sam_contrato_id = EXCLUDED.sam_contrato_id,
                    synced_at = NOW()
                "#
            )
            .bind(&assignment.id_alumno)
            .bind(&assignment.id_contrato)
            .bind(course_id)
            .execute(&pool)
            .await;

            if upsert_result.is_ok() {
                assignments_synced += 1;
            } else {
                errors.push(format!("Error al sincronizar la asignación para el estudiante {}", assignment.id_alumno));
            }
        }
    }

    sam_pool.close().await;

    Ok(Json(SamSyncResponse {
        students_synced: 0,
        assignments_synced,
        errors,
    }))
}

/// GET /api/sam/students
/// Listar estudiantes de SAM con filtros opcionales
pub async fn list_sam_students(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Query(filters): Query<SamStudentFilters>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let mut query = r#"
        SELECT 
            u.id,
            u.email,
            u.full_name,
            u.sam_student_id,
            u.is_sam_student,
            u.sam_verified_at,
            u.created_at
        FROM users u
        WHERE u.is_sam_student = TRUE
    "#.to_string();

    if let Some(email) = filters.email {
        query.push_str(&format!(" AND u.email ILIKE '%{}%'", email));
    }

    if let Some(nombre) = filters.nombre {
        query.push_str(&format!(" AND u.full_name ILIKE '%{}%'", nombre));
    }

    query.push_str(" ORDER BY u.full_name");

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let students: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<Uuid, _>("id"),
            "email": row.get::<String, _>("email"),
            "full_name": row.get::<String, _>("full_name"),
            "sam_student_id": row.get::<String, _>("sam_student_id"),
            "is_sam_student": row.get::<bool, _>("is_sam_student"),
            "sam_verified_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("sam_verified_at"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        })
    }).collect();

    Ok(Json(students))
}

/// GET /api/sam/students/{student_id}/courses
/// Obtener cursos asignados a un estudiante SAM específico
pub async fn get_sam_student_courses(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
    Path(sam_student_id): Path<String>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"
        SELECT c.*, sca.is_active, sca.synced_at
        FROM courses c
        INNER JOIN sam_course_assignments sca ON c.id = sca.course_id
        WHERE sca.sam_student_id = $1 AND sca.is_active = TRUE
        ORDER BY c.title
        "#
    )
    .bind(&sam_student_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    let courses: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<Uuid, _>("id"),
            "title": row.get::<String, _>("title"),
            "description": row.get::<Option<String>, _>("description"),
            "is_active": row.get::<bool, _>("is_active"),
            "synced_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("synced_at"),
        })
    }).collect();

    Ok(Json(courses))
}

/// POST /api/sam/sync-all
/// Sincronización completa: estudiantes + asignaciones
pub async fn sync_all_sam(
    _org: Org,
    _claims: Claims,
    State(pool): State<PgPool>,
) -> Result<Json<SamSyncResponse>, (StatusCode, String)> {
    let mut errors = Vec::new();
    let mut students_synced = 0;
    let mut assignments_synced = 0;

    // Conectar a la base de datos externa de SAM
    let sam_url = std::env::var("SAM_DIAGNOSTICO_DATABASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "SAM_DIAGNOSTICO_DATABASE_URL no configurada".to_string()))?;

    let sam_pool = sqlx::PgPool::connect(&sam_url)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

    // Sincronizar estudiantes primero
    {
        // Obtener estudiantes activos de SAM
        let rows = sqlx::query(
            r#"
            SELECT id_alumno, nombre, email, telefono, activo
            FROM sige_sam_v3.alumnos
            WHERE activo = true AND email IS NOT NULL
            "#
        )
        .fetch_all(&sam_pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

        let sam_students: Vec<SamStudentInfo> = rows.iter().map(|row| {
            SamStudentInfo {
                id_alumno: row.get("id_alumno"),
                nombre: row.get("nombre"),
                email: row.get("email"),
                telefono: row.get::<Option<String>, _>("telefono"),
                activo: row.get("activo"),
            }
        }).collect();

        // Sincronizar cada estudiante
        for sam_student in sam_students {
            let existing_user: Option<(Uuid, Option<String>)> = sqlx::query_as(
                "SELECT id, sam_student_id FROM users WHERE email = $1"
            )
            .bind(&sam_student.email)
            .fetch_optional(&pool)
            .await
            .map_err(|e| {
                errors.push(format!("Error al comprobar el usuario {}: {}", sam_student.email, e));
                (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string())
            })
            .ok()
            .flatten();

            match existing_user {
                Some((user_id, _existing_sam_id)) => {
                    let update_result = sqlx::query(
                        "UPDATE users SET sam_student_id = $1, is_sam_student = TRUE, sam_verified_at = NOW(), full_name = COALESCE($2, full_name) WHERE id = $3"
                    )
                    .bind(&sam_student.id_alumno)
                    .bind(&sam_student.nombre)
                    .bind(user_id)
                    .execute(&pool)
                    .await;

                    if update_result.is_ok() { students_synced += 1; } else { errors.push(format!("Error al actualizar el usuario {}", sam_student.email)); }
                }
                None => {
                    let insert_result = sqlx::query(
                        "INSERT INTO users (email, password_hash, full_name, role, organization_id, sam_student_id, is_sam_student, sam_verified_at) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW()) RETURNING id"
                    )
                    .bind(&sam_student.email)
                    .bind(format!("sam_managed_{}", sam_student.id_alumno))
                    .bind(&sam_student.nombre)
                    .bind("student")
                    .bind(Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
                    .bind(&sam_student.id_alumno)
                    .fetch_optional(&pool)
                    .await;

                    match insert_result {
                        Ok(Some(_)) => students_synced += 1,
                        Ok(None) => errors.push(format!("Error al crear el usuario para {}", sam_student.email)),
                        Err(e) => errors.push(format!("Error al crear el usuario {}: {}", sam_student.email, e)),
                    }
                }
            }
        }
    }

    // Sincronizar asignaciones
    {
        let rows = sqlx::query(
            "SELECT id_contrato, id_alumno, id_curso_abierto, estado FROM sige_sam_v3.detalle_contrato WHERE estado = 'activo' OR estado = 'vigente'"
        )
        .fetch_all(&sam_pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".to_string()))?;

        let sam_assignments: Vec<SamAssignmentInfo> = rows.iter().map(|row| {
            SamAssignmentInfo {
                id_contrato: row.get("id_contrato"),
                id_alumno: row.get("id_alumno"),
                id_curso_abierto: row.get("id_curso_abierto"),
                estado: row.get("estado"),
            }
        }).collect();

        for assignment in sam_assignments {
            let course_result = sqlx::query_as::<_, (Uuid,)>(
                "SELECT id FROM courses WHERE external_sam_id = $1"
            )
            .bind(assignment.id_curso_abierto as i64)
            .fetch_optional(&pool)
            .await;

            let course_id = match course_result {
                Ok(Some((id,))) => Some(id),
                Ok(None) => continue,
                Err(e) => { errors.push(format!("Error al encontrar el curso {}: {}", assignment.id_curso_abierto, e)); continue; }
            };

            if let Some(course_id) = course_id {
                let upsert_result = sqlx::query(
                    "INSERT INTO sam_course_assignments (sam_student_id, sam_contrato_id, course_id, is_active, synced_at) VALUES ($1, $2, $3, TRUE, NOW()) ON CONFLICT (sam_student_id, course_id) DO UPDATE SET is_active = TRUE, sam_contrato_id = EXCLUDED.sam_contrato_id, synced_at = NOW()"
                )
                .bind(&assignment.id_alumno)
                .bind(&assignment.id_contrato)
                .bind(course_id)
                .execute(&pool)
                .await;

                if upsert_result.is_ok() { assignments_synced += 1; } else { errors.push(format!("Error al sincronizar la asignación para el estudiante {}", assignment.id_alumno)); }
            }
        }
    }

    sam_pool.close().await;

    Ok(Json(SamSyncResponse {
        students_synced,
        assignments_synced,
        errors,
    }))
}
