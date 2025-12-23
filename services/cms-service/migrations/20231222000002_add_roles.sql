-- Add role column to users table for RBAC
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'instructor';

-- Add check constraint to ensure only valid roles are used
ALTER TABLE users ADD CONSTRAINT check_valid_role CHECK (role IN ('admin', 'instructor', 'student'));

-- Note: In the Studio (CMS), we'll typically have admins and instructors.
-- In the Experience (LMS), we'll have students, but also need to sync roles.
