-- Create lesson_interactions table for engagement tracking
CREATE TABLE IF NOT EXISTS lesson_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    lesson_id UUID NOT NULL,
    video_timestamp FLOAT, -- Timestamp in seconds for video content
    event_type VARCHAR(50) NOT NULL, -- 'heartbeat', 'pause', 'seek', 'complete', 'start'
    metadata JSONB, -- Additional data (segment duration, playback speed, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying of heatmaps
CREATE INDEX IF NOT EXISTS idx_lesson_interactions_lesson_id ON lesson_interactions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_interactions_user_id ON lesson_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_interactions_org_id ON lesson_interactions(organization_id);
