CREATE TABLE IF NOT EXISTS organization_email_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL DEFAULT 'smtp',
    provider_key TEXT NOT NULL DEFAULT 'custom',
    display_name TEXT NOT NULL DEFAULT 'SMTP principal',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    smtp_host TEXT,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_from TEXT,
    smtp_username TEXT,
    smtp_password TEXT,
    smtp_starttls BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_email_services_org_id ON organization_email_services(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_email_services_default_per_org
    ON organization_email_services(organization_id)
    WHERE is_default = TRUE;

INSERT INTO organization_email_services (
    organization_id,
    service_type,
    provider_key,
    display_name,
    is_enabled,
    is_default,
    smtp_host,
    smtp_port,
    smtp_from,
    smtp_username,
    smtp_password,
    smtp_starttls,
    created_at,
    updated_at
)
SELECT
    s.organization_id,
    'smtp',
    'custom',
    'SMTP principal',
    s.smtp_enabled,
    TRUE,
    s.smtp_host,
    s.smtp_port,
    s.smtp_from,
    s.smtp_username,
    s.smtp_password,
    s.smtp_starttls,
    NOW(),
    NOW()
FROM organization_email_settings s
LEFT JOIN organization_email_services es
    ON es.organization_id = s.organization_id
WHERE es.id IS NULL;
