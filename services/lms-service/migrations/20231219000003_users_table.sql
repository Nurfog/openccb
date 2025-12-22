-- Create users table for Students
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: Enrollments already exist and use user_id. 
-- We should ideally link them now.
ALTER TABLE enrollments ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);
