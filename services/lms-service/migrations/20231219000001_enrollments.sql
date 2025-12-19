-- LMS specific schema
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL, -- Referenced by ID from CMS service
    enroled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: In a real microservices scenario, courses might be synced from CMS or shared DB.
-- Here we are using a shared DB for simplicity in this initial implementation.
