-- Migration: Discussion Forums System
-- Create tables for course discussions, posts, votes, and subscriptions

-- 1. Discussion Threads Table
CREATE TABLE IF NOT EXISTS discussion_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE, -- Optional: thread specific to a lesson
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussion_threads_course ON discussion_threads(course_id);
CREATE INDEX IF NOT EXISTS idx_discussion_threads_lesson ON discussion_threads(lesson_id);
CREATE INDEX IF NOT EXISTS idx_discussion_threads_author ON discussion_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_discussion_threads_org ON discussion_threads(organization_id);

-- 2. Discussion Posts Table (Replies to threads)
CREATE TABLE IF NOT EXISTS discussion_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
    parent_post_id UUID REFERENCES discussion_posts(id) ON DELETE CASCADE, -- For nested replies
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    is_endorsed BOOLEAN DEFAULT false, -- Marked by instructor as correct answer
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussion_posts_thread ON discussion_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_parent ON discussion_posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_author ON discussion_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_org ON discussion_posts(organization_id);

-- 3. Discussion Votes Table
CREATE TABLE IF NOT EXISTS discussion_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_discussion_votes_post ON discussion_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_discussion_votes_user ON discussion_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_votes_org ON discussion_votes(organization_id);

-- 4. Discussion Subscriptions Table
CREATE TABLE IF NOT EXISTS discussion_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_discussion_subscriptions_thread ON discussion_subscriptions(thread_id);
CREATE INDEX IF NOT EXISTS idx_discussion_subscriptions_user ON discussion_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_subscriptions_org ON discussion_subscriptions(organization_id);

-- Trigger to update updated_at on threads
CREATE OR REPLACE FUNCTION update_discussion_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_discussion_thread_timestamp
BEFORE UPDATE ON discussion_threads
FOR EACH ROW
EXECUTE FUNCTION update_discussion_thread_timestamp();

-- Trigger to update updated_at on posts
CREATE OR REPLACE FUNCTION update_discussion_post_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_discussion_post_timestamp
BEFORE UPDATE ON discussion_posts
FOR EACH ROW
EXECUTE FUNCTION update_discussion_post_timestamp();

-- Function to update thread's updated_at when a new post is added
CREATE OR REPLACE FUNCTION update_thread_on_new_post()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE discussion_threads 
    SET updated_at = NOW() 
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_on_new_post
AFTER INSERT ON discussion_posts
FOR EACH ROW
EXECUTE FUNCTION update_thread_on_new_post();
