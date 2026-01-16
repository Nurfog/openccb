-- Migration: Fix Grading Logic for Multi-tenancy
-- Corrects fn_upsert_user_grade to properly handle organization_id in user_badges

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
          AND id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = p_user_id AND organization_id = p_organization_id)
    LOOP
        INSERT INTO user_badges (user_id, badge_id, organization_id) 
        VALUES (p_user_id, v_badge_id, p_organization_id) 
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END LOOP;

    RETURN NEXT v_grade;
END;
$$ LANGUAGE plpgsql;
