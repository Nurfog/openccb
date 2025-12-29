-- Migration: Add Organization Branding Support
-- Adds fields for logo, colors, and certificate customization
-- Note: organizations table already exists from 20250116100000_add_multi_tenancy.sql

-- Add branding fields to organizations table (only if they don't exist)
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#8B5CF6',
  ADD COLUMN IF NOT EXISTS certificate_template TEXT;

-- Add index for performance on logo lookups
CREATE INDEX IF NOT EXISTS idx_organizations_logo ON organizations(logo_url) WHERE logo_url IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN organizations.logo_url IS 'URL path to organization logo (stored in /uploads/org-logos/)';
COMMENT ON COLUMN organizations.primary_color IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN organizations.secondary_color IS 'Secondary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN organizations.certificate_template IS 'Custom certificate template (future use)';
