ALTER TABLE assets
ADD COLUMN IF NOT EXISTS zip_batch_id UUID,
ADD COLUMN IF NOT EXISTS source_zip_name TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_zip_batch_id
ON assets (organization_id, zip_batch_id)
WHERE zip_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_source_zip_name
ON assets (organization_id, source_zip_name)
WHERE source_zip_name IS NOT NULL;
