-- Migration: Fix Audit Logs Constraint and Trigger
-- 1. Make changes column nullable (legacy compatibility)
ALTER TABLE audit_logs ALTER COLUMN changes DROP NOT NULL;

-- 2. Update fn_trigger_audit_log to populate changes if needed or just handle NULLs
CREATE OR REPLACE FUNCTION fn_trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_ip INET;
    v_user_agent TEXT;
    v_event_type VARCHAR(50);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_action VARCHAR(50);
BEGIN
    -- Try to get context from session variables
    BEGIN
        v_user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    BEGIN
        v_org_id := current_setting('app.current_org_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_org_id := NULL;
    END;

    BEGIN
        v_ip := current_setting('app.client_ip', true)::INET;
    EXCEPTION WHEN OTHERS THEN
        v_ip := NULL;
    END;

    BEGIN
        v_user_agent := current_setting('app.user_agent', true);
    EXCEPTION WHEN OTHERS THEN
        v_user_agent := NULL;
    END;

    BEGIN
        v_event_type := current_setting('app.event_type', true);
    EXCEPTION WHEN OTHERS THEN
        v_event_type := 'USER_EVENT';
    END;

    -- Handle different operations
    IF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_action := 'DELETE';
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_action := 'UPDATE';
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        v_action := 'INSERT';
    END IF;

    -- Insert into audit_logs
    INSERT INTO audit_logs (
        organization_id, 
        user_id, 
        action, 
        entity_type, 
        entity_id, 
        event_type, 
        old_data, 
        new_data, 
        ip_address, 
        user_agent,
        changes -- Populate legacy column with new_data or old_data for compatibility
    )
    VALUES (
        COALESCE(v_org_id, (CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END)),
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        COALESCE(v_event_type, 'USER_EVENT'),
        v_old_data,
        v_new_data,
        v_ip,
        v_user_agent,
        COALESCE(v_new_data, v_old_data)
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
