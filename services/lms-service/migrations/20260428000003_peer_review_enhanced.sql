-- Fase 41-F: Evaluación entre Pares Mejorada

-- Configuración de peer review por lección
CREATE TABLE IF NOT EXISTS peer_review_settings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID        NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    organization_id UUID        NOT NULL,
    required_reviews INT        NOT NULL DEFAULT 2,   -- cuántas revisiones necesita cada entrega
    peer_weight      INT        NOT NULL DEFAULT 70,  -- 0-100: peso del promedio de pares en la nota final
    instructor_weight INT       NOT NULL DEFAULT 30,  -- 0-100: peso de la calificación del instructor
    rubric_id        UUID,                             -- rúbrica externa (CMS) para orientar la evaluación
    auto_assign      BOOLEAN    NOT NULL DEFAULT true, -- asignación automática al entregar
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT peer_weights_sum CHECK (peer_weight + instructor_weight = 100)
);

CREATE INDEX IF NOT EXISTS idx_peer_review_settings_lesson ON peer_review_settings (lesson_id);

-- Calificación del instructor sobre una entrega
ALTER TABLE peer_reviews
    ADD COLUMN IF NOT EXISTS is_instructor_review BOOLEAN NOT NULL DEFAULT false;

-- Calificación final calculada (desnormalizada para eficiencia)
ALTER TABLE course_submissions
    ADD COLUMN IF NOT EXISTS final_score  FLOAT,          -- NULL mientras no esté completo
    ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'pending';
    -- status: 'pending' | 'under_review' | 'graded'

CREATE INDEX IF NOT EXISTS idx_course_submissions_status ON course_submissions (lesson_id, status);
