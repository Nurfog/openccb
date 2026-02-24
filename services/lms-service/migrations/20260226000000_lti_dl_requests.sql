-- Migration: Add LTI Deep Linking support tables

CREATE TABLE IF NOT EXISTS lti_deep_linking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES lti_registrations(id),
    deployment_id TEXT NOT NULL,
    return_url TEXT NOT NULL,
    data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup
CREATE INDEX idx_lti_dl_requests_created_at ON lti_deep_linking_requests(created_at);
