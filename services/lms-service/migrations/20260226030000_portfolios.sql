-- Migration: Portfolios & Badges (Adjustments)
-- This migration adjusts existing gamification tables to support the new features

-- 1. Adjust badges table
ALTER TABLE badges ADD COLUMN IF NOT EXISTS criteria JSONB NOT NULL DEFAULT '{}';
-- Ensure organization_id has a foreign key if it's missing (optional but good)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'badges_organization_id_fkey') THEN
        ALTER TABLE badges ADD CONSTRAINT badges_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
    END IF;
END $$;

-- 2. Adjust user_badges table
ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS evidence_url TEXT;
-- Rename earned_at to awarded_at if needed, or just use earned_at in code.
-- The model currently expects awarded_at. Let's rename if exists.
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_badges' AND column_name='earned_at') THEN
        ALTER TABLE user_badges RENAME COLUMN earned_at TO awarded_at;
    END IF;
END $$;

-- 3. Add profile visibility to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_url TEXT;

-- 4. Seed some extra default badges if not present
INSERT INTO badges (organization_id, name, description, icon_url, requirement_type, requirement_value)
SELECT id, 'Open Source Contributor', 'Linked a GitHub account to your profile', '/badges/github.svg', 'points', 0
FROM organizations 
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = 'Open Source Contributor')
LIMIT 1;

INSERT INTO badges (organization_id, name, description, icon_url, requirement_type, requirement_value)
SELECT id, 'Networking Pro', 'Linked a LinkedIn account to your profile', '/badges/linkedin.svg', 'points', 0
FROM organizations 
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name = 'Networking Pro')
LIMIT 1;
