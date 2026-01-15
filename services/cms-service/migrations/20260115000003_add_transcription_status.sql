-- Add transcription_status to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(20) DEFAULT 'idle';

-- Optional: Update existing lessons with transcriptions to 'completed'
UPDATE lessons SET transcription_status = 'completed' WHERE transcription IS NOT NULL AND transcription != '{}'::jsonb;
