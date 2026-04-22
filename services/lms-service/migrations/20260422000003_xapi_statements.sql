-- Registro de eventos xAPI emitidos por contenidos SCORM/xAPI
CREATE TABLE IF NOT EXISTS xapi_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    verb TEXT NOT NULL,
    object_id TEXT NOT NULL,
    score DOUBLE PRECISION,
    progress DOUBLE PRECISION,
    completed BOOLEAN,
    raw_statement JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xapi_statements_user ON xapi_statements(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_lesson ON xapi_statements(lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_org ON xapi_statements(organization_id, created_at DESC);
