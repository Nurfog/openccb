-- Phase 5: Course Pacing and Dates

-- Add pacing_mode to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pacing_mode VARCHAR(50) NOT NULL DEFAULT 'self_paced';

-- Add due_date and important_date_type to lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS important_date_type VARCHAR(50);
