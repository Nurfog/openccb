
pub async fn update_module(
    claims: common::auth::Claims,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Module>, StatusCode> {
    let title = payload.get("title").and_then(|t| t.as_str());
    let position = payload.get("position").and_then(|v| v.as_i64()).map(|v| v as i32);

    let updated_module = sqlx::query_as::<_, Module>(
        "UPDATE modules 
         SET title = COALESCE($1, title), 
             position = COALESCE($2, position)
         WHERE id = $3 RETURNING *"
    )
    .bind(title)
    .bind(position)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Update module failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log_action(&pool, claims.sub, "UPDATE", "Module", id, json!(payload)).await;

    Ok(Json(updated_module))
}
