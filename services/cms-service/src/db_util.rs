use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn set_session_context(
    tx: &mut Transaction<'_, Postgres>,
    user_id: Option<Uuid>,
    org_id: Option<Uuid>,
    ip_address: Option<String>,
    user_agent: Option<String>,
    event_type: Option<String>,
) -> Result<(), sqlx::Error> {
    if let Some(uid) = user_id {
        let _ = sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(uid.to_string())
            .execute(&mut **tx)
            .await?;
    }
    if let Some(oid) = org_id {
        let _ = sqlx::query("SELECT set_config('app.current_org_id', $1, true)")
            .bind(oid.to_string())
            .execute(&mut **tx)
            .await?;
    }
    if let Some(ip) = ip_address {
        let _ = sqlx::query("SELECT set_config('app.client_ip', $1, true)")
            .bind(ip)
            .execute(&mut **tx)
            .await?;
    }
    if let Some(ua) = user_agent {
        let _ = sqlx::query("SELECT set_config('app.user_agent', $1, true)")
            .bind(ua)
            .execute(&mut **tx)
            .await?;
    }
    if let Some(et) = event_type {
        let _ = sqlx::query("SELECT set_config('app.event_type', $1, true)")
            .bind(et)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}
