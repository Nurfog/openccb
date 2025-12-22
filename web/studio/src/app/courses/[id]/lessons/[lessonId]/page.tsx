"use client";

import { useEffect, useState } from "react";
import { cmsApi, Lesson, Block, GradingCategory } from "@/lib/api";
import Link from "next/link";
import DescriptionBlock from "@/components/blocks/DescriptionBlock";
import MediaBlock from "@/components/blocks/MediaBlock";
import QuizBlock from "@/components/blocks/QuizBlock";
import FillInTheBlanksBlock from "@/components/blocks/FillInTheBlanksBlock";
import MatchingBlock from "@/components/blocks/MatchingBlock";
import OrderingBlock from "@/components/blocks/OrderingBlock";
import ShortAnswerBlock from "@/components/blocks/ShortAnswerBlock";

export default function LessonEditor({ params }: { params: { id: string; lessonId: string } }) {
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Activity State (Blocks)
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [gradingCategories, setGradingCategories] = useState<GradingCategory[]>([]);
    const [isGraded, setIsGraded] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | "">("");
    const [maxAttempts, setMaxAttempts] = useState<number | null>(null);
    const [allowRetry, setAllowRetry] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Use cmsApi for consistency
                const lessonData = await cmsApi.getLesson(params.lessonId);
                setLesson(lessonData);
                setIsGraded(lessonData.is_graded);
                setSelectedCategoryId(lessonData.grading_category_id || "");
                setMaxAttempts(lessonData.max_attempts);
                setAllowRetry(lessonData.allow_retry);

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

                // Load grading categories
                const categories = await cmsApi.getGradingCategories(params.id);
                setGradingCategories(categories);
            } catch {
                console.error("Failed to load lesson or categories");
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
                metadata: { ...lesson.metadata, blocks },
                is_graded: isGraded,
                grading_category_id: selectedCategoryId || null,
                max_attempts: maxAttempts,
                allow_retry: allowRetry
            });
            setLesson(updated);
            setEditMode(false);
        } catch {
            alert("Failed to save activity.");
        } finally {
            setIsSaving(false);
        }
    };

    const addBlock = (type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer') => {
        const newBlock: Block = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            ...(type === 'description' && { content: "" }),
            ...(type === 'media' && { url: "", media_type: 'video' as const, config: { maxPlays: 0 } }),
            ...(type === 'quiz' && { quiz_data: { questions: [] } }),
            ...(type === 'fill-in-the-blanks' && { content: "Type your text here with [[blanks]]." }),
            ...(type === 'matching' && { pairs: [{ left: "Item 1", right: "Match 1" }] }),
            ...(type === 'ordering' && { items: ["Item A", "Item B"] }),
            ...(type === 'short-answer' && { prompt: "Question?", correctAnswers: ["Answer"] }),
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

            {editMode && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <span className="text-blue-500">⚖️</span> Grading Configuration
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Determine if this activity contributes to the final grade</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isGraded}
                                onChange={(e) => setIsGraded(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 group-hover:after:scale-110 transition-all"></div>
                            <span className="ms-3 text-sm font-bold uppercase tracking-widest text-gray-400 peer-checked:text-blue-400 transition-colors">
                                {isGraded ? "Graded" : "Not Graded"}
                            </span>
                        </label>
                    </div>

                    {isGraded && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in zoom-in-95 duration-300">
                                {gradingCategories.length === 0 ? (
                                    <div className="col-span-full py-4 text-center border border-dashed border-white/10 rounded-2xl text-xs text-gray-500 italic">
                                        No grading categories defined. <Link href={`/courses/${params.id}/grading`} className="text-blue-400 underline ml-1">Go to Grading Policy</Link>
                                    </div>
                                ) : (
                                    gradingCategories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={`p-4 rounded-2xl border transition-all text-left group ${selectedCategoryId === cat.id
                                                ? "bg-blue-500/10 border-blue-500 text-blue-400"
                                                : "bg-white/5 border-white/10 text-gray-500 hover:border-white/20"
                                                }`}
                                        >
                                            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Category</div>
                                            <div className="font-bold truncate">{cat.name}</div>
                                            <div className="text-xs mt-2 font-medium opacity-80">{cat.weight}% Weight</div>
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5 animate-in fade-in duration-500">
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Maximum Attempts</span>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={maxAttempts || ""}
                                                onChange={(e) => setMaxAttempts(e.target.value ? parseInt(e.target.value) : null)}
                                                placeholder="Unlimited"
                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all w-32"
                                            />
                                            <span className="text-xs text-gray-500">Leave empty for unlimited</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2">After Submission</span>
                                    <label className="flex items-center gap-3 cursor-pointer group relative">
                                        <input
                                            type="checkbox"
                                            checked={allowRetry}
                                            onChange={(e) => setAllowRetry(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                                        <span className="text-sm font-bold text-gray-400 peer-checked:text-white transition-colors">Allow Instant Corrections</span>
                                    </label>
                                    <p className="text-[10px] text-gray-600 italic">Enables &quot;Check Answer&quot; buttons for individual blocks</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

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
                            {block.type === 'fill-in-the-blanks' && (
                                <FillInTheBlanksBlock
                                    id={block.id}
                                    title={block.title}
                                    content={block.content || ""}
                                    editMode={editMode}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'matching' && (
                                <MatchingBlock
                                    id={block.id}
                                    title={block.title}
                                    pairs={block.pairs || []}
                                    editMode={editMode}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'ordering' && (
                                <OrderingBlock
                                    id={block.id}
                                    title={block.title}
                                    items={block.items || []}
                                    editMode={editMode}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'short-answer' && (
                                <ShortAnswerBlock
                                    id={block.id}
                                    title={block.title}
                                    prompt={block.prompt || ""}
                                    correctAnswers={block.correctAnswers || []}
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
                                <button
                                    onClick={() => addBlock('fill-in-the-blanks')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">✍️</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Blanks</span>
                                </button>
                                <button
                                    onClick={() => addBlock('matching')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🔗</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Match</span>
                                </button>
                                <button
                                    onClick={() => addBlock('ordering')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🔢</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order</span>
                                </button>
                                <button
                                    onClick={() => addBlock('short-answer')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">💬</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Short</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
