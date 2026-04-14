-- Migration: Automatic Enrollment Progress Update via Trigger
-- Created: 2026-04-14

-- 1. Function to recalculate course progress for a student
CREATE OR REPLACE FUNCTION fn_recalculate_enrollment_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_total_lessons INTEGER;
    v_completed_lessons INTEGER;
    v_progress FLOAT4;
BEGIN
    -- Get total number of lessons in the course
    -- We use the course_id from the new grade entry
    SELECT COUNT(*) INTO v_total_lessons
    FROM lessons
    WHERE module_id IN (SELECT id FROM modules WHERE course_id = NEW.course_id);

    -- Get number of distinct lessons with a grade for this user in this course
    SELECT COUNT(DISTINCT lesson_id) INTO v_completed_lessons
    FROM user_grades
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

    -- Calculate progress percentage
    IF v_total_lessons > 0 THEN
        v_progress := (v_completed_lessons::FLOAT4 / v_total_lessons::FLOAT4) * 100;
    ELSE
        v_progress := 0;
    END IF;

    -- Update the enrollments table for this specific user and course
    UPDATE enrollments
    SET progress = v_progress
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger to execute the function after any activity is graded
DROP TRIGGER IF EXISTS tr_update_enrollment_progress ON user_grades;
CREATE TRIGGER tr_update_enrollment_progress
AFTER INSERT OR UPDATE ON user_grades
FOR EACH ROW
EXECUTE FUNCTION fn_recalculate_enrollment_progress();

-- 3. Initial sync: Update progress for all existing enrollments
UPDATE enrollments e
SET progress = COALESCE(
    (
        SELECT (COUNT(DISTINCT ug.lesson_id)::FLOAT4 / NULLIF((
            SELECT COUNT(*) 
            FROM lessons l 
            WHERE l.module_id IN (SELECT id FROM modules m WHERE m.course_id = e.course_id)
        ), 0)::FLOAT4) * 100
        FROM user_grades ug
        WHERE ug.user_id = e.user_id AND ug.course_id = e.course_id
    ),
    0
);
