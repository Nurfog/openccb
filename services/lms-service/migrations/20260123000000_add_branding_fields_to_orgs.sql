-- Add missing branding columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS platform_name TEXT,
ADD COLUMN IF NOT EXISTS favicon_url TEXT;
