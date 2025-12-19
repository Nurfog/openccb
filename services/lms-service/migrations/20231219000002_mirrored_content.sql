-- Mirrored schema for courses, modules, and lessons in the LMS
-- This table stores the published version of the content
CREATE TABLE courses (
    id UUID PRIMARY KEY, -- Using the same ID as CMS
    title TEXT NOT NULL,
    description TEXT,
    instructor_id UUID NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE modules (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lessons (
    id UUID PRIMARY KEY,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_url TEXT,
    transcription JSONB,
    metadata JSONB,
    position INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
