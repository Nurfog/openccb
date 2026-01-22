-- Migration: Add updated_at to user_grades
-- Required by fn_upsert_user_grade matching CMS-style upserts

ALTER TABLE user_grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
