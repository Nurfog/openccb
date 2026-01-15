-- Migration: Fix organizations table for registration
-- Adds default UUID generation and unique constraint on name

ALTER TABLE organizations ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_name_key') THEN
        ALTER TABLE organizations ADD CONSTRAINT organizations_name_key UNIQUE (name);
    END IF;
END $$;
