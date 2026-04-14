-- Add certificate generation toggle to organization exercise settings
-- Allows organizations to disable built-in certificate generation if using external systems

ALTER TABLE organization_exercise_settings
    ADD COLUMN IF NOT EXISTS certificates_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS certificates_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN organization_exercise_settings.certificates_enabled 
    IS 'Enable/disable built-in certificate generation. When false, students cannot generate/download certificates from the platform.';

COMMENT ON COLUMN organizations.certificates_enabled 
    IS 'Enable/disable built-in certificate generation. When false, students cannot generate/download certificates from the platform.';
