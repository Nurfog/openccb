-- Create users table for Instructors
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add instructor_id foreign key constraint to courses if not already applied
-- (In the initial schema it was just a UUID, let's make it formal if possible)
-- ALTER TABLE courses ADD CONSTRAINT fk_instructor FOREIGN KEY (instructor_id) REFERENCES users(id);
