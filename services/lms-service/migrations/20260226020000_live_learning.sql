CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    description TEXT,
    provider TEXT NOT NULL DEFAULT 'jitsi',
    meeting_id TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    join_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup of course meetings
CREATE INDEX idx_meetings_course ON meetings(course_id);

-- Trigger for updated_at
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON meetings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
