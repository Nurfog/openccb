-- Migración para crear la tabla de dependencias de lecciones (Learning Sequences)

CREATE TABLE lesson_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    prerequisite_lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    min_score_percentage DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lesson_id, prerequisite_lesson_id),
    CHECK (lesson_id != prerequisite_lesson_id)
);

-- Índices para mejorar el rendimiento de las consultas
CREATE INDEX idx_lesson_dependencies_lesson_id ON lesson_dependencies(lesson_id);
CREATE INDEX idx_lesson_dependencies_prerequisite_id ON lesson_dependencies(prerequisite_lesson_id);
CREATE INDEX idx_lesson_dependencies_org_id ON lesson_dependencies(organization_id);
