-- Migration: Add uploaded_by to assets table
ALTER TABLE assets ADD COLUMN uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for performance when filtering by uploader
CREATE INDEX idx_assets_uploaded_by ON assets(uploaded_by);
