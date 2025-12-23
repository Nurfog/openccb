-- Add role column to users table for RBAC sync
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

-- Add check constraint
ALTER TABLE users ADD CONSTRAINT check_valid_role CHECK (role IN ('admin', 'instructor', 'student'));
