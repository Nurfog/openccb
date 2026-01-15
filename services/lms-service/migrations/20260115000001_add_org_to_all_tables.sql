-- Migration: Add organization_id to remaining content tables (LMS)
-- Tables: modules, lessons, grading_categories, user_grades, user_badges, points_log

-- 1. Add organization_id to modules
ALTER TABLE modules ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE modules ADD CONSTRAINT fk_module_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE modules ALTER COLUMN organization_id DROP DEFAULT;

-- 2. Add organization_id to lessons
ALTER TABLE lessons ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE lessons ADD CONSTRAINT fk_lesson_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE lessons ALTER COLUMN organization_id DROP DEFAULT;

-- 3. Add organization_id to grading_categories
ALTER TABLE grading_categories ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE grading_categories ADD CONSTRAINT fk_grading_category_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE grading_categories ALTER COLUMN organization_id DROP DEFAULT;

-- 4. Add organization_id to user_grades
ALTER TABLE user_grades ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE user_grades ADD CONSTRAINT fk_user_grade_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE user_grades ALTER COLUMN organization_id DROP DEFAULT;

-- 5. Add organization_id to user_badges
ALTER TABLE user_badges ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE user_badges ADD CONSTRAINT fk_user_badge_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE user_badges ALTER COLUMN organization_id DROP DEFAULT;

-- 6. Add organization_id to points_log
ALTER TABLE points_log ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE points_log ADD CONSTRAINT fk_points_log_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE points_log ALTER COLUMN organization_id DROP DEFAULT;
