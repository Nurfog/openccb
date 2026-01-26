"use client";

import React from "react";
import { ThreadWithAuthor } from "@/lib/api";
import { MessageSquare, Eye, Pin, Lock, CheckCircle2, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ThreadListProps {
    threads: ThreadWithAuthor[];
    onThreadClick: (threadId: string) => void;
}

export default function ThreadList({ threads, onThreadClick }: ThreadListProps) {
    if (threads.length === 0) {
        return (
            <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-bold">No hay hilos de discusión todavía</p>
                <p className="text-gray-500 text-sm mt-1">Sé el primero en iniciar una conversación</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {threads.map((thread) => (
                <button
                    key={thread.id}
                    onClick={() => onThreadClick(thread.id)}
                    className="w-full text-left bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all group"
                >
                    <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                            {thread.author_avatar ? (
                                <img src={thread.author_avatar} alt={thread.author_name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <User size={20} />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            {/* Title and Badges */}
                            <div className="flex items-start gap-2 mb-1">
                                <h3 className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors flex-1">
                                    {thread.title}
                                </h3>

                                {/* Badges */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {thread.is_pinned && (
                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-indigo-600/30 border border-indigo-500/50 rounded-full text-indigo-400" title="Fijado">
                                            <Pin size={12} />
                                        </span>
                                    )}
                                    {thread.is_locked && (
                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-red-600/30 border border-red-500/50 rounded-full text-red-400" title="Bloqueado">
                                            <Lock size={12} />
                                        </span>
                                    )}
                                    {thread.has_endorsed_answer && (
                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-600/30 border border-green-500/50 rounded-full text-green-400" title="Resuelto">
                                            <CheckCircle2 size={12} />
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                <span className="font-bold">{thread.author_name}</span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale: es })}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <MessageSquare size={12} />
                                    {thread.post_count} {thread.post_count === 1 ? 'respuesta' : 'respuestas'}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Eye size={12} />
                                    {thread.view_count} {thread.view_count === 1 ? 'vista' : 'vistas'}
                                </span>
                            </div>

                            {/* Preview */}
                            <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                                {thread.content}
                            </p>
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}
