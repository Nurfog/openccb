-- Fase 39: Campos AGS (OAuth2 Assignment and Grade Services) en lti_external_tools
-- Modo dual: HMAC legacy + AGS nuevo (ambos soportados simultáneamente)
ALTER TABLE lti_external_tools
    ADD COLUMN IF NOT EXISTS ags_client_id    TEXT,
    ADD COLUMN IF NOT EXISTS ags_client_secret TEXT,
    ADD COLUMN IF NOT EXISTS ags_token_url    TEXT,
    ADD COLUMN IF NOT EXISTS ags_lineitem_url  TEXT;

-- Cache de access tokens OAuth2 AGS para evitar llamadas repetidas
CREATE TABLE IF NOT EXISTS lti_ags_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id     UUID NOT NULL REFERENCES lti_external_tools(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lti_ags_tokens_tool ON lti_ags_tokens(tool_id);
