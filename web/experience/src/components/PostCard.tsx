"use client";

import React, { useState } from "react";
import { PostWithAuthor } from "@/lib/api";
import { ThumbsUp, MessageSquare, CheckCircle2, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface PostCardProps {
    post: PostWithAuthor;
    onReply: (parentId: string) => void;
    onVote: (postId: string, voteType: 'upvote' | 'downvote') => void;
    onEndorse?: (postId: string) => void;
    depth: number;
    isInstructor?: boolean;
}

export default function PostCard({ post, onReply, onVote, onEndorse, depth, isInstructor }: PostCardProps) {
    const [isVoting, setIsVoting] = useState(false);
    const maxDepth = 5; // Limit nesting depth for UX

    const handleVote = async (voteType: 'upvote' | 'downvote') => {
        if (isVoting) return;
        setIsVoting(true);
        try {
            await onVote(post.id, voteType);
        } finally {
            setIsVoting(false);
        }
    };

    const indentClass = depth > 0 ? `ml-${Math.min(depth * 4, 16)} pl-4 border-l-2 border-white/10` : '';

    return (
        <div className={`${indentClass} ${depth > 0 ? 'mt-4' : 'mt-6'}`}>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] transition-all">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        {post.author_avatar ? (
                            <img src={post.author_avatar} alt={post.author_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <User size={20} />
                        )}
                    </div>

                    {/* Author Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{post.author_name}</span>
                            {post.is_endorsed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs font-bold">
                                    <CheckCircle2 size={12} />
                                    Respuesta Correcta
                                </span>
                            )}
                            <span className="text-gray-500 text-xs">
                                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="text-gray-300 text-sm mb-4 whitespace-pre-wrap break-words">
                    {post.content}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 text-sm">
                    {/* Upvote Button */}
                    <button
                        onClick={() => handleVote('upvote')}
                        disabled={isVoting}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${post.user_vote === 'upvote'
                                ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                            } disabled:opacity-50`}
                    >
                        <ThumbsUp size={14} />
                        <span className="font-bold">{post.upvotes}</span>
                    </button>

                    {/* Reply Button */}
                    {depth < maxDepth && (
                        <button
                            onClick={() => onReply(post.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10 transition-all"
                        >
                            <MessageSquare size={14} />
                            <span className="font-bold">Responder</span>
                        </button>
                    )}

                    {/* Endorse Button (Instructor Only) */}
                    {isInstructor && onEndorse && (
                        <button
                            onClick={() => onEndorse(post.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${post.is_endorsed
                                    ? 'bg-green-600/30 text-green-400 border border-green-500/50'
                                    : 'bg-white/5 text-gray-400 hover:bg-green-600/20 hover:text-green-400 border border-white/10'
                                }`}
                        >
                            <CheckCircle2 size={14} />
                            <span className="font-bold text-xs">{post.is_endorsed ? 'Aprobada' : 'Aprobar'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Nested Replies */}
            {post.replies && post.replies.length > 0 && (
                <div className="mt-2">
                    {post.replies.map((reply) => (
                        <PostCard
                            key={reply.id}
                            post={reply}
                            onReply={onReply}
                            onVote={onVote}
                            onEndorse={onEndorse}
                            depth={depth + 1}
                            isInstructor={isInstructor}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
