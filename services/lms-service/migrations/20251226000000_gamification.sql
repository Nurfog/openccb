-- Migration: Gamification (Points and Badges)
-- Scoped to LMS service where student activity happens

-- 1. Create badges table
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(255),
    requirement_type VARCHAR(50) NOT NULL, -- 'points', 'course_completion', 'assessment_perfect'
    requirement_value INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User Badges (Many-to-Many)
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    badge_id UUID NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- 3. Points Log
CREATE TABLE points_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    amount INT NOT NULL,
    reason VARCHAR(255) NOT NULL, -- 'lesson_completion', 'assessment_pass', 'streak'
    entity_type VARCHAR(50),      -- 'lesson', 'course'
    entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Initial Badges for each organization (optional, can be done via API)
INSERT INTO badges (organization_id, name, description, requirement_type, requirement_value)
VALUES 
('00000000-0000-0000-0000-000000000001', 'First Steps', 'Completed your first lesson', 'points', 10),
('00000000-0000-0000-0000-000000000001', 'Quick Learner', 'Earned 100 points', 'points', 100),
('00000000-0000-0000-0000-000000000001', 'Course Master', 'Completed a full course', 'course_completion', 1);
