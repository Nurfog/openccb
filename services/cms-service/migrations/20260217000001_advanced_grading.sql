-- Migration: Advanced Grading System (Rubrics)
-- Description: Creates tables for rubric-based assessment and grading workflows
-- Created: 2026-02-17

-- Rubrics table - Reusable evaluation templates
CREATE TABLE IF NOT EXISTS rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,  -- NULL = reusable across courses
    created_by UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_points INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rubrics_org ON rubrics(organization_id);
CREATE INDEX idx_rubrics_course ON rubrics(course_id);

-- Rubric Criteria - Evaluation dimensions
CREATE TABLE IF NOT EXISTS rubric_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_points INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_criteria_rubric ON rubric_criteria(rubric_id);

-- Rubric Levels - Performance levels per criterion
CREATE TABLE IF NOT EXISTS rubric_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criterion_id UUID NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,  -- e.g., "Excellent", "Proficient", "Developing"
    description TEXT,
    points INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_levels_criterion ON rubric_levels(criterion_id);

-- Lesson-Rubric Association
CREATE TABLE IF NOT EXISTS lesson_rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(lesson_id, rubric_id)
);

CREATE INDEX idx_lesson_rubrics_lesson ON lesson_rubrics(lesson_id);
CREATE INDEX idx_lesson_rubrics_rubric ON lesson_rubrics(rubric_id);

-- Rubric Assessments - Student evaluation results
CREATE TABLE IF NOT EXISTS rubric_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES rubrics(id),
    user_id UUID NOT NULL REFERENCES users(id),  -- student being assessed
    graded_by UUID REFERENCES users(id),  -- instructor or peer reviewer
    submission_id UUID,  -- if linked to peer_submissions
    total_score DECIMAL(5,2) NOT NULL,
    max_score INTEGER NOT NULL,
    feedback TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft, submitted, published
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_lesson ON rubric_assessments(lesson_id);
CREATE INDEX idx_assessments_user ON rubric_assessments(user_id);
CREATE INDEX idx_assessments_grader ON rubric_assessments(graded_by);
CREATE INDEX idx_assessments_status ON rubric_assessments(status);

-- Assessment Scores - Individual criterion scores
CREATE TABLE IF NOT EXISTS assessment_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES rubric_assessments(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES rubric_criteria(id),
    level_id UUID REFERENCES rubric_levels(id),  -- selected performance level
    points DECIMAL(5,2) NOT NULL,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_assessment ON assessment_scores(assessment_id);
CREATE INDEX idx_scores_criterion ON assessment_scores(criterion_id);
