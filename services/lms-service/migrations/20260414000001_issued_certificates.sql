-- Issued Certificates Table
-- Stores certificates generated when students complete courses

CREATE TABLE IF NOT EXISTS issued_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL,
    certificate_html TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    certificate_hash TEXT NOT NULL, -- For dedup and verification
    verification_code TEXT NOT NULL UNIQUE, -- Public verification code
    metadata JSONB DEFAULT '{}'::jsonb -- Extra data: score, completion_date, etc.
);

-- Indexes for performance
CREATE INDEX idx_issued_certificates_user_id ON issued_certificates(user_id);
CREATE INDEX idx_issued_certificates_course_id ON issued_certificates(course_id);
CREATE INDEX idx_issued_certificates_verification_code ON issued_certificates(verification_code);

-- Unique constraint: one certificate per user per course
CREATE UNIQUE INDEX idx_issued_certificates_user_course_unique 
    ON issued_certificates(user_id, course_id);

-- Comments
COMMENT ON TABLE issued_certificates IS 'Certificates issued to students upon course completion';
COMMENT ON COLUMN issued_certificates.certificate_hash IS 'SHA256 hash of the certificate HTML for verification';
COMMENT ON COLUMN issued_certificates.verification_code IS 'Public code for certificate verification (e.g., VER-ABC123)';
COMMENT ON COLUMN issued_certificates.metadata IS 'Additional data: final_score, completion_date, instructor_signature, etc';
