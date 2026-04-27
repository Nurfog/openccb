ALTER TABLE courses
ADD COLUMN IF NOT EXISTS external_sam_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_courses_org_external_sam_id
ON courses (organization_id, external_sam_id)
WHERE external_sam_id IS NOT NULL;
