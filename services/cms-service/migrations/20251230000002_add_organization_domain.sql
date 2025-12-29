-- Migration: Add domain to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain VARCHAR(255) UNIQUE;
