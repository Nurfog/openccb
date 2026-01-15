-- Migration: Add branding columns to organizations table
-- Adds columns that exist in CMS but were missing in LMS

ALTER TABLE organizations 
ADD COLUMN domain VARCHAR(255),
ADD COLUMN logo_url TEXT,
ADD COLUMN primary_color VARCHAR(7),
ADD COLUMN secondary_color VARCHAR(7),
ADD COLUMN certificate_template TEXT;
