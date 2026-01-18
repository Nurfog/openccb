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
import DocumentBlock from "@/components/blocks/DocumentBlock";
import {
    Save,
    X,
    Pencil,
    ChevronUp,
    ChevronDown,
    Trash2
} from "lucide-react";

export default function LessonEditor({ params }: { params: { id: string; lessonId: string } }) {
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Activity State (Blocks)
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [summary, setSummary] = useState<string>("");
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [gradingCategories, setGradingCategories] = useState<GradingCategory[]>([]);
    const [isGraded, setIsGraded] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | "">("");
    const [maxAttempts, setMaxAttempts] = useState<number | null>(null);
    const [allowRetry, setAllowRetry] = useState(true);
    const [dueDate, setDueDate] = useState<string>("");
    const [importantDateType, setImportantDateType] = useState<string>("");

    const [editValue, setEditValue] = useState("");


    // Polling for AI status
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (lesson && (lesson.transcription_status === 'queued' || lesson.transcription_status === 'processing')) {
            interval = setInterval(async () => {
                try {
                    const updated = await cmsApi.getLesson(params.lessonId);
                    setLesson(updated);

                    // If it finished, update local states
                    if (updated.transcription_status === 'completed') {
                        if (updated.transcription) {
                            // Automatically update summary if available? No, wait for manual trigger or auto-trigger?
                            // For now just update lesson
                        }
                    }
                } catch (err) {
                    console.error("Polling failed", err);
                }
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [lesson, lesson?.transcription_status, params.lessonId]);


    useEffect(() => {
        const loadData = async () => {
            try {
                // Use cmsApi for consistency
                const lessonData = await cmsApi.getLesson(params.lessonId);
                setLesson(lessonData);
                setSummary(lessonData.summary || "");
                setIsGraded(lessonData.is_graded || false);
                setSelectedCategoryId(lessonData.grading_category_id || "");
                setMaxAttempts(lessonData.max_attempts);
                setAllowRetry(lessonData.allow_retry);
                setDueDate(lessonData.due_date ? new Date(lessonData.due_date).toISOString().split('T')[0] : "");
                setImportantDateType(lessonData.important_date_type || "");

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

    const handleSaveLessonTitle = async () => {
        if (!lesson || !editValue) return;
        try {
            const updated = await cmsApi.updateLesson(lesson.id, { title: editValue });
            setLesson(updated);
            setEditingId(null);
        } catch {
            alert("Failed to update title");
        }
    };

    const handleSave = async () => {
        if (!lesson) return;
        setIsSaving(true);
        try {
            // Sync content_url for video/audio lessons from the first media block
            let content_url = lesson.content_url;
            if (lesson.content_type === 'video' || lesson.content_type === 'audio') {
                const mediaBlock = blocks.find(b => b.type === 'media');
                if (mediaBlock && mediaBlock.url) {
                    content_url = mediaBlock.url;
                }
            }

            const updated = await cmsApi.updateLesson(lesson.id, {
                metadata: { ...lesson.metadata, blocks },
                content_url,
                summary,
                is_graded: isGraded,
                grading_category_id: selectedCategoryId || null,
                max_attempts: maxAttempts,
                allow_retry: allowRetry,
                due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
                important_date_type: (importantDateType || undefined) as 'exam' | 'assignment' | 'milestone' | 'live-session' | undefined
            });
            setLesson(updated);
            setEditMode(false);
        } catch {
            alert("Failed to save activity.");
        } finally {
            setIsSaving(false);
        }
    };

    const addBlock = (type: 'description' | 'media' | 'quiz' | 'fill-in-the-blanks' | 'matching' | 'ordering' | 'short-answer' | 'document') => {
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
            ...(type === 'document' && { url: "", title: "" }),
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


    const handleSummarize = async () => {
        if (!lesson) return;
        setIsGeneratingSummary(true);
        try {
            const updated = await cmsApi.summarizeLesson(lesson.id);
            setSummary(updated.summary || "");
        } catch {
            alert("Failed to generate summary.");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleGenerateQuiz = async () => {
        if (!lesson) return;
        setIsGeneratingQuiz(true);
        try {
            const newBlocks = await cmsApi.generateQuiz(lesson.id);
            setBlocks([...blocks, ...newBlocks]);
        } catch {
            alert("Failed to generate quiz.");
        } finally {
            setIsGeneratingQuiz(false);
        }
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
                    <div className="flex items-center gap-4">
                        {editingId === 'lesson-title' ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveLessonTitle()}
                                    className="text-4xl font-black bg-transparent border-b-2 border-blue-500 focus:outline-none"
                                />
                                <button onClick={handleSaveLessonTitle} className="text-green-400"><Save className="w-6 h-6" /></button>
                                <button onClick={() => setEditingId(null)} className="text-gray-400"><X className="w-6 h-6" /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 group">
                                <h2 className="text-4xl font-black tracking-tight">{lesson.title}</h2>
                                <button
                                    onClick={() => { setEditingId('lesson-title'); setEditValue(lesson.title); }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity"
                                >
                                    <Pencil className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
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
                            <div className="col-span-full space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Assessment Category</span>
                                <select
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none font-bold"
                                >
                                    <option value="" className="bg-gray-900 border-0">Select Category...</option>
                                    {gradingCategories.map((cat) => (
                                        <option key={cat.id} value={cat.id} className="bg-gray-900 border-0">
                                            {cat.name} ({cat.weight}%)
                                        </option>
                                    ))}
                                </select>
                                <div className="text-[10px] text-gray-500 italic mt-1 pl-1">
                                    Manage categories in <Link href={`/courses/${params.id}/grading`} className="text-blue-400 hover:underline">Grading Policy</Link>
                                </div>
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
                </div >
            )}

            {
                editMode && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <span className="text-blue-500">📅</span> Scheduling & Deadlines
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Set deadlines and mark important dates for this activity</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Due Date</span>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold"
                                    />
                                </label>
                            </div>

                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Date Type</span>
                                    <select
                                        value={importantDateType}
                                        onChange={(e) => setImportantDateType(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none font-bold"
                                    >
                                        <option value="" className="bg-gray-900">Standard Activity</option>
                                        <option value="exam" className="bg-gray-900">Exam</option>
                                        <option value="assignment" className="bg-gray-900">Assignment</option>
                                        <option value="milestone" className="bg-gray-900">Milestone</option>
                                        <option value="live-session" className="bg-gray-900">Live Session</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* AI Magic Section */}
            {
                editMode && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🪄</span>
                            <div>
                                <h3 className="text-xl font-bold italic tracking-tight">AI Content Assistant</h3>
                                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Automate your content creation with Local AI</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <button
                                onClick={handleSummarize}
                                disabled={isGeneratingSummary}
                                className={`p-6 rounded-2xl border transition-all text-left flex flex-col gap-2 ${isGeneratingSummary ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 animate-pulse' : summary ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:border-indigo-500/60'}`}
                            >
                                <span className="text-xl">{isGeneratingSummary ? '⏳' : '✍️'}</span>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Summarization</div>
                                <div className="font-bold">{isGeneratingSummary ? 'Generating...' : summary ? 'Update Summary' : 'Generate Summary'}</div>
                            </button>

                            <button
                                onClick={handleGenerateQuiz}
                                disabled={isGeneratingQuiz}
                                className={`p-6 border rounded-2xl transition-all text-left flex flex-col gap-2 ${isGeneratingQuiz ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 animate-pulse' : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/60 text-purple-400'}`}
                            >
                                <span className="text-xl">{isGeneratingQuiz ? '⏳' : '💡'}</span>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Assessments</div>
                                <div className="font-bold">{isGeneratingQuiz ? 'Building...' : 'Generate Quiz'}</div>
                            </button>
                        </div>
                    </div>
                )
            }

            {/* AI Summary Visualization */}
            {
                (summary || editMode) && (
                    <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-3xl p-8 space-y-6 animate-in fade-in duration-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">✨</span>
                                <div>
                                    <h3 className="text-xl font-bold font-black italic tracking-tight">AI Lesson Summary</h3>
                                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Key insights generated from content</p>
                                </div>
                            </div>
                        </div>

                        {editMode ? (
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="A concise summary of the lesson content..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 min-h-[120px] transition-all"
                            />
                        ) : (
                            <div className="text-sm text-gray-400 leading-relaxed italic border-l-2 border-indigo-500/30 pl-6 py-2">
                                &quot;{summary}&quot;
                            </div>
                        )}
                    </div>
                )
            }

            <div className="space-y-16">
                {blocks.map((block, index) => (
                    <div key={block.id} className="relative group/block animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                        {editMode && (
                            <div className="absolute -left-16 top-0 h-full flex flex-col items-center gap-2 opacity-100 transition-all">
                                <span className="text-[10px] font-black text-gray-700 uppercase vertical-text mb-2">Move</span>
                                <button
                                    onClick={() => moveBlock(index, 'up')}
                                    disabled={index === 0}
                                    className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed group-hover/block:scale-110"
                                    title="Move Up"
                                >
                                    <ChevronUp className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => moveBlock(index, 'down')}
                                    disabled={index === blocks.length - 1}
                                    className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed group-hover/block:scale-110"
                                    title="Move Down"
                                >
                                    <ChevronDown className="w-5 h-5" />
                                </button>
                                <div className="h-4"></div>
                                <button
                                    onClick={() => removeBlock(block.id)}
                                    className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20 group-hover/block:scale-110"
                                    title="Remove Block"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <div className="w-0.5 flex-1 bg-white/5 mt-2"></div>
                            </div>
                        )}

                        <div className="space-y-6">
                            {block.type === 'description' && (
                                <DescriptionBlock
                                    id={block.id}
                                    title={block.title}
                                    content={block.content || ""}
                                    editMode={editMode}
                                    courseId={params.id}
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
                            {block.type === 'document' && (
                                <DocumentBlock
                                    id={block.id}
                                    title={block.title}
                                    url={block.url || ""}
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
                                <button
                                    onClick={() => addBlock('document')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-blue-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">📚</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reading</span>
                                </button>

                                <div className="w-px h-12 bg-white/5"></div>

                                <button
                                    onClick={handleGenerateQuiz}
                                    disabled={isGeneratingQuiz}
                                    className="flex flex-col items-center gap-2 p-6 bg-gradient-to-b from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 hover:border-indigo-500/60 rounded-3xl transition-all group w-36"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">{isGeneratingQuiz ? '⏳' : '✨'}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{isGeneratingQuiz ? 'Building...' : 'AI Builder'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
