-- Migration: Update fn_update_course to include generation_status
CREATE OR REPLACE FUNCTION fn_update_course(
    p_id UUID,
    p_organization_id UUID,
    p_title VARCHAR(255),
    p_description TEXT,
    p_passing_percentage INTEGER,
    p_pacing_mode VARCHAR(50),
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_certificate_template VARCHAR(255) DEFAULT NULL,
    p_price DOUBLE PRECISION DEFAULT 0.0,
    p_currency VARCHAR(10) DEFAULT 'USD',
    p_marketing_metadata JSONB DEFAULT NULL,
    p_course_image_url TEXT DEFAULT NULL,
    p_generation_status VARCHAR(20) DEFAULT NULL
) RETURNS SETOF courses AS $$
BEGIN
    RETURN QUERY
    UPDATE courses 
    SET title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        passing_percentage = COALESCE(p_passing_percentage, passing_percentage),
        pacing_mode = COALESCE(p_pacing_mode, pacing_mode),
        start_date = p_start_date,
        end_date = p_end_date,
        certificate_template = COALESCE(p_certificate_template, certificate_template),
        price = COALESCE(p_price, price),
        currency = COALESCE(p_currency, currency),
        marketing_metadata = COALESCE(p_marketing_metadata, marketing_metadata),
        course_image_url = COALESCE(p_course_image_url, course_image_url),
        generation_status = COALESCE(p_generation_status, generation_status),
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_organization_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
