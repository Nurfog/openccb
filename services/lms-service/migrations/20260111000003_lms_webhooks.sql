-- Migration: Create Webhooks Table for LMS
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    events VARCHAR(50)[] NOT NULL, -- e.g., ['user.enrolled', 'lesson.completed', 'course.completed']
    secret VARCHAR(255), -- For HMAC-SHA256 signatures
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for organization_id
CREATE INDEX idx_webhooks_organization_id ON webhooks(organization_id);
