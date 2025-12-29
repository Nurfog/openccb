"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course, Module, Lesson } from "@/lib/api";
import Link from "next/link";
import {
    Plus,
    Pencil,
    ChevronUp,
    ChevronDown,
    PlayCircle,
    FileText,
    Calendar,
    CheckCircle2,
    Settings,
    BarChart2,
    Layout,
    Save,
    X,
    GripVertical,
    Trash2
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

interface FullModule extends Module {
    lessons: Lesson[];
}

export default function CourseEditor({ params }: { params: { id: string } }) {
    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<FullModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const startEditing = (id: string, currentTitle: string) => {
        setEditingId(id);
        setEditValue(currentTitle);
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await cmsApi.getCourseWithFullOutline(params.id);
                setCourse(data);
                setModules(data.modules as FullModule[]);
            } catch (err) {
                console.error("Failed to load course data:", err);
                setError("Failed to load course details. Is the backend running?");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [params.id]);

    const handleAddModule = async () => {
        const title = "";
        try {
            const newMod = await cmsApi.createModule(params.id, title, modules.length + 1);
            const fullMod = { ...newMod, lessons: [] };
            setModules([...modules, fullMod]);
            setEditingId(newMod.id);
            setEditValue(title);
        } catch {
            alert("Failed to create module");
        }
    };

    const handleAddLesson = async (moduleId: string) => {
        const mod = modules.find(m => m.id === moduleId);
        if (!mod) return;

        const title = "New Lesson";
        try {
            const newLesson = await cmsApi.createLesson(moduleId, title, "video", mod.lessons.length + 1);
            setModules(modules.map(m =>
                m.id === moduleId
                    ? { ...m, lessons: [...m.lessons, newLesson] }
                    : m
            ));
            setEditingId(newLesson.id);
            setEditValue(title);
        } catch {
            alert("Failed to create lesson");
        }
    };

    const handleSaveTitle = async (id: string, type: 'module' | 'lesson') => {
        if (!editValue) {
            setEditingId(null);
            return;
        }
        try {
            if (type === 'module') {
                await cmsApi.updateModule(id, { title: editValue });
                setModules(modules.map(m => m.id === id ? { ...m, title: editValue } : m));
            } else {
                await cmsApi.updateLesson(id, { title: editValue });
                setModules(modules.map(mod => ({
                    ...mod,
                    lessons: mod.lessons.map(l => l.id === id ? { ...l, title: editValue } : l)
                })));
            }
            setEditingId(null);
        } catch {
            alert("Failed to update title");
        }
    };

    const handleDeleteModule = async (id: string) => {
        if (!confirm("Are you sure you want to delete this module and all its lessons?")) return;
        try {
            await cmsApi.deleteModule(id);
            setModules(modules.filter(m => m.id !== id));
        } catch {
            alert("Failed to delete module");
        }
    };

    const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
        if (!confirm("Are you sure you want to delete this lesson?")) return;
        try {
            await cmsApi.deleteLesson(lessonId);
            setModules(modules.map(m =>
                m.id === moduleId
                    ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) }
                    : m
            ));
        } catch {
            alert("Failed to delete lesson");
        }
    };

    const handleReorderModule = async (index: number, direction: 'up' | 'down') => {
        const newModules = [...modules];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newModules.length) return;

        [newModules[index], newModules[targetIndex]] = [newModules[targetIndex], newModules[index]];

        const items = newModules.map((m, i) => ({ id: m.id, position: i + 1 }));
        setModules(newModules.map((m, i) => ({ ...m, position: i + 1 })));

        try {
            await cmsApi.reorderModules({ items });
        } catch {
            alert("Failed to save module order");
        }
    };

    const handleReorderLesson = async (moduleId: string, lessonIndex: number, direction: 'up' | 'down') => {
        const mod = modules.find(m => m.id === moduleId);
        if (!mod) return;

        const newLessons = [...mod.lessons];
        const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
        if (targetIndex < 0 || targetIndex >= newLessons.length) return;

        [newLessons[lessonIndex], newLessons[targetIndex]] = [newLessons[targetIndex], newLessons[lessonIndex]];

        const items = newLessons.map((l, i) => ({ id: l.id, position: i + 1 }));
        setModules(modules.map(m => m.id === moduleId ? { ...m, lessons: newLessons.map((l, i) => ({ ...l, position: i + 1 })) } : m));

        try {
            await cmsApi.reorderLessons({ items });
        } catch {
            alert("Failed to save lesson order");
        }
    };

    const [isPublishing, setIsPublishing] = useState(false);

    const handlePublish = async () => {
        if (!course) return;
        setIsPublishing(true);
        try {
            await cmsApi.publishCourse(params.id);
            alert("Course published successfully to LMS!");
        } catch (err) {
            console.error("Publish failed:", err);
            alert("Failed to publish course.");
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) return <div className="py-20 text-center">Loading editor...</div>;
    if (error) return <div className="py-20 text-center text-red-400">{error}</div>;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4 text-sm text-gray-400">
                <Link href="/" className="hover:text-white transition-colors">Courses</Link>
                <span>/</span>
                <span className="text-white">{course?.title}</span>
            </div>

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold">{course?.title}</h2>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-gray-400 text-sm">Editor - Outline</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${course?.pacing_mode === 'instructor_led' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                            {course?.pacing_mode?.replace('_', ' ') || 'Self Paced'}
                        </span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 glass hover:bg-white/10 transition-colors text-sm font-medium">
                        Preview
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className={`btn-primary flex items-center gap-2 ${isPublishing ? "opacity-75 cursor-wait" : ""}`}
                    >
                        {isPublishing ? "Publishing..." : "Publish to LMS"}
                    </button>
                </div>
            </div>

            <CourseEditorLayout activeTab="outline">
                <div className="p-8 space-y-6">
                    {modules.map((module, mIndex) => (
                        <div key={module.id} className="glass rounded-xl overflow-hidden border-white/5">
                            <div className="bg-white/5 px-6 py-4 flex justify-between items-center border-b border-white/5">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => handleReorderModule(mIndex, 'up')}
                                            disabled={mIndex === 0}
                                            className="text-gray-500 hover:text-blue-400 disabled:opacity-0 transition-colors"
                                        >
                                            <ChevronUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleReorderModule(mIndex, 'down')}
                                            disabled={mIndex === modules.length - 1}
                                            className="text-gray-500 hover:text-blue-400 disabled:opacity-0 transition-colors"
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <GripVertical className="text-gray-600 w-5 h-5 cursor-grab active:cursor-grabbing" />

                                    {editingId === module.id ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <input
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(module.id, 'module')}
                                                className="bg-black/40 border border-blue-500/50 rounded px-3 py-1 flex-1 text-white focus:outline-none"
                                            />
                                            <button onClick={() => handleSaveTitle(module.id, 'module')} className="text-green-400 hover:text-green-300">
                                                <Save className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-red-400">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 group flex-1">
                                            <span
                                                onClick={() => { setEditingId(module.id); setEditValue(module.title); }}
                                                className="font-semibold text-lg text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                                            >
                                                {module.title || `Module ${module.position}`}
                                            </span>
                                            <button
                                                onClick={() => { setEditingId(module.id); setEditValue(module.title); }}
                                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleDeleteModule(module.id)}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-3">
                                {module.lessons.map((lesson, lIndex) => (
                                    <div key={lesson.id} className="flex items-center gap-3 group/row">
                                        <div className="flex flex-col opacity-0 group-hover/row:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleReorderLesson(module.id, lIndex, 'up')}
                                                disabled={lIndex === 0}
                                                className="text-gray-500 hover:text-blue-400 disabled:opacity-0"
                                            >
                                                <ChevronUp className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleReorderLesson(module.id, lIndex, 'down')}
                                                disabled={lIndex === module.lessons.length - 1}
                                                className="text-gray-500 hover:text-blue-400 disabled:opacity-0"
                                            >
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                        </div>

                                        <div className="flex-1">
                                            {editingId === lesson.id ? (
                                                <div className="flex items-center gap-2 glass border-blue-500/30 p-2 rounded-lg">
                                                    <input
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(lesson.id, 'lesson')}
                                                        className="bg-transparent border-none flex-1 text-white focus:outline-none"
                                                    />
                                                    <button onClick={() => handleSaveTitle(lesson.id, 'lesson')} className="text-green-400">
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="text-gray-400">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between glass border-white/5 p-4 rounded-xl hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer group/lesson">
                                                    <Link href={`/courses/${params.id}/lessons/${lesson.id}`} className="flex-1 flex items-center gap-4">
                                                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover/lesson:scale-110 transition-transform">
                                                            {lesson.content_type === 'video' ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(lesson.id, lesson.title); }}
                                                                className="font-medium hover:text-blue-400 transition-colors"
                                                            >
                                                                {lesson.title}
                                                            </span>
                                                            <div className="flex items-center gap-3 text-[10px] text-gray-500 uppercase mt-0.5 font-semibold">
                                                                <span>{lesson.content_type}</span>
                                                                {lesson.due_date && (
                                                                    <div className="flex items-center gap-1 text-orange-400">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {new Date(lesson.due_date).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(lesson.id, lesson.title); }}
                                                            className="opacity-0 group-hover/lesson:opacity-100 text-gray-500 hover:text-white transition-opacity"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLesson(module.id, lesson.id); }}
                                                            className="opacity-0 group-hover/lesson:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={() => handleAddLesson(module.id)}
                                    className="w-full py-3 border border-dashed border-white/10 rounded-xl text-sm text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all mt-3 flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> New Lesson
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleAddModule}
                        className="w-full py-6 border-2 border-dashed border-white/10 rounded-2xl font-medium text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-3 text-lg"
                    >
                        <Plus className="w-6 h-6" /> Add New Module
                    </button>
                </div>
            </CourseEditorLayout>
        </div>
    );
}
