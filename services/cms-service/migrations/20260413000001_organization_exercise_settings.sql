CREATE TABLE IF NOT EXISTS organization_exercise_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    audio_response_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    hotspot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    memory_match_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    peer_review_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    role_playing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    mermaid_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    code_lab_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_exercise_settings_updated_at
    ON organization_exercise_settings (updated_at DESC);
