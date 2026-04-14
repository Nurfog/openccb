-- Add certificates_enabled flag to organizations table in LMS
-- This is synced from CMS exercise_settings when organization data is ingested

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS certificates_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN organizations.certificates_enabled 
    IS 'Whether built-in certificate generation is enabled for this organization (synced from CMS).';
