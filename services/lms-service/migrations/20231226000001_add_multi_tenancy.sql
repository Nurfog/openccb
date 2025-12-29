-- Migration: Add Multi-Tenancy Support (LMS)
-- Based on existing schema: users, courses, enrollments

-- 1. Create organizations table (Mirrors CMS structure)
CREATE TABLE organizations (
    id UUID PRIMARY KEY, -- ID synced from CMS
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create default organization
INSERT INTO organizations (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization');

-- 3. Add organization_id to tables
ALTER TABLE users ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE courses ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE enrollments ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- 4. Add Foreign Keys
ALTER TABLE users ADD CONSTRAINT fk_user_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE courses ADD CONSTRAINT fk_course_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT fk_enrollment_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 5. Remove default values
ALTER TABLE users ALTER COLUMN organization_id DROP DEFAULT;
ALTER TABLE courses ALTER COLUMN organization_id DROP DEFAULT;
ALTER TABLE enrollments ALTER COLUMN organization_id DROP DEFAULT;

-- 6. Update Unique Constraints for Users
-- Drop global unique email constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Add composite unique index
CREATE UNIQUE INDEX users_organization_id_email_idx ON users (organization_id, lower(email));