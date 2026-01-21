-- Add API key column to organizations table for external API authentication
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS api_key UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_api_key ON organizations(api_key);
