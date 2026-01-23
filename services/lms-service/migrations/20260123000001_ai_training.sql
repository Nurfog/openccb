-- Migration: AI Training (Memory & RAG)
-- Create tables for chat persistent memory and knowledge base ingestion

-- 1. Chat Sessions Table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- 3. Knowledge Base Table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- 'lesson_content', 'file_supplementary', 'interaction_summary'
    source_id UUID, -- References lesson_id, file_id, etc.
    content_chunk TEXT NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content_chunk)) STORED,
    metadata JSONB, -- Additional info like chapter, page number, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Full Text Search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON knowledge_base USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_on ON knowledge_base(organization_id);
