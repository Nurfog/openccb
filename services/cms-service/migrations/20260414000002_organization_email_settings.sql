CREATE TABLE IF NOT EXISTS organization_email_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    smtp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    smtp_host TEXT,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_from TEXT,
    smtp_username TEXT,
    smtp_password TEXT,
    smtp_starttls BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_email_settings_org_id ON organization_email_settings(organization_id);
