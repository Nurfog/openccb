-- Migration: Seed Tutorials
-- Description: Creates default courses for Admin, Instructor, and Student roles using system functions.

DO $$
DECLARE
    v_admin_id UUID;
    v_org_id UUID;
    v_course_id UUID;
    v_module_id UUID;
    v_lesson_id UUID;
    v_blocks JSONB;
BEGIN
    -- 1. Get an Author (First Admin)
    SELECT id, organization_id INTO v_admin_id, v_org_id FROM users WHERE role = 'admin' LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'No admin user found. Skipping tutorial seeding.';
        RETURN;
    END IF;

    -- SIMULATE SESSION for Audit Logs
    -- This ensures fn_trigger_audit_log finds a user_id
    PERFORM set_config('app.current_user_id', v_admin_id::TEXT, true);
    PERFORM set_config('app.org_id', v_org_id::TEXT, true);
    PERFORM set_config('app.event_type', 'SYSTEM_SEED', true);

    ---------------------------------------------------------------------------
    -- COURSE 1: SYSTEM ADMINISTRATION
    ---------------------------------------------------------------------------
    -- Check if exists to avoid duplicates (simple check by title)
    PERFORM id FROM courses WHERE title = 'System Administration 101' AND organization_id = v_org_id;
    IF NOT FOUND THEN
        SELECT id INTO v_course_id FROM fn_create_course(v_org_id, v_admin_id, 'System Administration 101', 'self_paced');
        
        -- Module 1: Organization & Users
        SELECT id INTO v_module_id FROM fn_create_module(v_org_id, v_course_id, 'Organization & User Management', 1);
        
        -- Lesson 1.1: Managing Users
        v_blocks := '[
            {"id": "1", "type": "description", "content": "Learn how to invite, manage, and remove users from your organization."},
            {"id": "2", "type": "media", "media_type": "video", "title": "User Management Demo", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
        ]';
        SELECT id INTO v_lesson_id FROM fn_create_lesson(v_org_id, v_module_id, 'Managing Users & Roles', 'video', NULL, 1, NULL, jsonb_build_object('blocks', v_blocks));

        -- Lesson 1.2: Audit Logs
        v_blocks := '[
            {"id": "1", "type": "description", "content": "OpenCCB automatically logs all critical actions. Access the Audit Log from the settings menu to view a timeline of all system changes."}
        ]';
        SELECT id INTO v_lesson_id FROM fn_create_lesson(v_org_id, v_module_id, 'Using the Audit Log', 'article', NULL, 2, NULL, jsonb_build_object('blocks', v_blocks));

        -- Module 2: System Settings
        SELECT id INTO v_module_id FROM fn_create_module(v_org_id, v_course_id, 'System Integrations', 2);
        
        -- Lesson 2.1: Webhooks
        v_blocks := '[
            {"id": "1", "type": "description", "content": "Configure webhooks to receive real-time updates for student enrollments and completions."}
        ]';
        SELECT id INTO v_lesson_id FROM fn_create_lesson(v_org_id, v_module_id, 'Configuring Webhooks', 'article', NULL, 1, NULL, jsonb_build_object('blocks', v_blocks));
    END IF;

    ---------------------------------------------------------------------------
    -- COURSE 2: INSTRUCTOR ESSENTIALS
    ---------------------------------------------------------------------------
    PERFORM id FROM courses WHERE title = 'Instructor Essentials' AND organization_id = v_org_id;
    IF NOT FOUND THEN
        SELECT id INTO v_course_id FROM fn_create_course(v_org_id, v_admin_id, 'Instructor Essentials', 'self_paced');

        -- Module 1: The Lesson Builder
        SELECT id INTO v_module_id FROM fn_create_module(v_org_id, v_course_id, 'Mastering the Lesson Builder', 1);

        -- Lesson 1.1: Content Blocks
        v_blocks := '[
            {"id": "1", "type": "description", "content": "The Lesson Builder uses a block-based approach. You can mix and match text, video, and quizzes."},
            {"id": "2", "type": "fill-in-the-blanks", "title": "Knowledge Check", "content": "The [[Lesson]] Builder allows you to create [[engaging]] content."}
        ]';
        SELECT id INTO v_lesson_id FROM fn_create_lesson(v_org_id, v_module_id, 'Content Blocks Deep Dive', 'activity', NULL, 1, NULL, jsonb_build_object('blocks', v_blocks));

        -- Module 2: Grading
        SELECT id INTO v_module_id FROM fn_create_module(v_org_id, v_course_id, 'Grading & Analytics', 2);
        
        -- Lesson 2.1: Grading Policy
        v_blocks := '[
            {"id": "1", "type": "description", "content": "Set up grading categories like Exams and Assignments to weight student performance."}
        ]';
        SELECT id INTO v_lesson_id FROM fn_create_lesson(v_org_id, v_module_id, 'Setting up Grading Policies', 'article', NULL, 1, NULL, jsonb_build_object('blocks', v_blocks));
    END IF;

    ---------------------------------------------------------------------------
    -- COURSE 3: STUDENT EXPERIENCE
    ---------------------------------------------------------------------------
    PERFORM id FROM courses WHERE title = 'Student Onboarding' AND organization_id = v_org_id;
    IF NOT FOUND THEN
        SELECT id INTO v_course_id FROM fn_create_course(v_org_id, v_admin_id, 'Student Onboarding', 'self_paced');

        -- Module 1: Getting Started
        SELECT id INTO v_module_id FROM fn_create_module(v_org_id, v_course_id, 'Welcome to OpenCCB', 1);

        -- Lesson 1.1: Navigation
        v_blocks := '[
            {"id": "1", "type": "description", "content": "Navigate through your courses using the sidebar. Track your progress on the dashboard."}
        ]';
        SELECT id INTO v_lesson_id FROM fn_create_lesson(v_org_id, v_module_id, 'Platform Navigation', 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', 1, NULL, jsonb_build_object('blocks', v_blocks));
        
        -- Lesson 1.2: Gamification
        v_blocks := '[
            {"id": "1", "type": "description", "content": "Earn XP and badges as you complete lessons. Check the leaderboard to see how you stack up!"}
        ]';
        SELECT id INTO v_lesson_id FROM fn_create_lesson(v_org_id, v_module_id, 'Understanding XP & Badges', 'article', NULL, 2, NULL, jsonb_build_object('blocks', v_blocks));
    END IF;

END $$;
