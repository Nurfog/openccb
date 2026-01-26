"use client";

import React, { useState, useEffect } from "react";
import { lmsApi, ThreadWithAuthor } from "@/lib/api";
import ThreadList from "./ThreadList";
import ThreadDetail from "./ThreadDetail";
import NewThreadModal from "./NewThreadModal";
import { MessageSquarePlus, Filter } from "lucide-react";

interface DiscussionBoardProps {
    courseId: string;
    lessonId?: string;
}

type FilterType = 'all' | 'my_threads' | 'unanswered' | 'resolved';

export default function DiscussionBoard({ courseId, lessonId }: DiscussionBoardProps) {
    const [threads, setThreads] = useState<ThreadWithAuthor[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [page, setPage] = useState(1);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [showNewThreadModal, setShowNewThreadModal] = useState(false);

    useEffect(() => {
        loadThreads();
    }, [courseId, filter, page, lessonId]);

    const loadThreads = async () => {
        setLoading(true);
        try {
            const data = await lmsApi.getDiscussions(courseId, filter, lessonId, page);
            setThreads(data);
        } catch (error) {
            console.error("Error loading discussions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleThreadClick = (threadId: string) => {
        setSelectedThreadId(threadId);
    };

    const handleBack = () => {
        setSelectedThreadId(null);
        loadThreads(); // Reload list in case of changes
    };

    const handleNewThreadSuccess = () => {
        setShowNewThreadModal(false);
        loadThreads();
    };

    // If viewing a specific thread
    if (selectedThreadId) {
        return <ThreadDetail threadId={selectedThreadId} onBack={handleBack} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-3xl font-black text-white">Discusiones</h1>
                <div className="flex-1"></div>
                <button
                    onClick={() => setShowNewThreadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                    <MessageSquarePlus size={20} />
                    Nuevo Hilo
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <div className="flex items-center gap-2 text-gray-400 flex-shrink-0">
                    <Filter size={16} />
                    <span className="text-sm font-bold">Filtrar:</span>
                </div>

                {[
                    { value: 'all', label: 'Todos' },
                    { value: 'my_threads', label: 'Mis Hilos' },
                    { value: 'unanswered', label: 'Sin Responder' },
                    { value: 'resolved', label: 'Resueltos' }
                ].map((filterOption) => (
                    <button
                        key={filterOption.value}
                        onClick={() => {
                            setFilter(filterOption.value as FilterType);
                            setPage(1);
                        }}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${filter === filterOption.value
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                            }`}
                    >
                        {filterOption.label}
                    </button>
                ))}
            </div>

            {/* Thread List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <ThreadList threads={threads} onThreadClick={handleThreadClick} />
            )}

            {/* Pagination */}
            {threads.length === 50 && (
                <div className="flex items-center justify-center gap-2">
                    {page > 1 && (
                        <button
                            onClick={() => setPage(page - 1)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
                        >
                            Anterior
                        </button>
                    )}
                    <span className="text-gray-400 text-sm font-bold">Página {page}</span>
                    <button
                        onClick={() => setPage(page + 1)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
                    >
                        Siguiente
                    </button>
                </div>
            )}

            {/* New Thread Modal */}
            {showNewThreadModal && (
                <NewThreadModal
                    courseId={courseId}
                    lessonId={lessonId}
                    onClose={() => setShowNewThreadModal(false)}
                    onSuccess={handleNewThreadSuccess}
                />
            )}
        </div>
    );
}
