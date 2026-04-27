/// Salas de Estudio con BigBlueButton (Fase 38)
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use common::{auth::Claims, middleware::Org};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use uuid::Uuid;

// ─── Helpers BBB ─────────────────────────────────────────────────────────────

fn bbb_base_url() -> String {
    std::env::var("BBB_URL").unwrap_or_else(|_| "https://bbb.example.com/bigbluebutton/api".to_string())
}

fn bbb_secret() -> String {
    std::env::var("BBB_SECRET").unwrap_or_else(|_| "changeme".to_string())
}

/// Calcula el checksum BBB: SHA256(action + params_string + secret)
fn bbb_checksum(action: &str, params: &str) -> String {
    let input = format!("{}{}{}", action, params, bbb_secret());
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Construye URL BBB con checksum incluido
fn bbb_url(action: &str, params: &str) -> String {
    let checksum = bbb_checksum(action, params);
    let base = bbb_base_url();
    if params.is_empty() {
        format!("{}/{}?checksum={}", base, action, checksum)
    } else {
        format!("{}/{}?{}&checksum={}", base, action, params, checksum)
    }
}

// ─── Modelos ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct StudyRoom {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub course_id: Uuid,
    pub created_by: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub bbb_meeting_id: Option<String>,
    pub join_url: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub max_participants: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStudyRoomPayload {
    pub title: String,
    pub description: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub max_participants: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct JoinStudyRoomResponse {
    pub room_id: Uuid,
    pub join_url: String,
}

#[derive(Debug, Serialize)]
pub struct EndStudyRoomResponse {
    pub room_id: Uuid,
    pub ended_at: DateTime<Utc>,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

pub async fn list_course_study_rooms(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<StudyRoom>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"
        SELECT id, organization_id, course_id, created_by, title, description, status,
               bbb_meeting_id, join_url, scheduled_at, started_at, ended_at,
               max_participants, created_at, updated_at
        FROM study_rooms
        WHERE course_id = $1 AND organization_id = $2
        ORDER BY created_at DESC
        "#,
    )
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let rooms = rows
        .into_iter()
        .map(|r| StudyRoom {
            id: r.get("id"),
            organization_id: r.get("organization_id"),
            course_id: r.get("course_id"),
            created_by: r.get("created_by"),
            title: r.get("title"),
            description: r.get("description"),
            status: r.get("status"),
            bbb_meeting_id: r.get("bbb_meeting_id"),
            join_url: r.get("join_url"),
            scheduled_at: r.get("scheduled_at"),
            started_at: r.get("started_at"),
            ended_at: r.get("ended_at"),
            max_participants: r.get("max_participants"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect();

    Ok(Json(rooms))
}

pub async fn create_study_room(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path(course_id): Path<Uuid>,
    Json(payload): Json<CreateStudyRoomPayload>,
) -> Result<(StatusCode, Json<StudyRoom>), (StatusCode, String)> {
    if payload.title.trim().is_empty() {
        return Err((StatusCode::UNPROCESSABLE_ENTITY, "El título es requerido".to_string()));
    }

    let meeting_id = Uuid::new_v4().to_string();

    // Generar contraseñas aleatorias de 12 chars
    use rand::Rng;
    let attendee_pw: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(12)
        .map(char::from)
        .collect();
    let moderator_pw: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(12)
        .map(char::from)
        .collect();

    // Llamar a BBB create
    let course_name_enc = urlencoding::encode(&payload.title).to_string();
    let params = format!(
        "meetingID={}&name={}&attendeePW={}&moderatorPW={}&record=false&autoStartRecording=false&allowStartStopRecording=false",
        urlencoding::encode(&meeting_id),
        course_name_enc,
        urlencoding::encode(&attendee_pw),
        urlencoding::encode(&moderator_pw),
    );
    let create_url = bbb_url("create", &params);

    let bbb_internal_id: Option<String> = match reqwest::Client::new()
        .get(&create_url)
        .send()
        .await
    {
        Ok(resp) => {
            let body = resp.text().await.unwrap_or_default();
            // Extraer internalMeetingID del XML de respuesta
            body.split("<internalMeetingID>")
                .nth(1)
                .and_then(|s| s.split("</internalMeetingID>").next())
                .map(|s| s.to_string())
        }
        Err(e) => {
            tracing::warn!("create_study_room: BBB create failed (continuing): {}", e);
            None
        }
    };

    let now = Utc::now();
    let row = sqlx::query(
        r#"
        INSERT INTO study_rooms (
            organization_id, course_id, created_by, title, description,
            status, bbb_meeting_id, bbb_internal_id, attendee_pw, moderator_pw,
            scheduled_at, max_participants, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $12, $12)
        RETURNING id, organization_id, course_id, created_by, title, description, status,
                  bbb_meeting_id, join_url, scheduled_at, started_at, ended_at,
                  max_participants, created_at, updated_at
        "#,
    )
    .bind(org_ctx.id)
    .bind(course_id)
    .bind(claims.sub)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&meeting_id)
    .bind(&bbb_internal_id)
    .bind(&attendee_pw)
    .bind(&moderator_pw)
    .bind(payload.scheduled_at)
    .bind(payload.max_participants.unwrap_or(50))
    .bind(now)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(StudyRoom {
            id: row.get("id"),
            organization_id: row.get("organization_id"),
            course_id: row.get("course_id"),
            created_by: row.get("created_by"),
            title: row.get("title"),
            description: row.get("description"),
            status: row.get("status"),
            bbb_meeting_id: row.get("bbb_meeting_id"),
            join_url: row.get("join_url"),
            scheduled_at: row.get("scheduled_at"),
            started_at: row.get("started_at"),
            ended_at: row.get("ended_at"),
            max_participants: row.get("max_participants"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }),
    ))
}

pub async fn join_study_room(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, room_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<JoinStudyRoomResponse>, (StatusCode, String)> {
    #[derive(sqlx::FromRow)]
    struct RoomRow {
        bbb_meeting_id: Option<String>,
        attendee_pw: Option<String>,
        moderator_pw: Option<String>,
        status: String,
        created_by: Uuid,
    }

    let room = sqlx::query_as::<_, RoomRow>(
        "SELECT bbb_meeting_id, attendee_pw, moderator_pw, status, created_by FROM study_rooms WHERE id = $1 AND course_id = $2 AND organization_id = $3",
    )
    .bind(room_id)
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Sala no encontrada".to_string()))?;

    if room.status == "ended" {
        return Err((StatusCode::GONE, "La sala ya ha finalizado".to_string()));
    }

    let meeting_id = room.bbb_meeting_id.as_deref().unwrap_or("");

    // El creador entra como moderador; el resto como asistente
    let is_moderator = claims.sub == room.created_by;
    let password = if is_moderator {
        room.moderator_pw.as_deref().unwrap_or("")
    } else {
        room.attendee_pw.as_deref().unwrap_or("")
    };

    let display_name = format!("Usuario {}", &claims.sub.to_string()[..8]);
    let params = format!(
        "meetingID={}&fullName={}&password={}&redirect=true",
        urlencoding::encode(meeting_id),
        urlencoding::encode(&display_name),
        urlencoding::encode(password),
    );
    let join_url = bbb_url("join", &params);

    // Marcar sala como activa en el primer join si estaba pending
    if room.status == "pending" {
        let _ = sqlx::query(
            "UPDATE study_rooms SET status = 'active', started_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(room_id)
        .execute(&pool)
        .await;
    }

    Ok(Json(JoinStudyRoomResponse {
        room_id,
        join_url,
    }))
}

pub async fn end_study_room(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, room_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<EndStudyRoomResponse>, (StatusCode, String)> {
    #[derive(sqlx::FromRow)]
    struct RoomRow {
        bbb_meeting_id: Option<String>,
        moderator_pw: Option<String>,
        created_by: Uuid,
    }

    let room = sqlx::query_as::<_, RoomRow>(
        "SELECT bbb_meeting_id, moderator_pw, created_by FROM study_rooms WHERE id = $1 AND course_id = $2 AND organization_id = $3",
    )
    .bind(room_id)
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Sala no encontrada".to_string()))?;

    // Solo el creador puede terminar la sala
    if claims.sub != room.created_by {
        return Err((StatusCode::FORBIDDEN, "Solo el creador puede terminar la sala".to_string()));
    }

    // Llamar a BBB end
    if let Some(meeting_id) = &room.bbb_meeting_id {
        let params = format!(
            "meetingID={}&password={}",
            urlencoding::encode(meeting_id),
            urlencoding::encode(room.moderator_pw.as_deref().unwrap_or("")),
        );
        let end_url = bbb_url("end", &params);
        if let Err(e) = reqwest::Client::new().get(&end_url).send().await {
            tracing::warn!("end_study_room: BBB end call failed (continuing): {}", e);
        }
    }

    let now = Utc::now();
    sqlx::query(
        "UPDATE study_rooms SET status = 'ended', ended_at = $1, updated_at = $1 WHERE id = $2",
    )
    .bind(now)
    .bind(room_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(EndStudyRoomResponse {
        room_id,
        ended_at: now,
    }))
}

pub async fn delete_study_room(
    Org(org_ctx): Org,
    claims: Claims,
    State(pool): State<PgPool>,
    Path((course_id, room_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let created_by = sqlx::query_scalar::<_, Uuid>(
        "SELECT created_by FROM study_rooms WHERE id = $1 AND course_id = $2 AND organization_id = $3",
    )
    .bind(room_id)
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Sala no encontrada".to_string()))?;

    if claims.sub != created_by {
        return Err((StatusCode::FORBIDDEN, "Solo el creador puede eliminar la sala".to_string()));
    }

    sqlx::query("DELETE FROM study_rooms WHERE id = $1")
        .bind(room_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

// ─── Grabaciones BBB (Fase 39) ───────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct BbbRecording {
    pub record_id: String,
    pub meeting_id: String,
    pub name: String,
    pub state: String,
    pub start_time: i64,
    pub end_time: i64,
    pub participants: i64,
    pub playback_url: Option<String>,
    pub duration_minutes: i64,
}

pub async fn get_study_room_recordings(
    Org(org_ctx): Org,
    State(pool): State<PgPool>,
    Path((course_id, room_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<BbbRecording>>, (StatusCode, String)> {
    let bbb_meeting_id = sqlx::query_scalar::<_, Option<String>>(
        "SELECT bbb_meeting_id FROM study_rooms WHERE id = $1 AND course_id = $2 AND organization_id = $3",
    )
    .bind(room_id)
    .bind(course_id)
    .bind(org_ctx.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .flatten()
    .ok_or((StatusCode::NOT_FOUND, "Sala no encontrada o sin ID BBB".to_string()))?;

    let params = format!("meetingID={}", urlencoding::encode(&bbb_meeting_id));
    let url = bbb_url("getRecordings", &params);

    let xml_body = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("BBB getRecordings falló: {}", e)))?
        .text()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    let recordings = parse_bbb_recordings(&xml_body);
    Ok(Json(recordings))
}

/// Parsea el XML de BBB getRecordings extrayendo los campos relevantes.
fn parse_bbb_recordings(xml: &str) -> Vec<BbbRecording> {
    let mut recordings = Vec::new();

    for recording_block in xml.split("<recording>").skip(1) {
        let get = |tag: &str| -> String {
            recording_block
                .split(&format!("<{}>", tag))
                .nth(1)
                .and_then(|s| s.split(&format!("</{}>", tag)).next())
                .unwrap_or("")
                .trim()
                .to_string()
        };

        let get_i64 = |tag: &str| -> i64 {
            get(tag).parse::<i64>().unwrap_or(0)
        };

        let start_time = get_i64("startTime");
        let end_time = get_i64("endTime");
        let duration_minutes = if end_time > start_time {
            (end_time - start_time) / 60_000
        } else {
            0
        };

        // Buscar URL de reproducción presentación/video
        let playback_url = recording_block
            .split("<url>")
            .nth(1)
            .and_then(|s| s.split("</url>").next())
            .map(|s| s.trim().to_string());

        recordings.push(BbbRecording {
            record_id: get("recordID"),
            meeting_id: get("meetingID"),
            name: get("name"),
            state: get("state"),
            start_time,
            end_time,
            participants: get_i64("participants"),
            playback_url,
            duration_minutes,
        });
    }

    recordings
}
