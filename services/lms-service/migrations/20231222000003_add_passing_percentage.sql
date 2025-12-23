-- Add passing_percentage to courses (synced from CMS)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS passing_percentage INTEGER NOT NULL DEFAULT 70;

-- Ensure valid range
ALTER TABLE courses ADD CONSTRAINT check_passing_percentage CHECK (passing_percentage >= 0 AND passing_percentage <= 100);
