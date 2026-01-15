-- Migration: Add updated_at to users table (LMS)
-- To match common::models::User struct requirements

ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
