-- Migration: Add Multi-Tenancy Support (CMS)
-- Based on existing schema: users, courses, assets, audit_logs

-- 1. Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create a default organization for existing data
INSERT INTO organizations (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization');

-- 3. Add organization_id to tables with default value for existing rows
ALTER TABLE users ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE courses ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE assets ADD COLUMN organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE audit_logs ADD COLUMN organization_id UUID; -- Nullable for system logs or pre-migration logs

-- 4. Add Foreign Keys
ALTER TABLE users ADD CONSTRAINT fk_user_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE courses ADD CONSTRAINT fk_course_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE assets ADD CONSTRAINT fk_asset_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_log_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- 5. Remove default values for future inserts (enforce explicit organization)
ALTER TABLE users ALTER COLUMN organization_id DROP DEFAULT;
ALTER TABLE courses ALTER COLUMN organization_id DROP DEFAULT;
ALTER TABLE assets ALTER COLUMN organization_id DROP DEFAULT;

-- 6. Update Unique Constraints for Users
-- Drop the global unique email constraint (created implicitly by UNIQUE in 20231219000003_users_table.sql)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Add composite unique index scoped to organization
CREATE UNIQUE INDEX users_organization_id_email_idx ON users (organization_id, lower(email));

-- 7. Update Audit Logs to backfill organization based on user (optional best effort)
UPDATE audit_logs SET organization_id = u.organization_id FROM users u WHERE audit_logs.user_id = u.id;