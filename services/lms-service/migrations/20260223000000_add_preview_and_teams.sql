-- Migration to support course previews and multi-instructor sync
ALTER TABLE lessons ADD COLUMN is_previewable BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE course_instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'instructor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, user_id)
);
