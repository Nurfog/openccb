-- Add transcription and metadata columns to lessons table
ALTER TABLE lessons ADD COLUMN transcription JSONB;
ALTER TABLE lessons ADD COLUMN metadata JSONB;
