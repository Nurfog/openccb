-- Fase 36: LTI 1.3 Tool Consumer
-- Registro de herramientas externas por curso + eventos de passback de notas

CREATE TABLE IF NOT EXISTS lti_external_tools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    launch_url      TEXT NOT NULL,
    shared_secret   TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, course_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lti_external_tools_org_course
    ON lti_external_tools(organization_id, course_id);

CREATE TABLE IF NOT EXISTS lti_grade_passback_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tool_id          UUID NOT NULL REFERENCES lti_external_tools(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id        UUID REFERENCES lessons(id) ON DELETE SET NULL,
    raw_score        FLOAT4 NOT NULL,
    max_score        FLOAT4 NOT NULL DEFAULT 1,
    normalized_score FLOAT4 NOT NULL,
    status           TEXT,
    metadata         JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lti_passback_tool_created
    ON lti_grade_passback_events(tool_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lti_passback_user_course
    ON lti_grade_passback_events(user_id, course_id);
