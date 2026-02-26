-- Add logo_variant to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_variant VARCHAR(20) DEFAULT 'standard';
COMMENT ON COLUMN organizations.logo_variant IS 'Header logo display style (standard or wide)';
