-- Índices para búsqueda global eficiente en cursos, lecciones, hilos y anuncios

-- Cursos: full-text search sobre título y descripción
CREATE INDEX IF NOT EXISTS idx_courses_search_title
    ON courses USING gin(to_tsvector('spanish', COALESCE(title, '')));

CREATE INDEX IF NOT EXISTS idx_courses_search_desc
    ON courses USING gin(to_tsvector('spanish', COALESCE(description, '')));

-- Lecciones: índice sobre título y summary
CREATE INDEX IF NOT EXISTS idx_lessons_search_title
    ON lessons USING gin(to_tsvector('spanish', COALESCE(title, '')));

CREATE INDEX IF NOT EXISTS idx_lessons_search_summary
    ON lessons USING gin(to_tsvector('spanish', COALESCE(summary, '')));

-- Hilos de discusión: índice sobre título
CREATE INDEX IF NOT EXISTS idx_discussion_threads_search_title
    ON discussion_threads USING gin(to_tsvector('spanish', COALESCE(title, '')));

-- Anuncios: índice sobre título y content
CREATE INDEX IF NOT EXISTS idx_course_announcements_search_title
    ON course_announcements USING gin(to_tsvector('spanish', COALESCE(title, '')));

CREATE INDEX IF NOT EXISTS idx_course_announcements_search_body
    ON course_announcements USING gin(to_tsvector('spanish', COALESCE(content, '')));
