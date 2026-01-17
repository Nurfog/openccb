-- Migration: Add SSO Configuration support for organizations
CREATE TABLE IF NOT EXISTS organization_sso_configs (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    issuer_url TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance (already PRIMARY KEY, but let's be explicit if needed)
CREATE INDEX IF NOT EXISTS sso_configs_org_id_idx ON organization_sso_configs (organization_id);

-- Migration: Add temporary storage for OIDC states
CREATE TABLE IF NOT EXISTS sso_states (
    state_token TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nonce TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cleanup old states after 1 hour (intended for batch cleanup, but table is small anyway)
CREATE INDEX IF NOT EXISTS sso_states_created_at_idx ON sso_states (created_at);
