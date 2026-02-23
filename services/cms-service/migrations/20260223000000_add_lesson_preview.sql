-- Migration to support course previews
ALTER TABLE lessons ADD COLUMN is_previewable BOOLEAN NOT NULL DEFAULT FALSE;

-- Update Lesson Management Functions
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
    p_important_date_type VARCHAR(50) DEFAULT NULL,
    p_is_previewable BOOLEAN DEFAULT FALSE
) RETURNS SETOF lessons AS $$
BEGIN
    RETURN QUERY
    INSERT INTO lessons (
        organization_id, module_id, title, content_type, content_url, 
        position, transcription, metadata, is_graded, grading_category_id, 
        max_attempts, allow_retry, due_date, important_date_type, is_previewable
    )
    VALUES (
        p_organization_id, p_module_id, p_title, p_content_type, p_content_url, 
        p_position, p_transcription, p_metadata, p_is_graded, p_grading_category_id, 
        p_max_attempts, p_allow_retry, p_due_date, p_important_date_type, p_is_previewable
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
    p_is_previewable BOOLEAN DEFAULT NULL,
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
        is_previewable = COALESCE(p_is_previewable, is_previewable),
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_organization_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
