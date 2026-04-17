CREATE TABLE IF NOT EXISTS background_tasks (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL,
    title TEXT NOT NULL,
    course_title TEXT,
    task_type VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_tasks_org_status_updated
    ON background_tasks (organization_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_background_tasks_type_status
    ON background_tasks (task_type, status);
