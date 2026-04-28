-- Fase 41-B: Anotaciones Privadas en Lecciones
CREATE TABLE IF NOT EXISTS lesson_annotations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    lesson_id       UUID NOT NULL,
    organization_id UUID NOT NULL,
    course_id       UUID NOT NULL,
    content         TEXT NOT NULL,
    -- JSON libre: { "type": "timestamp", "value": 42.5 } | { "type": "scroll", "value": 0.35 }
    position_data   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_annotations_user_lesson
    ON lesson_annotations (user_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_lesson_annotations_user_org
    ON lesson_annotations (user_id, organization_id);
