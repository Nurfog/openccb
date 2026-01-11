-- Migration: Advanced Auditing and Automatic Triggers
-- Upgrade audit_logs table and implement automated change tracking

-- 1. Upgrade audit_logs table
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'USER_EVENT',
ADD COLUMN IF NOT EXISTS old_data JSONB,
ADD COLUMN IF NOT EXISTS new_data JSONB,
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS public_ip INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Create Audit Trigger Function
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
        user_agent
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
        v_user_agent
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach triggers to core tables
DO $$
BEGIN
    -- Courses
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'courses') THEN
        DROP TRIGGER IF EXISTS trg_audit_courses ON courses;
        CREATE TRIGGER trg_audit_courses
        AFTER INSERT OR UPDATE OR DELETE ON courses
        FOR EACH ROW EXECUTE FUNCTION fn_trigger_audit_log();
    END IF;

    -- Lessons
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'lessons') THEN
        DROP TRIGGER IF EXISTS trg_audit_lessons ON lessons;
        CREATE TRIGGER trg_audit_lessons
        AFTER INSERT OR UPDATE OR DELETE ON lessons
        FOR EACH ROW EXECUTE FUNCTION fn_trigger_audit_log();
    END IF;

    -- Users
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users') THEN
        DROP TRIGGER IF EXISTS trg_audit_users ON users;
        CREATE TRIGGER trg_audit_users
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION fn_trigger_audit_log();
    END IF;
END $$;
