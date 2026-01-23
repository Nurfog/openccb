-- Migration: Add Platform Name and Favicon to Organizations
-- Adds fields for white-labeling the platform name and favicon

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS platform_name TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN organizations.platform_name IS 'Custom name for the platform (e.g., "My Company Academy")';
COMMENT ON COLUMN organizations.favicon_url IS 'URL path to organization favicon (stored in /uploads/org-favicons/)';
