use sqlx::{Postgres, Transaction};

pub async fn set_session_context(
    tx: &mut Transaction<'_, Postgres>,
    user_id: Option<uuid::Uuid>,
    org_id: Option<uuid::Uuid>,
    ip: Option<String>,
    ua: Option<String>,
    event_type: Option<String>,
) -> Result<(), sqlx::Error> {
    if let Some(uid) = user_id {
        sqlx::query(&format!("SET LOCAL app.current_user_id = '{}'", uid))
            .execute(&mut **tx)
            .await?;
    }
    if let Some(oid) = org_id {
        sqlx::query(&format!("SET LOCAL app.current_org_id = '{}'", oid))
            .execute(&mut **tx)
            .await?;
    }
    if let Some(ip_addr) = ip {
        sqlx::query(&format!("SET LOCAL app.client_ip = '{}'", ip_addr))
            .execute(&mut **tx)
            .await?;
    }
    if let Some(user_agent) = ua {
        // Use set_config for potentially long strings to avoid SQL injection/formatting issues
        sqlx::query("SELECT set_config('app.user_agent', $1, true)")
            .bind(user_agent)
            .execute(&mut **tx)
            .await?;
    }
    if let Some(et) = event_type {
        sqlx::query("SELECT set_config('app.event_type', $1, true)")
            .bind(et)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}
