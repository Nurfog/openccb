-- Migration to support multiple instructors per course
CREATE TABLE course_instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'instructor', -- 'primary', 'instructor', 'assistant'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, user_id)
);

-- Seed with existing data from courses table
INSERT INTO course_instructors (course_id, user_id, role)
SELECT id, instructor_id, 'primary' FROM courses;

-- We keep the instructor_id in courses for now to avoid breaking changes, 
-- but it should be considered deprecated in favor of course_instructors.
COMMENT ON COLUMN courses.instructor_id IS 'Deprecated: use course_instructors table instead.';
