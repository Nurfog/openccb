-- Migration: Add LTI 1.3 tables

CREATE TABLE IF NOT EXISTS lti_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    deployment_id TEXT NOT NULL,
    auth_token_url TEXT NOT NULL,
    auth_login_url TEXT NOT NULL,
    jwks_url TEXT NOT NULL,
    platform_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(issuer, client_id, deployment_id)
);

CREATE TABLE IF NOT EXISTS lti_nonces (
    nonce TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delete nonces older than 1 hour (can be run via cron or during launch)
-- DELETE FROM lti_nonces WHERE created_at < NOW() - INTERVAL '1 hour';

CREATE TABLE IF NOT EXISTS lti_resource_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    resource_link_id TEXT NOT NULL,
    course_id UUID NOT NULL REFERENCES courses(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, resource_link_id)
);

CREATE INDEX idx_lti_registrations_issuer_client ON lti_registrations(issuer, client_id);
