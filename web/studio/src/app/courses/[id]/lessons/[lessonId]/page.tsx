"use client";

import { useEffect, useState } from "react";
import { cmsApi, Lesson, Block } from "@/lib/api";
import Link from "next/link";
import DescriptionBlock from "@/components/blocks/DescriptionBlock";
import MediaBlock from "@/components/blocks/MediaBlock";
import QuizBlock from "@/components/blocks/QuizBlock";

export default function LessonEditor({ params }: { params: { id: string; lessonId: string } }) {
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Activity State (Blocks)
    const [blocks, setBlocks] = useState<Block[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const lessonData: Lesson = await fetch(`http://localhost:3001/lessons/${params.lessonId}`).then(res => res.json());
                setLesson(lessonData);

                if (lessonData.metadata?.blocks) {
                    setBlocks(lessonData.metadata.blocks);
                } else {
                    setBlocks([
                        {
                            id: 'initial-desc',
                            type: 'description',
                            content: `Welcome to ${lessonData.title}. Please follow the instructions below.`
                        }
                    ]);
                }
            } catch {
                console.error("Failed to load lesson");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [params.id, params.lessonId]);

    const handleSave = async () => {
        if (!lesson) return;
        setIsSaving(true);
        try {
            const updated = await cmsApi.updateLesson(lesson.id, {
                metadata: { ...lesson.metadata, blocks }
            });
            setLesson(updated);
            setEditMode(false);
        } catch {
            alert("Failed to save activity.");
        } finally {
            setIsSaving(false);
        }
    };

    const addBlock = (type: 'description' | 'media' | 'quiz') => {
        const newBlock: Block = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            ...(type === 'description' && { content: "" }),
            ...(type === 'media' && { url: "", media_type: 'video' as const, config: { maxPlays: 0 } }),
            ...(type === 'quiz' && { quiz_data: { questions: [] } }),
        };
        setBlocks([...blocks, newBlock]);
    };

    const removeBlock = (id: string) => {
        setBlocks(blocks.filter(b => b.id !== id));
    };

    const updateBlock = (id: string, updates: Partial<Block>) => {
        setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newBlocks = [...blocks];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

        [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
        setBlocks(newBlocks);
    };

    if (loading) return <div className="py-20 text-center text-gray-500 animate-pulse font-medium">Initializing Activity Builder...</div>;
    if (!lesson) return <div className="py-20 text-center text-red-400">Activity not found.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-40 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] text-blue-500 font-bold uppercase tracking-[0.2em]">
                        <Link href={`/courses/${params.id}`} className="hover:text-white transition-colors">Outline</Link>
                        <span className="text-gray-700">/</span>
                        <span>Activity</span>
                    </div>
                    <h2 className="text-4xl font-black tracking-tight">{lesson.title}</h2>
                </div>

                <div className="flex items-center gap-3">
                    {editMode ? (
                        <>
                            <button onClick={() => setEditMode(false)} className="px-6 py-2.5 glass text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all">Discard</button>
                            <button onClick={handleSave} disabled={isSaving} className="btn-premium px-8 py-2.5 min-w-[140px] text-xs font-bold uppercase tracking-widest shadow-blue-500/20 shadow-lg">
                                {isSaving ? "Saving..." : "Publish Changes"}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setEditMode(true)} className="px-8 py-3 glass text-xs font-bold uppercase tracking-widest hover:border-blue-500/50 transition-all flex items-center gap-2 group">
                            <span className="group-hover:rotate-12 transition-transform">✏️</span> Edit Activity
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-16">
                {blocks.map((block, index) => (
                    <div key={block.id} className="relative group/block animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                        {editMode && (
                            <div className="absolute -left-12 top-0 h-full flex flex-col items-center gap-2 opacity-0 group-hover/block:opacity-100 transition-all">
                                <button
                                    onClick={() => moveBlock(index, 'up')}
                                    disabled={index === 0}
                                    className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
                                    title="Move Up"
                                >
                                    <span className="text-xs">↑</span>
                                </button>
                                <button
                                    onClick={() => moveBlock(index, 'down')}
                                    disabled={index === blocks.length - 1}
                                    className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
                                    title="Move Down"
                                >
                                    <span className="text-xs">↓</span>
                                </button>
                                <div className="h-2"></div>
                                <button
                                    onClick={() => removeBlock(block.id)}
                                    className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                    title="Remove Block"
                                >
                                    <span className="text-sm">×</span>
                                </button>
                                <div className="w-0.5 flex-1 bg-white/5"></div>
                            </div>
                        )}

                        <div className="space-y-6">
                            {block.type === 'description' && (
                                <DescriptionBlock
                                    id={block.id}
                                    title={block.title}
                                    content={block.content || ""}
                                    editMode={editMode}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'media' && (
                                <MediaBlock
                                    id={block.id}
                                    title={block.title}
                                    url={block.url || ""}
                                    type={block.media_type || 'video'}
                                    config={block.config || {}}
                                    editMode={editMode}
                                    transcription={lesson.transcription}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'quiz' && (
                                <QuizBlock
                                    id={block.id}
                                    title={block.title}
                                    quizData={block.quiz_data || { questions: [] }}
                                    editMode={editMode}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                        </div>
                    </div>
                ))}

                {editMode && (
                    <div className="pt-12 border-t border-white/5">
                        <div className="flex flex-col items-center gap-6">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Add Content Block</span>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => addBlock('description')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">📄</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Text</span>
                                </button>
                                <button
                                    onClick={() => addBlock('media')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🎬</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Media</span>
                                </button>
                                <button
                                    onClick={() => addBlock('quiz')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">💡</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Quiz</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
