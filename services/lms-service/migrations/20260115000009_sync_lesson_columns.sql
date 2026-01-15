-- Migration: Add missing columns to lessons table (LMS)
-- To match common::models::Lesson struct and CMS schema

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS important_date_type VARCHAR(50);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(20) DEFAULT 'idle';
