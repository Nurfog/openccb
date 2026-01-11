-- Migration: CMS CRUD Functions
-- Encapsulate all data mutations in stored functions

-- 1. Course Management
CREATE OR REPLACE FUNCTION fn_create_course(
    p_organization_id UUID,
    p_instructor_id UUID,
    p_title VARCHAR(255),
    p_pacing_mode VARCHAR(50) DEFAULT 'self_paced'
) RETURNS SETOF courses AS $$
BEGIN
    RETURN QUERY
    INSERT INTO courses (organization_id, instructor_id, title, pacing_mode)
    VALUES (p_organization_id, p_instructor_id, p_title, p_pacing_mode)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_course(
    p_id UUID,
    p_organization_id UUID,
    p_title VARCHAR(255),
    p_description TEXT,
    p_passing_percentage INTEGER,
    p_pacing_mode VARCHAR(50),
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_certificate_template VARCHAR(255) DEFAULT NULL
) RETURNS SETOF courses AS $$
BEGIN
    RETURN QUERY
    UPDATE courses 
    SET title = p_title,
        description = p_description,
        passing_percentage = p_passing_percentage,
        pacing_mode = p_pacing_mode,
        start_date = p_start_date,
        end_date = p_end_date,
        certificate_template = p_certificate_template,
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_organization_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_delete_course(
    p_id UUID,
    p_organization_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM courses 
    WHERE id = p_id AND organization_id = p_organization_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 2. Module Management
CREATE OR REPLACE FUNCTION fn_create_module(
    p_organization_id UUID,
    p_course_id UUID,
    p_title VARCHAR(255),
    p_position INTEGER
) RETURNS SETOF modules AS $$
BEGIN
    RETURN QUERY
    INSERT INTO modules (organization_id, course_id, title, position)
    VALUES (p_organization_id, p_course_id, p_title, p_position)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_module(
    p_id UUID,
    p_organization_id UUID,
    p_title VARCHAR(255) DEFAULT NULL,
    p_position INTEGER DEFAULT NULL
) RETURNS SETOF modules AS $$
BEGIN
    RETURN QUERY
    UPDATE modules 
    SET title = COALESCE(p_title, title),
        position = COALESCE(p_position, position),
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_organization_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 3. Lesson Management
CREATE OR REPLACE FUNCTION fn_create_lesson(
    p_organization_id UUID,
    p_module_id UUID,
    p_title VARCHAR(255),
    p_content_type VARCHAR(50),
    p_content_url VARCHAR(500) DEFAULT NULL,
    p_position INTEGER DEFAULT 0,
    p_transcription JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_is_graded BOOLEAN DEFAULT FALSE,
    p_grading_category_id UUID DEFAULT NULL,
    p_max_attempts INTEGER DEFAULT NULL,
    p_allow_retry BOOLEAN DEFAULT TRUE,
    p_due_date TIMESTAMPTZ DEFAULT NULL,
    p_important_date_type VARCHAR(50) DEFAULT NULL
) RETURNS SETOF lessons AS $$
BEGIN
    RETURN QUERY
    INSERT INTO lessons (
        organization_id, module_id, title, content_type, content_url, 
        position, transcription, metadata, is_graded, grading_category_id, 
        max_attempts, allow_retry, due_date, important_date_type
    )
    VALUES (
        p_organization_id, p_module_id, p_title, p_content_type, p_content_url, 
        p_position, p_transcription, p_metadata, p_is_graded, p_grading_category_id, 
        p_max_attempts, p_allow_retry, p_due_date, p_important_date_type
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_lesson(
    p_id UUID,
    p_organization_id UUID,
    p_title VARCHAR(255) DEFAULT NULL,
    p_content_type VARCHAR(50) DEFAULT NULL,
    p_content_url VARCHAR(500) DEFAULT NULL,
    p_content_blocks JSONB DEFAULT NULL,
    p_transcription JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_is_graded BOOLEAN DEFAULT NULL,
    p_grading_category_id UUID DEFAULT NULL,
    p_max_attempts INTEGER DEFAULT NULL,
    p_allow_retry BOOLEAN DEFAULT NULL,
    p_position INTEGER DEFAULT NULL,
    p_due_date TIMESTAMPTZ DEFAULT NULL,
    p_important_date_type VARCHAR(50) DEFAULT NULL,
    p_summary TEXT DEFAULT NULL,
    p_clear_due_date BOOLEAN DEFAULT FALSE,
    p_clear_grading_category BOOLEAN DEFAULT FALSE
) RETURNS SETOF lessons AS $$
BEGIN
    RETURN QUERY
    UPDATE lessons 
    SET title = COALESCE(p_title, title),
        content_type = COALESCE(p_content_type, content_type),
        content_url = COALESCE(p_content_url, content_url),
        content_blocks = COALESCE(p_content_blocks, content_blocks),
        transcription = COALESCE(p_transcription, transcription),
        metadata = COALESCE(p_metadata, metadata),
        is_graded = COALESCE(p_is_graded, is_graded),
        grading_category_id = CASE 
            WHEN p_clear_grading_category THEN NULL 
            ELSE COALESCE(p_grading_category_id, grading_category_id) 
        END,
        max_attempts = COALESCE(p_max_attempts, max_attempts),
        allow_retry = COALESCE(p_allow_retry, allow_retry),
        position = COALESCE(p_position, position),
        due_date = CASE 
            WHEN p_clear_due_date THEN NULL 
            ELSE COALESCE(p_due_date, due_date) 
        END,
        important_date_type = COALESCE(p_important_date_type, important_date_type),
        summary = COALESCE(p_summary, summary),
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_organization_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 4. Content Reordering
CREATE OR REPLACE PROCEDURE pr_reorder_modules(
    p_organization_id UUID,
    p_updates JSONB -- Array of {id, position}
) AS $$
DECLARE
    v_update JSONB;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        UPDATE modules 
        SET position = (v_update->>'position')::INTEGER 
        WHERE id = (v_update->>'id')::UUID AND organization_id = p_organization_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE pr_reorder_lessons(
    p_organization_id UUID,
    p_updates JSONB -- Array of {id, position}
) AS $$
DECLARE
    v_update JSONB;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        UPDATE lessons 
        SET position = (v_update->>'position')::INTEGER 
        WHERE id = (v_update->>'id')::UUID AND organization_id = p_organization_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. User & Auth Management
CREATE OR REPLACE FUNCTION fn_register_user(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_full_name VARCHAR(255),
    p_role VARCHAR(50),
    p_org_name VARCHAR(255)
) RETURNS SETOF users AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Find or create organization
    INSERT INTO organizations (name) 
    VALUES (p_org_name) 
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name 
    RETURNING id INTO v_org_id;

    -- Create user
    RETURN QUERY
    INSERT INTO users (email, password_hash, full_name, role, organization_id)
    VALUES (p_email, p_password_hash, p_full_name, p_role, v_org_id)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_get_user_by_email(
    p_email VARCHAR(255)
) RETURNS SETOF users AS $$
BEGIN
    RETURN QUERY SELECT * FROM users WHERE email = p_email;
END;
$$ LANGUAGE plpgsql;
