-- Migration: Final Content Schema Alignment
-- Scope: lessons, modules

-- 1. Add missing columns to lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Add missing columns to modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Create Update Trigger for updated_at (if not already exists)
-- Function update_updated_at_column was defined in initial_schema.sql

-- Attach triggers to lessons and modules
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lessons_updated_at') THEN
        CREATE TRIGGER trg_lessons_updated_at
        BEFORE UPDATE ON lessons
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_modules_updated_at') THEN
        CREATE TRIGGER trg_modules_updated_at
        BEFORE UPDATE ON modules
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
