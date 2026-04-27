-- Salas de Estudio (Fase 38) -----------------------------------------------
CREATE TABLE IF NOT EXISTS study_rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    bbb_meeting_id  VARCHAR(255),
    bbb_internal_id VARCHAR(255),
    attendee_pw     VARCHAR(128),
    moderator_pw    VARCHAR(128),
    join_url        TEXT,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    max_participants INT DEFAULT 50,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_rooms_course ON study_rooms(course_id);
CREATE INDEX IF NOT EXISTS idx_study_rooms_org ON study_rooms(organization_id);
