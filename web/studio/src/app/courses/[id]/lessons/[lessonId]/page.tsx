"use client";

import { useEffect, useState, useCallback } from "react";
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { cmsApi, Lesson, Block, GradingCategory, LibraryBlock, Rubric, RubricLevel, RubricCriterion, LessonDependency } from '@/lib/api';
import {
    Layout,
    CheckCircle2,
    Pencil,
    Save,
    Trash2,
    Plus,
    X,
    ChevronDown,
    ChevronUp,
    Settings,
    Target,
    Eye,
    Brain,
    Library,
    BookMarked,
    ArrowLeft
} from 'lucide-react';
import DescriptionBlock from "@/components/blocks/DescriptionBlock";
import MediaBlock from "@/components/blocks/MediaBlock";
import QuizBlock from "@/components/blocks/QuizBlock";
import FillInTheBlanksBlock from "@/components/blocks/FillInTheBlanksBlock";
import MatchingBlock from "@/components/blocks/MatchingBlock";
import OrderingBlock from "@/components/blocks/OrderingBlock";
import ShortAnswerBlock from "@/components/blocks/ShortAnswerBlock";
import DocumentBlock from "@/components/blocks/DocumentBlock";
import VideoMarkerBlock from "@/components/blocks/VideoMarkerBlock";
import AudioResponseBlock from "@/components/blocks/AudioResponseBlock";
import HotspotBlock from "@/components/blocks/HotspotBlock";
import MemoryBlock from "@/components/blocks/MemoryBlock";
import PeerReviewBlock from "@/components/blocks/PeerReviewBlock";
import SaveToLibraryModal from "@/components/modals/SaveToLibraryModal";
import LibraryPanel from "@/components/LibraryPanel";
import Modal from "@/components/Modal";

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
    const [isPreviewable, setIsPreviewable] = useState(false);

    // Rubric State
    const [courseRubrics, setCourseRubrics] = useState<Rubric[]>([]);
    const [assignedRubricIds, setAssignedRubricIds] = useState<string[]>([]);

    // Content Libraries states
    const [isSaveToLibraryModalOpen, setIsSaveToLibraryModalOpen] = useState(false);
    const [blockToSave, setBlockToSave] = useState<Block | null>(null);
    const [isLibraryPanelOpen, setIsLibraryPanelOpen] = useState(false);

    // Learning Sequences State
    const [allLessons, setAllLessons] = useState<Lesson[]>([]);
    const [dependencies, setDependencies] = useState<LessonDependency[]>([]);

    // AI Quiz Generation State
    const [isAIQuizModalOpen, setIsAIQuizModalOpen] = useState(false);
    const [aiQuizContext, setAiQuizContext] = useState("");
    const [aiQuizType, setAiQuizType] = useState("multiple-choice");

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
                setIsPreviewable(lessonData.is_previewable || false);

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

                // Load course rubrics and lesson rubrics
                const [allRubrics, lessonRubrics, courseOutline, lessonDeps] = await Promise.all([
                    cmsApi.listCourseRubrics(params.id),
                    cmsApi.getLessonRubrics(params.lessonId),
                    cmsApi.getCourseWithFullOutline(params.id),
                    cmsApi.listLessonDependencies(params.lessonId)
                ]);
                setCourseRubrics(allRubrics);
                setAssignedRubricIds(lessonRubrics.map(r => r.id));

                // Extract all lessons from outline for prerequisite selection
                const lessons: Lesson[] = [];
                courseOutline.modules?.forEach(m => {
                    m.lessons.forEach(l => {
                        if (l.id !== params.lessonId) {
                            lessons.push(l);
                        }
                    });
                });
                setAllLessons(lessons);
                setDependencies(lessonDeps);
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

    const toggleRubric = async (rubricId: string, isAssigned: boolean) => {
        try {
            if (isAssigned) {
                await cmsApi.unassignRubricFromLesson(params.lessonId, rubricId);
                setAssignedRubricIds(assignedRubricIds.filter(id => id !== rubricId));
            } else {
                await cmsApi.assignRubricToLesson(params.lessonId, rubricId);
                setAssignedRubricIds([...assignedRubricIds, rubricId]);
            }
        } catch (err) {
            console.error("Failed to toggle rubric", err);
            alert("Failed to update rubric assignment.");
        }
    };

    const handleSave = async () => {
        if (!lesson) return;
        setIsSaving(true);
        try {
            // Sync content_url for video/audio lessons from the first media block
            let content_url = lesson.content_url;
            let content_type = lesson.content_type;

            const mediaBlock = blocks.find(b => b.type === 'media' || b.type === 'video_marker');
            if (mediaBlock && mediaBlock.url) {
                content_url = mediaBlock.url;
                // If it's a video marker or explicitly a video/audio media block
                if (mediaBlock.type === 'video_marker') {
                    content_type = 'video';
                } else if (mediaBlock.type === 'media') {
                    content_type = mediaBlock.media_type || 'video';
                }
            }

            const updated = await cmsApi.updateLesson(lesson.id, {
                metadata: { ...lesson.metadata, blocks },
                content_url,
                content_type, // Sync type to ensure backend triggers transcription
                summary,
                is_graded: isGraded,
                grading_category_id: selectedCategoryId || null,
                max_attempts: maxAttempts,
                allow_retry: allowRetry,
                due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
                important_date_type: (importantDateType || undefined) as 'exam' | 'assignment' | 'milestone' | 'live-session' | undefined,
                is_previewable: isPreviewable
            });
            setLesson(updated);
            setEditMode(false);
        } catch {
            alert("Failed to save activity.");
        } finally {
            setIsSaving(false);
        }
    };

    const addBlock = (type: Block['type']) => {
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
            ...(type === 'video_marker' && { url: "", title: "Video Interactivo", markers: [] }),
            ...(type === 'audio-response' && { prompt: "Ask a question for the student to record their answer...", keywords: [], timeLimit: 60 }),
            ...(type === 'hotspot' && { imageUrl: "", description: "Find the following items...", hotspots: [] }),
            ...(type === 'memory-match' && { pairs: [{ id: "1", left: "Term A", right: "Match A" }] }),
            ...(type === 'peer-review' && { prompt: "Submit your work below.", reviewCriteria: "Evaluate based on clarity and completeness." }),
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

    // Content Libraries functions
    const handleSaveToLibrary = async (name: string, description: string, tags: string[]) => {
        if (!blockToSave) return;

        try {
            await cmsApi.createLibraryBlock({
                name,
                description,
                block_type: blockToSave.type,
                block_data: blockToSave,
                tags,
            });
            alert('¡Bloque guardado en la biblioteca exitosamente!');
        } catch (error) {
            console.error('Error saving to library:', error);
            throw error;
        }
    };

    const handleSelectFromLibrary = (libraryBlock: LibraryBlock) => {
        // Create a new block from the library block
        const newBlock: Block = {
            ...libraryBlock.block_data,
            id: Math.random().toString(36).substr(2, 9), // New unique ID
        };
        setBlocks([...blocks, newBlock]);
    };

    const openSaveToLibraryModal = (block: Block) => {
        setBlockToSave(block);
        setIsSaveToLibraryModalOpen(true);
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

    const toggleDependency = async (prerequisiteId: string, isAssigned: boolean) => {
        try {
            if (isAssigned) {
                await cmsApi.removeDependency(params.lessonId, prerequisiteId);
                setDependencies(dependencies.filter(d => d.prerequisite_lesson_id !== prerequisiteId));
            } else {
                const newDep = await cmsApi.assignDependency(params.lessonId, { prerequisite_lesson_id: prerequisiteId });
                setDependencies([...dependencies, newDep]);
            }
        } catch (err) {
            console.error("Failed to toggle dependency", err);
            alert("Failed to update prerequisite assignment.");
        }
    };

    const handleGenerateQuiz = () => {
        setIsAIQuizModalOpen(true);
    };

    const handleConfirmGenerateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lesson) return;
        setIsAIQuizModalOpen(false);
        setIsGeneratingQuiz(true);
        try {
            const newBlocks = await cmsApi.generateQuiz(lesson.id, {
                context: aiQuizContext,
                quiz_type: aiQuizType
            });
            setBlocks([...blocks, ...newBlocks]);
            setAiQuizContext("");
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 dark:border-white/5 pb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] text-blue-600 dark:text-blue-500 font-bold uppercase tracking-[0.2em]">
                        <Link href={`/courses/${params.id}`} className="hover:text-slate-900 dark:text-white transition-colors">Outline</Link>
                        <span className="text-slate-300 dark:text-gray-700">/</span>
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
                                <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">{lesson.title}</h2>
                                <button
                                    onClick={() => { setEditingId('lesson-title'); setEditValue(lesson.title); }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 dark:text-white transition-opacity"
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
                            <button onClick={() => setEditMode(false)} className="px-6 py-2.5 glass text-xs font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-white">Discard</button>
                            <button onClick={handleSave} disabled={isSaving} className="btn-premium px-8 py-2.5 min-w-[140px] text-xs font-bold uppercase tracking-widest text-white">
                                {isSaving ? "Saving..." : "Publish Changes"}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setEditMode(true)} className="px-8 py-3 glass text-xs font-bold uppercase tracking-widest hover:border-blue-500/50 transition-all flex items-center gap-2 group text-slate-700 dark:text-white">
                            <span className="group-hover:rotate-12 transition-transform">✏️</span> Edit Activity
                        </button>
                    )}
                </div>
            </div>

            {editMode && (
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="text-blue-500">⚖️</span> Grading Configuration
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Determine if this activity contributes to the final grade</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isGraded}
                                onChange={(e) => setIsGraded(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-8 bg-slate-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-slate-300 dark:after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 group-hover:after:scale-110 transition-all shadow-sm"></div>
                            <span className="ms-3 text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-gray-400 peer-checked:text-blue-600 dark:peer-checked:text-blue-400 transition-colors">
                                {isGraded ? "Graded" : "Not Graded"}
                            </span>
                        </label>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-white/5">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="text-blue-500">🔓</span> Course Preview
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Allow students to view this lesson without being enrolled</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isPreviewable}
                                onChange={(e) => setIsPreviewable(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-8 bg-slate-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-slate-300 dark:after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 group-hover:after:scale-110 transition-all shadow-sm"></div>
                            <span className="ms-3 text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-gray-400 peer-checked:text-blue-600 dark:peer-checked:text-blue-400 transition-colors">
                                {isPreviewable ? "Preview Enabled" : "Preview Disabled"}
                            </span>
                        </label>
                    </div>

                    {isGraded && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2 block">Assessment Category</span>
                                    <select
                                        value={selectedCategoryId}
                                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none font-bold text-slate-900 dark:text-white"
                                    >
                                        <option value="">Select Category...</option>
                                        {gradingCategories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} ({cat.weight}%)
                                            </option>
                                        ))}
                                    </select>
                                    <div className="text-[10px] text-slate-500 dark:text-gray-500 italic mt-1 pl-1">
                                        Manage categories in <Link href={`/courses/${params.id}/grading`} className="text-blue-600 dark:text-blue-400 hover:underline">Grading Policy</Link>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2 block">Rubric (Optional)</span>
                                    <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2">
                                        {courseRubrics.length === 0 ? (
                                            <p className="text-xs text-slate-400 dark:text-gray-500 italic p-2 text-center">No rubrics found in this course.</p>
                                        ) : (
                                            courseRubrics.map(rubric => {
                                                const isAssigned = assignedRubricIds.includes(rubric.id);
                                                return (
                                                    <label key={rubric.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/5 transition-all cursor-pointer group">
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={isAssigned}
                                                                onChange={() => toggleRubric(rubric.id, isAssigned)}
                                                                className="w-4 h-4 rounded border-slate-300 dark:border-gray-700 bg-slate-100 dark:bg-gray-800 text-blue-500 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm font-medium text-slate-600 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{rubric.name}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-white/5 px-1.5 py-0.5 rounded">{rubric.total_points} pts</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 italic mt-1 pl-1">
                                        Manage rubrics in <Link href={`/courses/${params.id}/rubrics`} className="text-blue-400 hover:underline">Rubrics Manager</Link>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5 animate-in fade-in duration-500">
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2 block">Maximum Attempts</span>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={maxAttempts || ""}
                                                onChange={(e) => setMaxAttempts(e.target.value ? parseInt(e.target.value) : null)}
                                                placeholder="Unlimited"
                                                className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all w-32 text-slate-900 dark:text-white"
                                            />
                                            <span className="text-xs text-slate-500 dark:text-gray-500">Leave empty for unlimited</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 block mb-2">After Submission</span>
                                    <label className="flex items-center gap-3 cursor-pointer group relative">
                                        <input
                                            type="checkbox"
                                            checked={allowRetry}
                                            onChange={(e) => setAllowRetry(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-6 bg-slate-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4 shadow-sm"></div>
                                        <span className="text-sm font-bold text-slate-400 dark:text-gray-400 peer-checked:text-slate-900 dark:peer-checked:text-white transition-colors">Allow Instant Corrections</span>
                                    </label>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-600 italic">Enables &quot;Check Answer&quot; buttons for individual blocks</p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-200 dark:border-white/5 animate-in fade-in duration-500 delay-150">
                                <div className="flex items-center gap-2 mb-6 uppercase tracking-[0.2em] text-[10px] font-black text-slate-400 dark:text-gray-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-500 shadow-lg shadow-blue-500/50"></span>
                                    Access & Prerequisites
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-gray-200">Prerequisites</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-500 leading-relaxed">
                                            Students must complete these lessons before they can access this one.
                                        </p>
                                        <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 max-h-60 overflow-y-auto space-y-2">
                                            {allLessons.length === 0 ? (
                                                <p className="text-xs text-slate-500 dark:text-gray-500 italic p-4 text-center">No other lessons available.</p>
                                            ) : (
                                                allLessons.map(l => {
                                                    const dep = dependencies.find(d => d.prerequisite_lesson_id === l.id);
                                                    const isAssigned = !!dep;
                                                    return (
                                                        <div key={l.id} className="space-y-2 p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 transition-all group border border-transparent hover:border-slate-300 dark:hover:border-white/10">
                                                            <label className="flex items-center justify-between cursor-pointer">
                                                                <div className="flex items-center gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isAssigned}
                                                                        onChange={() => toggleDependency(l.id, isAssigned)}
                                                                        className="w-4 h-4 rounded-md border-slate-300 dark:border-gray-700 bg-slate-100 dark:bg-gray-800 text-blue-500 focus:ring-blue-500 transition-all"
                                                                    />
                                                                    <span className={`text-sm font-medium transition-colors ${isAssigned ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-gray-200'}`}>
                                                                        {l.title}
                                                                    </span>
                                                                </div>
                                                                {l.is_graded && (
                                                                    <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">Graded</span>
                                                                )}
                                                            </label>
                                                            {isAssigned && l.is_graded && (
                                                                <div className="pl-7 animate-in slide-in-from-left-2 duration-300">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Min. Score %</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            value={dep.min_score_percentage || 0}
                                                                            onChange={async (e) => {
                                                                                const minScore = parseFloat(e.target.value);
                                                                                try {
                                                                                    const updated = await cmsApi.assignDependency(params.lessonId, {
                                                                                        prerequisite_lesson_id: l.id,
                                                                                        min_score_percentage: minScore
                                                                                    });
                                                                                    setDependencies(dependencies.map(d => d.id === updated.id ? updated : d));
                                                                                } catch (err) {
                                                                                    console.error("Failed to update min score", err);
                                                                                }
                                                                            }}
                                                                            className="w-16 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-blue-600 dark:text-blue-400 font-bold focus:outline-none focus:border-blue-500"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-center gap-4 px-6 border-l border-slate-100 dark:border-white/5">
                                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                                            <div className="p-2 rounded-xl bg-indigo-500/20">
                                                <Layout className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-bold text-indigo-600 dark:text-indigo-300">Intelligent Sequences</h5>
                                                <p className="text-[11px] text-indigo-500 dark:text-indigo-300/60 leading-relaxed mt-1">
                                                    Locked lessons will be visible in the student outline with a lock icon 🔒 until they meet all prerequisites.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                            <div className="p-2 rounded-xl bg-blue-500/20">
                                                <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-bold text-blue-600 dark:text-blue-300">Completion Tracking</h5>
                                                <p className="text-[11px] text-blue-500 dark:text-blue-300/60 leading-relaxed mt-1">
                                                    If a minimum score is set, students must pass the prerequisite before the next lesson is unlocked.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {
                editMode && (
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="text-blue-500">📅</span> Scheduling & Deadlines
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Set deadlines and mark important dates for this activity</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2 block">Due Date</span>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
                                    />
                                </label>
                            </div>

                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2 block">Date Type</span>
                                    <select
                                        value={importantDateType}
                                        onChange={(e) => setImportantDateType(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none font-bold text-slate-900 dark:text-white"
                                    >
                                        <option value="">Standard Activity</option>
                                        <option value="exam">Exam</option>
                                        <option value="assignment">Assignment</option>
                                        <option value="milestone">Milestone</option>
                                        <option value="live-session">Live Session</option>
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
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🪄</span>
                            <div>
                                <h3 className="text-xl font-bold italic tracking-tight text-slate-900 dark:text-white">AI Content Assistant</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 uppercase tracking-widest font-bold">Automate your content creation with Local AI</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={handleSummarize}
                                disabled={isGeneratingSummary}
                                className={`p-6 rounded-2xl border transition-all text-left flex flex-col gap-2 shadow-sm ${isGeneratingSummary ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-600 dark:text-indigo-300 animate-pulse' : summary ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:border-indigo-500/60'}`}
                            >
                                <span className="text-xl">{isGeneratingSummary ? '⏳' : '✍️'}</span>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Summarization</div>
                                <div className="font-bold">{isGeneratingSummary ? 'Generating...' : summary ? 'Update Summary' : 'Generate Summary'}</div>
                            </button>

                            <button
                                onClick={handleGenerateQuiz}
                                disabled={isGeneratingQuiz}
                                className={`p-6 border rounded-2xl transition-all text-left flex flex-col gap-2 shadow-sm ${isGeneratingQuiz ? 'bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-300 animate-pulse' : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/60 text-purple-600 dark:text-purple-400'}`}
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
                                    <h3 className="text-xl font-bold font-black italic tracking-tight text-slate-900 dark:text-white">AI Lesson Summary</h3>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 uppercase tracking-widest font-bold">Key insights generated from content</p>
                                </div>
                            </div>
                        </div>

                        {editMode ? (
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="A concise summary of the lesson content..."
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-sm text-slate-700 dark:text-gray-300 focus:outline-none focus:border-blue-500/50 min-h-[120px] transition-all"
                            />
                        ) : (
                            <div className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed italic border-l-2 border-indigo-500/30 pl-6 py-2">
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
                                <span className="text-[10px] font-black text-slate-300 dark:text-gray-700 uppercase vertical-text mb-2">Move</span>
                                <button
                                    onClick={() => moveBlock(index, 'up')}
                                    disabled={index === 0}
                                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-400 flex items-center justify-center hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all border border-slate-200 dark:border-white/10 disabled:opacity-20 disabled:cursor-not-allowed group-hover/block:scale-110 shadow-sm"
                                    title="Move Up"
                                >
                                    <ChevronUp className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => moveBlock(index, 'down')}
                                    disabled={index === blocks.length - 1}
                                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-400 flex items-center justify-center hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all border border-slate-200 dark:border-white/10 disabled:opacity-20 disabled:cursor-not-allowed group-hover/block:scale-110 shadow-sm"
                                    title="Move Down"
                                >
                                    <ChevronDown className="w-5 h-5" />
                                </button>
                                <div className="h-4"></div>
                                <button
                                    onClick={() => openSaveToLibraryModal(block)}
                                    className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20 group-hover/block:scale-110 shadow-sm"
                                    title="Save to Library"
                                >
                                    <BookMarked className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => removeBlock(block.id)}
                                    className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20 group-hover/block:scale-110 shadow-sm"
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
                                    isGraded={isGraded}
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
                            {block.type === 'video_marker' && (
                                <VideoMarkerBlock
                                    title={block.title || ""}
                                    videoUrl={block.url || ""}
                                    markers={block.markers || []}
                                    editMode={editMode}
                                    isGraded={isGraded}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'audio-response' && (
                                <AudioResponseBlock
                                    id={block.id}
                                    title={block.title}
                                    prompt={block.prompt || ""}
                                    keywords={block.keywords || []}
                                    timeLimit={block.timeLimit}
                                    editMode={editMode}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'hotspot' && (
                                <HotspotBlock
                                    id={block.id}
                                    title={block.title}
                                    description={block.description}
                                    imageUrl={block.imageUrl}
                                    hotspots={block.hotspots || []}
                                    editMode={editMode}
                                    courseId={params.id}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'memory-match' && (
                                <MemoryBlock
                                    id={block.id}
                                    title={block.title}
                                    pairs={block.pairs || []}
                                    editMode={editMode}
                                    onChange={(updates) => updateBlock(block.id, updates)}
                                />
                            )}
                            {block.type === 'peer-review' && (
                                <PeerReviewBlock
                                    id={block.id}
                                    title={block.title}
                                    prompt={block.prompt || ""}
                                    reviewCriteria={block.reviewCriteria}
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
                                    onClick={() => addBlock('video_marker')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-indigo-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">⏱️</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Video+Q</span>
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
                                <button
                                    onClick={() => addBlock('audio-response')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-purple-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🎤</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Audio</span>
                                </button>
                                <button
                                    onClick={() => addBlock('hotspot')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-amber-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🔍</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Hotspot</span>
                                </button>
                                <button
                                    onClick={() => addBlock('memory-match')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-purple-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🧠</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Memory</span>
                                </button>
                                <button
                                    onClick={() => addBlock('peer-review')}
                                    className="flex flex-col items-center gap-2 p-6 glass hover:border-purple-500/50 transition-all group w-32"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">👥</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Peer Rev</span>
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

                                {/* Browse Library */}
                                <button
                                    onClick={() => setIsLibraryPanelOpen(true)}
                                    className="flex flex-col items-center gap-2 p-6 bg-gradient-to-b from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:border-emerald-500/60 rounded-3xl transition-all group w-36"
                                >
                                    <Library className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Library</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isAIQuizModalOpen}
                onClose={() => !isGeneratingQuiz && setIsAIQuizModalOpen(false)}
                title="AI Quiz Customization"
            >
                <form onSubmit={handleConfirmGenerateQuiz} className="space-y-6">
                    <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                        <p className="text-xs text-purple-300 leading-relaxed font-medium">
                            Tell the AI what to focus on and what type of questions you prefer.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                            Focus / Context
                        </label>
                        <textarea
                            autoFocus
                            value={aiQuizContext}
                            onChange={(e) => setAiQuizContext(e.target.value)}
                            placeholder="e.g. Focus on past tense verbs, or use vocabulary related to travel..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-all text-gray-900 dark:text-white h-24 resize-none"
                            disabled={isGeneratingQuiz}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                            Question Type
                        </label>
                        <select
                            value={aiQuizType}
                            onChange={(e) => setAiQuizType(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-all text-gray-900 dark:text-white appearance-none font-bold"
                            disabled={isGeneratingQuiz}
                        >
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="true-false">True / False</option>
                            <option value="vocabulary">Vocabulary Focus</option>
                            <option value="grammar">Grammar Focus</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsAIQuizModalOpen(false)}
                            disabled={isGeneratingQuiz}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isGeneratingQuiz}
                            className="flex-[2] px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-gray-900 dark:text-white rounded-lg transition-all shadow-lg shadow-purple-500/20 font-bold text-sm flex items-center justify-center gap-2"
                        >
                            {isGeneratingQuiz ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                "Generate Quiz"
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Content Libraries Modals */}
            {blockToSave && (
                <SaveToLibraryModal
                    block={blockToSave}
                    isOpen={isSaveToLibraryModalOpen}
                    onClose={() => {
                        setIsSaveToLibraryModalOpen(false);
                        setBlockToSave(null);
                    }}
                    onSave={handleSaveToLibrary}
                />
            )}

            <LibraryPanel
                isOpen={isLibraryPanelOpen}
                onClose={() => setIsLibraryPanelOpen(false)}
                onSelectBlock={handleSelectFromLibrary}
            />
        </div >
    );
}
