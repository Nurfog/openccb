-- Migration: Add organization_id to content tables
-- Scope: modules, lessons, grading_categories

-- 1. Add organization_id to modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill modules based on course
UPDATE modules m SET organization_id = c.organization_id 
FROM courses c WHERE m.course_id = c.id AND m.organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
ALTER TABLE modules ALTER COLUMN organization_id SET NOT NULL;

-- 2. Add organization_id to lessons
-- Note: lessons are children of modules, which now have organization_id
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill lessons based on module
UPDATE lessons l SET organization_id = m.organization_id 
FROM modules m WHERE l.module_id = m.id AND l.organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
ALTER TABLE lessons ALTER COLUMN organization_id SET NOT NULL;

-- 3. Add organization_id to grading_categories
ALTER TABLE grading_categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill grading_categories based on course
UPDATE grading_categories g SET organization_id = c.organization_id 
FROM courses c WHERE g.course_id = c.id AND g.organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
ALTER TABLE grading_categories ALTER COLUMN organization_id SET NOT NULL;

-- 4. Re-create triggers to ensure they pick up the new columns for audit logs
-- (Triggers were already defined in 20260111000002_advanced_auditing.sql)
-- No changes needed to the triggers themselves as they use NEW.organization_id dynamically.
