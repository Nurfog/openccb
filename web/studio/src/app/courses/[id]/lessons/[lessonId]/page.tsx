"use client";

import { useEffect, useState, useCallback } from "react";
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { cmsApi, Lesson, Block, GradingCategory, LibraryBlock, Rubric, RubricLevel, RubricCriterion, LessonDependency, getImageUrl } from '@/lib/api';
import {
    Layout,
    CheckCircle2,
    Check,
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
import MediaPlayer from "@/components/MediaPlayer";

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
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
                        <Link href={`/courses/${params.id}`} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Outline</Link>
                        <span className="text-slate-300 dark:text-gray-700">/</span>
                        <span className="text-blue-600 dark:text-blue-500">Activity Builder</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {editingId === 'lesson-title' ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveLessonTitle()}
                                    className="text-4xl font-black bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] px-6 py-3 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all text-slate-900 dark:text-white shadow-inner"
                                />
                                <button onClick={handleSaveLessonTitle} className="p-3 bg-green-500 text-white rounded-2xl shadow-xl shadow-green-500/20 active:scale-95 transition-all"><Save className="w-6 h-6" /></button>
                                <button onClick={() => setEditingId(null)} className="p-3 bg-slate-100 dark:bg-white/10 text-slate-400 rounded-2xl active:scale-95 transition-all"><X className="w-6 h-6" /></button>
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
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setEditMode(false)}
                                className="px-8 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-white/10 transition-all text-slate-500 dark:text-white active:scale-95 shadow-sm"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 hover:bg-blue-500 transition-all active:scale-95 disabled:bg-slate-200"
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setEditMode(true)}
                            className="group px-10 py-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] hover:border-blue-500/50 hover:shadow-xl transition-all flex items-center gap-3 text-slate-700 dark:text-white active:scale-95 shadow-md"
                        >
                            <span className="group-hover:rotate-12 transition-transform text-lg">✏️</span> Edit Activity
                        </button>
                    )}
                </div>
            </div>

            {editMode && (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white uppercase tracking-tight">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                                    <Target size={24} />
                                </div>
                                Grading Policy
                            </h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-gray-500 mt-2 ml-15">Configure how this activity impacts the student gradebook</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isGraded}
                                onChange={(e) => setIsGraded(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-16 h-9 bg-slate-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4.5px] after:start-[5px] after:bg-white after:border-slate-300 dark:after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-blue-600 group-hover:after:scale-105 transition-all shadow-md"></div>
                            <span className="ms-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-400 peer-checked:text-blue-600 dark:peer-checked:text-blue-400 transition-colors">
                                {isGraded ? "Graded" : "Unscored"}
                            </span>
                        </label>
                    </div>

                    <div className="flex items-center justify-between pt-10 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white uppercase tracking-tight">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
                                    <Eye size={24} />
                                </div>
                                Discovery Settings
                            </h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-gray-500 mt-2 ml-15">Control how this lesson appears to prospective students</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isPreviewable}
                                onChange={(e) => setIsPreviewable(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-16 h-9 bg-slate-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4.5px] after:start-[5px] after:bg-white after:border-slate-300 dark:after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-amber-600 group-hover:after:scale-105 transition-all shadow-md"></div>
                            <span className="ms-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-400 peer-checked:text-amber-600 dark:peer-checked:text-amber-400 transition-colors">
                                {isPreviewable ? "Preview Public" : "Private"}
                            </span>
                        </label>
                    </div>

                    {isGraded && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-2 block">Assessment Category</span>
                                    <div className="relative group/select">
                                        <select
                                            value={selectedCategoryId}
                                            onChange={(e) => setSelectedCategoryId(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.25rem] px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all appearance-none font-bold text-slate-900 dark:text-white shadow-inner"
                                        >
                                            <option value="">Select Category...</option>
                                            {gradingCategories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name} ({cat.weight}%)
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDown size={18} />
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-gray-500 italic mt-2 pl-2 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        Define rules in <Link href={`/courses/${params.id}/grading`} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-black uppercase tracking-widest decoration-blue-500/30 underline-offset-4 underline">Grading Policy</Link>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-2 block">Evaluation Rubric (Optional)</span>
                                    <div className="bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/10 rounded-[1.5rem] p-6 max-h-56 overflow-y-auto space-y-3 shadow-inner">
                                        {courseRubrics.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-gray-500 italic">
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                                                    <Library size={16} />
                                                </div>
                                                <p className="text-xs font-medium">No rubrics found for this course.</p>
                                            </div>
                                        ) : (
                                            courseRubrics.map(rubric => {
                                                const isAssigned = assignedRubricIds.includes(rubric.id);
                                                return (
                                                    <label key={rubric.id} className={`flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer group border ${isAssigned ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm'}`}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isAssigned ? 'bg-blue-600 border-blue-600' : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-700'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isAssigned}
                                                                    onChange={() => toggleRubric(rubric.id, isAssigned)}
                                                                    className="hidden"
                                                                />
                                                                {isAssigned && <Check size={14} className="text-white" />}
                                                            </div>
                                                            <span className={`text-sm font-black uppercase tracking-tight transition-colors ${isAssigned ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400 group-hover:text-blue-600'}`}>
                                                                {rubric.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] font-black text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/10 uppercase tracking-tighter">{rubric.total_points} PTS</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-gray-500 italic mt-2 pl-2 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        Create more in <Link href={`/courses/${params.id}/rubrics`} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-black uppercase tracking-widest decoration-blue-500/30 underline-offset-4 underline">Rubrics Manager</Link>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-slate-100 dark:border-white/5 animate-in fade-in duration-500">
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-2 block">Maximum Attempts</span>
                                        <div className="flex items-center gap-5">
                                            <input
                                                type="number"
                                                value={maxAttempts || ""}
                                                onChange={(e) => setMaxAttempts(e.target.value ? parseInt(e.target.value) : null)}
                                                placeholder="∞ Unlimited"
                                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.25rem] px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all w-40 text-slate-900 dark:text-white shadow-inner font-black"
                                            />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Clear for infinite</span>
                                        </div>
                                    </label>
                                </div>
                                <div className="space-y-3">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 block mb-2">Self-Correction System</span>
                                    <label className="flex items-center gap-4 cursor-pointer group relative">
                                        <input
                                            type="checkbox"
                                            checked={allowRetry}
                                            onChange={(e) => setAllowRetry(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-12 h-7 bg-slate-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[3.5px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-sm"></div>
                                        <span className="text-sm font-black uppercase tracking-tight text-slate-400 dark:text-gray-400 peer-checked:text-blue-700 dark:peer-checked:text-blue-400 transition-colors">Instant Feedback Mode</span>
                                    </label>
                                    <p className="text-[11px] font-medium text-slate-400 dark:text-gray-600 italic ml-1">Allows &quot;Validate Answer&quot; buttons in interactive blocks</p>
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
                    <div className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm hover:shadow-md transition-all">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white uppercase tracking-tight">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                                    <Settings size={24} />
                                </div>
                                Scheduling & Sequencing
                            </h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-gray-500 mt-2 ml-15">Establish temporal constraints and learning paths</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-2 block">Final Deadline</span>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.25rem] px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all font-black text-slate-900 dark:text-white shadow-inner"
                                    />
                                </label>
                            </div>
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-2 block">Event Marker Type</span>
                                    <div className="relative group/select">
                                        <select
                                            value={importantDateType}
                                            onChange={(e) => setImportantDateType(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.25rem] px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all appearance-none font-black text-slate-900 dark:text-white shadow-inner"
                                        >
                                            <option value="">Standard Activity</option>
                                            <option value="exam">🏆 Final Exam</option>
                                            <option value="assignment">📝 Main Assignment</option>
                                            <option value="milestone">🚩 Project Milestone</option>
                                            <option value="live-session">🎥 Live Training</option>
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDown size={18} />
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        {/* Prerequisites Sub-Panel inside Scheduling */}
                        <div className="pt-10 border-t border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-8 uppercase tracking-[0.2em] text-[10px] font-black text-slate-400 dark:text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-500 shadow-lg shadow-blue-500/50"></span>
                                Learning Dependency Graph
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-gray-200">Prerequisites</h4>
                                    <div className="bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-[2rem] p-6 max-h-72 overflow-y-auto space-y-3 shadow-inner">
                                        {allLessons.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic p-6 text-center">No other modules in focus.</p>
                                        ) : (
                                            allLessons.map(l => {
                                                const dep = dependencies.find(d => d.prerequisite_lesson_id === l.id);
                                                const isAssigned = !!dep;
                                                return (
                                                    <div key={l.id} className={`p-4 rounded-[1.25rem] transition-all group border ${isAssigned ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' : 'bg-white dark:bg-white/5 border-slate-50 dark:border-white/5 hover:border-indigo-300 shadow-sm'}`}>
                                                        <label className="flex items-center justify-between cursor-pointer">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-700'}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isAssigned}
                                                                        onChange={() => toggleDependency(l.id, isAssigned)}
                                                                        className="hidden"
                                                                    />
                                                                    {isAssigned && <Check size={14} className="text-white" />}
                                                                </div>
                                                                <span className={`text-sm font-black uppercase tracking-tight transition-colors ${isAssigned ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-500 dark:text-gray-400 group-hover:text-indigo-600'}`}>
                                                                    {l.title}
                                                                </span>
                                                            </div>
                                                            {l.is_graded && (
                                                                <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-500/20">GRADED</span>
                                                            )}
                                                        </label>
                                                        {isAssigned && l.is_graded && (
                                                            <div className="mt-4 pl-9 flex items-center gap-4 animate-in slide-in-from-left-4 duration-500">
                                                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-extrabold uppercase tracking-widest">MIN % SCORE</span>
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
                                                                    className="w-16 bg-white dark:bg-black/60 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-black text-center focus:outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-inner"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center gap-6">
                                    <div className="p-6 rounded-[2rem] bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
                                                <Layout size={24} />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-black uppercase tracking-tight text-indigo-700 dark:text-indigo-300">Intelligent Flow</h5>
                                                <p className="text-[11px] font-medium text-indigo-500/80 dark:text-indigo-300/60 leading-relaxed mt-2">
                                                    Locked nodes appear with a lock visualizer until prerequisites are cleared by the student.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-[2rem] bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
                                                <CheckCircle2 size={24} />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-black uppercase tracking-tight text-emerald-700 dark:text-emerald-300">Mastery Gates</h5>
                                                <p className="text-[11px] font-medium text-emerald-500/80 dark:text-emerald-300/60 leading-relaxed mt-2">
                                                    When score thresholds are set, success in prior activities is mandatory for progression.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* AI Magic Section */}
            {
                editMode && (
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm hover:shadow-md transition-all group/ai overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/ai:bg-indigo-500/10 transition-colors"></div>
                        <div className="flex items-center gap-4 z-10 relative">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-600 dark:bg-white/10 flex items-center justify-center text-white dark:text-indigo-400 shadow-xl shadow-indigo-500/20">
                                <Brain size={32} className="animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase">AI Content Copilot</h3>
                                <p className="text-[10px] text-slate-400 dark:text-gray-400 mt-1 uppercase tracking-[0.2em] font-black">Powered by Neural Processing Unit</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 z-10 relative">
                            <button
                                onClick={handleSummarize}
                                disabled={isGeneratingSummary}
                                className={`group/btn p-8 rounded-[2rem] border transition-all text-left flex flex-col gap-4 shadow-sm relative overflow-hidden ${isGeneratingSummary ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300 animate-pulse' : summary ? 'bg-indigo-50/50 dark:bg-white/5 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:border-indigo-400' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-400 dark:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10'}`}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm group-hover/btn:scale-110 transition-transform">
                                    {isGeneratingSummary ? '⏳' : <ChevronDown className="rotate-90" />}
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Semantic Analysis</div>
                                    <div className="font-black text-xl tracking-tight">{isGeneratingSummary ? 'Processing Content...' : summary ? 'Refresh Summary' : 'Extract Summary'}</div>
                                </div>
                            </button>

                            <button
                                onClick={handleGenerateQuiz}
                                disabled={isGeneratingQuiz}
                                className={`group/btn p-8 border rounded-[2rem] transition-all text-left flex flex-col gap-4 shadow-sm relative overflow-hidden ${isGeneratingQuiz ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/50 text-purple-600 dark:text-purple-300 animate-pulse' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-400 dark:text-purple-400 hover:border-purple-500/50 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-500/10'}`}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm group-hover/btn:scale-110 transition-transform">
                                    {isGeneratingQuiz ? '⏳' : <Target />}
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Knowledge Check</div>
                                    <div className="font-black text-xl tracking-tight">{isGeneratingQuiz ? 'Building Quiz...' : 'Generate New Test'}</div>
                                </div>
                            </button>

                        </div>
                    </div>
                )
            }

            {/* AI Summary Visualization */}
            {
                (summary || editMode) && (
                    <div className="bg-white dark:bg-white/5 border border-indigo-100 dark:border-indigo-500/20 rounded-[2.5rem] p-10 space-y-8 animate-in fade-in duration-700 shadow-sm relative overflow-hidden group/summary">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40"></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Brain size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase">Neural Insight Summary</h3>
                                    <p className="text-[10px] text-slate-400 dark:text-gray-400 mt-1 uppercase tracking-[0.2em] font-black">Synthesized from activity contents</p>
                                </div>
                            </div>
                        </div>
                        {editMode ? (
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="Write a concise executive summary..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-[2rem] p-8 text-sm text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[160px] transition-all font-medium leading-relaxed shadow-inner"
                            />
                        ) : (
                            <div className="relative">
                                <span className="absolute -left-4 -top-4 text-6xl text-indigo-500/10 font-serif">&ldquo;</span>
                                <div className="text-lg text-slate-600 dark:text-gray-300 leading-relaxed italic pl-6 font-medium">
                                    {summary}
                                </div>
                                <span className="absolute -right-2 -bottom-4 text-6xl text-indigo-500/10 font-serif">&rdquo;</span>
                            </div>
                        )}
                    </div>
                )
            }

            <div className="space-y-16">
                {blocks.map((block, index) => (
                    <div key={block.id} className="relative group/block animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                        {editMode && (
                            <div className="absolute -left-20 top-0 h-full flex flex-col items-center gap-3 opacity-0 group-hover/block:opacity-100 transition-all duration-300 -translate-x-4 group-hover/block:translate-x-0">
                                <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] shadow-xl">
                                    <button
                                        onClick={() => moveBlock(index, 'up')}
                                        disabled={index === 0}
                                        className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-400 flex items-center justify-center hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-sm border border-slate-100 dark:border-transparent"
                                        title="Subir Bloque"
                                    >
                                        <ChevronUp className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => moveBlock(index, 'down')}
                                        disabled={index === blocks.length - 1}
                                        className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-400 flex items-center justify-center hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-sm border border-slate-100 dark:border-transparent"
                                        title="Bajar Bloque"
                                    >
                                        <ChevronDown className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] shadow-xl">
                                    <button
                                        onClick={() => openSaveToLibraryModal(block)}
                                        className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 dark:border-transparent shadow-sm"
                                        title="Guardar en Biblioteca"
                                    >
                                        <BookMarked className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => removeBlock(block.id)}
                                        className="w-10 h-10 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-transparent shadow-sm"
                                        title="Eliminar Bloque"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
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

                {!editMode && blocks.length === 0 && lesson.content_url && (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 mb-12">
                        <MediaPlayer
                            src={getImageUrl(lesson.content_url)}
                            type={lesson.content_type || 'video'}
                            transcription={lesson.transcription}
                        />
                        <div className="mt-6 p-6 glass-card bg-blue-500/5 border-blue-500/10 text-center rounded-[2rem]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                AI Generated Content Preview
                            </p>
                        </div>
                    </div>
                )}

                {editMode && (
                    <div className="pt-20 border-t border-slate-100 dark:border-white/5">
                        <div className="flex flex-col items-center gap-12">
                            <div className="text-center space-y-2">
                                <h3 className="text-sm font-black uppercase tracking-[0.4em] text-slate-400 dark:text-gray-500">Infinite Canvas</h3>
                                <p className="text-[10px] font-bold text-slate-300 dark:text-gray-600 uppercase tracking-widest">Select a specialized block to expand your activity</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 w-full">
                                {[
                                    { type: 'description', icon: '📄', label: 'Text Block', color: 'blue' },
                                    { type: 'media', icon: '🎬', label: 'Hyper Media', color: 'indigo' },
                                    { type: 'video_marker', icon: '⏱️', label: 'Interactive', color: 'violet' },
                                    { type: 'document', icon: '📚', label: 'Resources', color: 'slate' },
                                    { type: 'quiz', icon: '💡', label: 'Knowledge', color: 'blue' },
                                    { type: 'fill-in-the-blanks', icon: '✍️', label: 'Syntax', color: 'indigo' },
                                    { type: 'matching', icon: '🔗', label: 'Relations', color: 'violet' },
                                    { type: 'ordering', icon: '🔢', label: 'Sequence', color: 'blue' },
                                    { type: 'short-answer', icon: '💬', label: 'Open-Ended', color: 'indigo' },
                                    { type: 'hotspot', icon: '🔍', label: 'Hotspot', color: 'amber' },
                                    { type: 'audio-response', icon: '🎤', label: 'Phonetic', color: 'purple' },
                                    { type: 'memory-match', icon: '🧠', label: 'Cognitive', color: 'fuchsia' },
                                    { type: 'peer-review', icon: '👥', label: 'Peer Review', color: 'rose' },
                                ].map((item) => (
                                    <button
                                        key={item.type}
                                        onClick={() => addBlock(item.type as any)}
                                        className="flex flex-col items-center justify-center gap-3 p-6 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] hover:border-blue-500/50 hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 group shadow-sm shrink-0"
                                    >
                                        <span className="text-3xl group-hover:scale-125 transition-transform duration-300">{item.icon}</span>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 group-hover:text-blue-600 transition-colors uppercase">{item.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-6 pt-8">
                                <button
                                    onClick={handleGenerateQuiz}
                                    disabled={isGeneratingQuiz}
                                    className="px-10 py-5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-[2rem] shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 group disabled:opacity-50"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl group-hover:rotate-12 transition-transform">
                                        {isGeneratingQuiz ? '⏳' : '✨'}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Neural Engine</div>
                                        <div className="font-black text-sm uppercase tracking-wider">{isGeneratingQuiz ? 'Constructing...' : 'AI Builder'}</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setIsLibraryPanelOpen(true)}
                                    className="px-10 py-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-[2rem] shadow-xl hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-95 transition-all flex items-center gap-4 group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                        <Library size={24} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Personal Vault</div>
                                        <div className="font-black text-sm uppercase tracking-wider">Cloud Library</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isAIQuizModalOpen}
                onClose={() => !isGeneratingQuiz && setIsAIQuizModalOpen(false)}
                title="AI Neural Configuration"
            >
                <form onSubmit={handleConfirmGenerateQuiz} className="space-y-8 p-4">
                    <div className="p-6 rounded-[1.5rem] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
                            <Brain size={20} />
                        </div>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed font-black uppercase tracking-tight">
                            Define the thematic focus. The model will synthesize activity blocks based on your curriculum constraints.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">
                            Thematic Context / Focus Area
                        </label>
                        <textarea
                            autoFocus
                            value={aiQuizContext}
                            onChange={(e) => setAiQuizContext(e.target.value)}
                            placeholder="e.g. Focus on cognitive load management, or prioritize practical applications..."
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-[1.5rem] p-6 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-900 dark:text-white h-32 resize-none shadow-inner font-medium"
                            disabled={isGeneratingQuiz}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">
                            Block Architecture
                        </label>
                        <div className="relative group/select">
                            <select
                                value={aiQuizType}
                                onChange={(e) => setAiQuizType(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-900 dark:text-white appearance-none font-black uppercase tracking-tight shadow-inner"
                                disabled={isGeneratingQuiz}
                            >
                                <option value="multiple-choice">Multiple Choice Matrix</option>
                                <option value="true-false">Binary Validation (T/F)</option>
                                <option value="vocabulary">Lexical Focus / Vocab</option>
                                <option value="grammar">Structural / Grammar Focus</option>
                                <option value="memory-match">Conceptual Memory Match</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsAIQuizModalOpen(false)}
                            disabled={isGeneratingQuiz}
                            className="flex-1 px-8 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl transition-all text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-50 active:scale-95 shadow-sm"
                        >
                            Abort
                        </button>
                        <button
                            type="submit"
                            disabled={isGeneratingQuiz}
                            className="flex-[2] px-8 py-4 bg-indigo-600 text-white rounded-2xl transition-all shadow-xl shadow-indigo-500/40 font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-indigo-500 active:scale-95 disabled:bg-slate-300"
                        >
                            {isGeneratingQuiz ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Synthesizing...
                                </>
                            ) : (
                                "Initiate Generation"
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
