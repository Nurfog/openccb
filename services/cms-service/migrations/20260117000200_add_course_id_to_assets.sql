ALTER TABLE assets ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX idx_assets_course_id ON assets(course_id);
