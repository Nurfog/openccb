-- Migration: Add missing delete functions
-- Adds fn_delete_module and fn_delete_lesson which were missing from the CRUD migration

CREATE OR REPLACE FUNCTION fn_delete_module(
    p_id UUID,
    p_organization_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM modules 
    WHERE id = p_id AND organization_id = p_organization_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_delete_lesson(
    p_id UUID,
    p_organization_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM lessons 
    WHERE id = p_id AND organization_id = p_organization_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count > 0;
END;
$$ LANGUAGE plpgsql;
