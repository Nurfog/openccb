CREATE TABLE IF NOT EXISTS mentorship_assignments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL,
    course_id       UUID        NOT NULL,
    mentor_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by     UUID        NOT NULL,   -- instructor que realizó la asignación
    notes           TEXT,                   -- notas internas del instructor
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, mentor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_mentorship_course       ON mentorship_assignments (course_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_mentor       ON mentorship_assignments (mentor_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_student      ON mentorship_assignments (student_id, organization_id);
