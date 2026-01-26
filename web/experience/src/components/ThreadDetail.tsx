"use client";

import React, { useState, useEffect } from "react";
import { lmsApi, ThreadWithAuthor, PostWithAuthor } from "@/lib/api";
import PostCard from "./PostCard";
import ReplyEditor from "./ReplyEditor";
import { ArrowLeft, Pin, Lock, Bell, BellOff, Eye, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";

interface ThreadDetailProps {
    threadId: string;
    onBack: () => void;
}

export default function ThreadDetail({ threadId, onBack }: ThreadDetailProps) {
    const { user } = useAuth();
    const [thread, setThread] = useState<ThreadWithAuthor | null>(null);
    const [posts, setPosts] = useState<PostWithAuthor[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReplyEditor, setShowReplyEditor] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);

    const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

    useEffect(() => {
        loadThread();
    }, [threadId]);

    const loadThread = async () => {
        setLoading(true);
        try {
            const data = await lmsApi.getThreadDetail(threadId);
            setThread(data.thread);
            setPosts(data.posts);
        } catch (error) {
            console.error("Error loading thread:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReply = (parentId: string | null) => {
        setReplyingTo(parentId);
        setShowReplyEditor(true);
    };

    const handleSubmitReply = async (content: string) => {
        try {
            await lmsApi.createPost(threadId, {
                content,
                parent_post_id: replyingTo || undefined
            });
            setShowReplyEditor(false);
            setReplyingTo(null);
            await loadThread(); // Reload to show new post
        } catch (error) {
            console.error("Error creating post:", error);
            throw error;
        }
    };

    const handleVote = async (postId: string, voteType: 'upvote' | 'downvote') => {
        try {
            await lmsApi.votePost(postId, voteType);
            await loadThread(); // Reload to update vote counts
        } catch (error) {
            console.error("Error voting:", error);
        }
    };

    const handleEndorse = async (postId: string) => {
        try {
            await lmsApi.endorsePost(postId);
            await loadThread(); // Reload to update endorsed status
        } catch (error) {
            console.error("Error endorsing post:", error);
        }
    };

    const handlePin = async () => {
        try {
            await lmsApi.pinThread(threadId);
            await loadThread();
        } catch (error) {
            console.error("Error pinning thread:", error);
        }
    };

    const handleLock = async () => {
        try {
            await lmsApi.lockThread(threadId);
            await loadThread();
        } catch (error) {
            console.error("Error locking thread:", error);
        }
    };

    const handleSubscribe = async () => {
        try {
            if (isSubscribed) {
                await lmsApi.unsubscribeThread(threadId);
            } else {
                await lmsApi.subscribeThread(threadId);
            }
            setIsSubscribed(!isSubscribed);
        } catch (error) {
            console.error("Error toggling subscription:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!thread) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-400">Hilo no encontrado</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-xl transition-all border border-white/10"
                >
                    <ArrowLeft size={16} />
                    Volver
                </button>

                <div className="flex-1"></div>

                {/* Instructor Actions */}
                {isInstructor && (
                    <>
                        <button
                            onClick={handlePin}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm ${thread.is_pinned
                                    ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                                }`}
                        >
                            <Pin size={16} />
                            {thread.is_pinned ? 'Desfijar' : 'Fijar'}
                        </button>

                        <button
                            onClick={handleLock}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm ${thread.is_locked
                                    ? 'bg-red-600/30 text-red-400 border border-red-500/50'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                                }`}
                        >
                            <Lock size={16} />
                            {thread.is_locked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                    </>
                )}

                {/* Subscribe Button */}
                <button
                    onClick={handleSubscribe}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm ${isSubscribed
                            ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                        }`}
                >
                    {isSubscribed ? <BellOff size={16} /> : <Bell size={16} />}
                    {isSubscribed ? 'Desuscribirse' : 'Suscribirse'}
                </button>
            </div>

            {/* Thread Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h1 className="text-2xl font-black text-white mb-4">{thread.title}</h1>

                <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                    <span className="font-bold text-white">{thread.author_name}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale: es })}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                        <Eye size={14} />
                        {thread.view_count} vistas
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                        <MessageSquare size={14} />
                        {thread.post_count} respuestas
                    </span>
                </div>

                <div className="text-gray-300 whitespace-pre-wrap break-words mb-6">
                    {thread.content}
                </div>

                {!thread.is_locked && (
                    <button
                        onClick={() => handleReply(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                    >
                        <MessageSquare size={16} />
                        Responder
                    </button>
                )}
            </div>

            {/* Reply Editor */}
            {showReplyEditor && !thread.is_locked && (
                <ReplyEditor
                    threadId={threadId}
                    parentPostId={replyingTo}
                    onSubmit={handleSubmitReply}
                    onCancel={() => {
                        setShowReplyEditor(false);
                        setReplyingTo(null);
                    }}
                />
            )}

            {/* Posts */}
            <div>
                <h2 className="text-lg font-bold text-white mb-4">
                    {posts.length} {posts.length === 1 ? 'Respuesta' : 'Respuestas'}
                </h2>
                {posts.map((post) => (
                    <PostCard
                        key={post.id}
                        post={post}
                        onReply={handleReply}
                        onVote={handleVote}
                        onEndorse={isInstructor ? handleEndorse : undefined}
                        depth={0}
                        isInstructor={isInstructor}
                    />
                ))}
            </div>
        </div>
    );
}
