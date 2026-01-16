-- Migration: Update fn_register_user to handle default organization
-- Assigns users to the 'Default Organization' (0...1) if no name is provided.

CREATE OR REPLACE FUNCTION fn_register_user(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_full_name VARCHAR(255),
    p_role VARCHAR(50),
    p_org_name VARCHAR(255) DEFAULT NULL
) RETURNS SETOF users AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Find or create organization
    IF p_org_name IS NULL OR p_org_name = '' OR p_org_name = 'Default Organization' THEN
        v_org_id := '00000000-0000-0000-0000-000000000001';
    ELSE
        INSERT INTO organizations (name) 
        VALUES (p_org_name) 
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name 
        RETURNING id INTO v_org_id;
    END IF;

    -- Create user
    RETURN QUERY
    INSERT INTO users (email, password_hash, full_name, role, organization_id)
    VALUES (p_email, p_password_hash, p_full_name, p_role, v_org_id)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
