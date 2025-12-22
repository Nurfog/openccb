-- Add attempt limits and retry configuration to lessons
ALTER TABLE lessons ADD COLUMN max_attempts INTEGER;
ALTER TABLE lessons ADD COLUMN allow_retry BOOLEAN NOT NULL DEFAULT TRUE;
