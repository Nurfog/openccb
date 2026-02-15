-- Add price and currency to courses table
ALTER TABLE courses ADD COLUMN price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE courses ADD COLUMN currency VARCHAR(10) DEFAULT 'USD';

-- Update fn_create_course to handle price and currency
CREATE OR REPLACE FUNCTION fn_create_course(
    p_organization_id UUID,
    p_instructor_id UUID,
    p_title TEXT,
    p_pacing_mode TEXT DEFAULT 'self_paced',
    p_price NUMERIC(10, 2) DEFAULT 0.00,
    p_currency TEXT DEFAULT 'USD'
) RETURNS SETOF courses AS $$
BEGIN
    RETURN QUERY
    INSERT INTO courses (
        organization_id,
        instructor_id,
        title,
        pacing_mode,
        price,
        currency
    ) VALUES (
        p_organization_id,
        p_instructor_id,
        p_title,
        p_pacing_mode,
        p_price,
        p_currency
    ) RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Update fn_update_course to handle price and currency
CREATE OR REPLACE FUNCTION fn_update_course(
    p_id UUID,
    p_organization_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_passing_percentage INTEGER,
    p_pacing_mode TEXT,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_certificate_template TEXT,
    p_price NUMERIC(10, 2),
    p_currency TEXT
) RETURNS SETOF courses AS $$
BEGIN
    RETURN QUERY
    UPDATE courses SET
        title = p_title,
        description = p_description,
        passing_percentage = p_passing_percentage,
        pacing_mode = p_pacing_mode,
        start_date = p_start_date,
        end_date = p_end_date,
        certificate_template = p_certificate_template,
        price = p_price,
        currency = p_currency,
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_organization_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
