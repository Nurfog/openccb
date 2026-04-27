-- Fase 40: Documentos Colaborativos (cms-service mirror)
CREATE TABLE IF NOT EXISTS lesson_collaborative_docs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL,
    organization_id UUID NOT NULL,
    course_id       UUID NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    revision        BIGINT NOT NULL DEFAULT 0,
    last_modified_by UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_docs_lesson
    ON lesson_collaborative_docs (lesson_id, organization_id);
