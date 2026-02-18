-- Add table for announcement-cohort relationship
CREATE TABLE IF NOT EXISTS announcement_cohorts (
    announcement_id UUID NOT NULL REFERENCES course_announcements(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    PRIMARY KEY (announcement_id, cohort_id)
);

-- Index for performance
CREATE INDEX idx_announcement_cohorts_cohort ON announcement_cohorts(cohort_id);
