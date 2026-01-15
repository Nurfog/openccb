-- Migration: Add pacing_mode to courses table (LMS)
-- To match common::models::Course struct and CMS schema

ALTER TABLE courses ADD COLUMN pacing_mode VARCHAR(50) NOT NULL DEFAULT 'self_paced';
