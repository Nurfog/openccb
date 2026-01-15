-- Migration: Update Analytics Functions for Multi-Tenancy
-- Scope: fn_get_cohort_analytics, fn_get_retention_data

-- 1. Update Course Cohort Analytics to include p_organization_id
CREATE OR REPLACE FUNCTION fn_get_cohort_analytics(p_course_id UUID, p_organization_id UUID)
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
        WHERE course_id = p_course_id AND organization_id = p_organization_id
    ),
    course_lesson_count AS (
        SELECT COUNT(*)::float4 as total_lessons
        FROM lessons
        WHERE module_id IN (SELECT id FROM modules WHERE course_id = p_course_id AND organization_id = p_organization_id)
          AND organization_id = p_organization_id
    )
    SELECT 
        cs.v_period as period,
        COUNT(DISTINCT cs.user_id) as student_count,
        COALESCE(AVG(
            (SELECT COUNT(DISTINCT lesson_id)::float4 FROM user_grades WHERE user_id = cs.user_id AND course_id = p_course_id AND organization_id = p_organization_id) / 
            NULLIF((SELECT total_lessons FROM course_lesson_count), 0)
        ), 0)::float4 as completion_rate
    FROM cohort_students cs
    GROUP BY cs.v_period
    ORDER BY cs.v_period DESC;
END;
$$ LANGUAGE plpgsql;

-- 2. Update Retention Data Function to include p_organization_id
CREATE OR REPLACE FUNCTION fn_get_retention_data(p_course_id UUID, p_organization_id UUID)
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
    LEFT JOIN user_grades ug ON l.id = ug.lesson_id AND ug.organization_id = p_organization_id
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = p_course_id AND organization_id = p_organization_id)
      AND l.organization_id = p_organization_id
    GROUP BY l.id, l.title, l.position
    ORDER BY l.position;
END;
$$ LANGUAGE plpgsql;
