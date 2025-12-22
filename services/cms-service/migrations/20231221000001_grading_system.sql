-- Add grading categories table
CREATE TABLE grading_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
    drop_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Update lessons with grading fields
ALTER TABLE lessons ADD COLUMN grading_category_id UUID REFERENCES grading_categories(id) ON DELETE SET NULL;
ALTER TABLE lessons ADD COLUMN is_graded BOOLEAN NOT NULL DEFAULT FALSE;
