ALTER TABLE lesson_collaborative_canvases
    ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;
