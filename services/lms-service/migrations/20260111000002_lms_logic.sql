-- Migration: LMS Logic Functions (XP and Enrollment)

-- 1. Function to award XP
CREATE OR REPLACE FUNCTION fn_award_xp(
    p_user_id UUID,
    p_org_id UUID,
    p_amount INTEGER,
    p_reason TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Update XP in users table
    UPDATE users 
    SET xp = xp + p_amount,
        level = FLOOR(SQRT((xp + p_amount)::FLOAT / 100)) + 1,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log to points_log
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'points_log') THEN
        INSERT INTO points_log (user_id, organization_id, amount, reason, entity_type, entity_id)
        VALUES (p_user_id, p_org_id, p_amount, p_reason, p_entity_type, p_entity_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Function for Course Cohort Analytics
CREATE OR REPLACE FUNCTION fn_get_cohort_analytics(p_course_id UUID)
RETURNS TABLE (
    period TEXT,
    student_count BIGINT,
    completion_rate FLOAT4
) AS $$
BEGIN
    RETURN QUERY
    WITH cohort_students AS (
        SELECT 
            user_id,
            TO_CHAR(enrolled_at, 'YYYY-MM') as v_period
        FROM enrollments
        WHERE course_id = p_course_id
    ),
    course_lesson_count AS (
        SELECT COUNT(*)::float4 as total_lessons
        FROM lessons
        WHERE module_id IN (SELECT id FROM modules WHERE course_id = p_course_id)
    )
    SELECT 
        cs.v_period as period,
        COUNT(DISTINCT cs.user_id) as student_count,
        COALESCE(AVG(
            (SELECT COUNT(DISTINCT lesson_id)::float4 FROM user_grades WHERE user_id = cs.user_id AND course_id = p_course_id) / 
            NULLIF((SELECT total_lessons FROM course_lesson_count), 0)
        ), 0)::float4 as completion_rate
    FROM cohort_students cs
    GROUP BY cs.v_period
    ORDER BY cs.v_period DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Retention Data Function
CREATE OR REPLACE FUNCTION fn_get_retention_data(p_course_id UUID)
RETURNS TABLE (
    lesson_id UUID,
    lesson_title VARCHAR,
    student_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as lesson_id,
        l.title as lesson_title,
        COUNT(DISTINCT ug.user_id) as student_count
    FROM lessons l
    LEFT JOIN user_grades ug ON l.id = ug.lesson_id
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = p_course_id)
    GROUP BY l.id, l.title, l.position
    ORDER BY l.position;
END;
$$ LANGUAGE plpgsql;

-- 4. Enrollment Function
CREATE OR REPLACE FUNCTION fn_enroll_student(
    p_organization_id UUID,
    p_user_id UUID,
    p_course_id UUID
) RETURNS SETOF enrollments AS $$
BEGIN
    RETURN QUERY
    INSERT INTO enrollments (organization_id, user_id, course_id)
    VALUES (p_organization_id, p_user_id, p_course_id)
    ON CONFLICT (user_id, course_id) DO UPDATE SET enrolled_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 5. Grading Function (Upsert) with Automated Logic
CREATE OR REPLACE FUNCTION fn_upsert_user_grade(
    p_organization_id UUID,
    p_user_id UUID,
    p_course_id UUID,
    p_lesson_id UUID,
    p_score FLOAT4,
    p_metadata JSONB DEFAULT NULL
) RETURNS SETOF user_grades AS $$
DECLARE
    v_grade user_grades;
    v_xp_amount INTEGER := 20; -- Default XP for completion
    v_badge_id UUID;
BEGIN
    -- 1. Upsert grade
    INSERT INTO user_grades (organization_id, user_id, course_id, lesson_id, score, metadata, attempts_count)
    VALUES (p_organization_id, p_user_id, p_course_id, p_lesson_id, p_score, p_metadata, 1)
    ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        score = EXCLUDED.score,
        metadata = EXCLUDED.metadata,
        attempts_count = user_grades.attempts_count + 1,
        updated_at = NOW()
    RETURNING * INTO v_grade;

    -- 2. Award XP automatically
    PERFORM fn_award_xp(p_user_id, p_organization_id, v_xp_amount, 'lesson_completion', 'lesson', p_lesson_id);

    -- 3. Check for new badges
    FOR v_badge_id IN 
        SELECT id FROM badges 
        WHERE organization_id = p_organization_id 
          AND requirement_type = 'points' 
          AND requirement_value <= (SELECT xp FROM users WHERE id = p_user_id)
          AND id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = p_user_id)
    LOOP
        INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge_id) ON CONFLICT DO NOTHING;
    END LOOP;

    RETURN NEXT v_grade;
END;
$$ LANGUAGE plpgsql;
