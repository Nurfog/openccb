-- Migration: Add unique constraint to enrollments table
-- Required for fn_enroll_student ON CONFLICT logic

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_user_id_course_id_key') THEN
        ALTER TABLE enrollments ADD CONSTRAINT enrollments_user_id_course_id_key UNIQUE (user_id, course_id);
    END IF;
END $$;
