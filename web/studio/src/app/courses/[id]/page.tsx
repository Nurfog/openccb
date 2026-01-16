"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course, Module, Lesson, Organization } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
    Plus,
    Pencil,
    ChevronUp,
    ChevronDown,
    PlayCircle,
    FileText,
    Calendar,
    Save,
    X,
    GripVertical,
    Trash2,
    ArrowLeft,
    Send,
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import OrganizationSelector from "@/components/OrganizationSelector";

interface FullModule extends Module {
    lessons: Lesson[];
}

export default function CourseEditor({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<FullModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
    const [saving, setSaving] = useState(false); // Added saving state
    const { user } = useAuth();

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

    useEffect(() => {
        const loadOrgs = async () => {
            if (user?.role === 'admin' && user?.organization_id === '00000000-0000-0000-0000-000000000001') {
                try {
                    const orgs = await cmsApi.getOrganizations();
                    setOrganizations(orgs);
                } catch (err) {
                    console.error("Failed to load organizations", err);
                }
            }
        };
        loadOrgs();
    }, [user]);

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
        const mod = modules.find((m: FullModule) => m.id === moduleId);
        if (!mod) return;

        const title = "New Lesson";
        try {
            const newLesson = await cmsApi.createLesson(moduleId, title, "video", mod.lessons.length + 1);
            setModules(modules.map((m: FullModule) =>
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
                setModules(modules.map((m: FullModule) => m.id === id ? { ...m, title: editValue } : m));
            } else {
                await cmsApi.updateLesson(id, { title: editValue });
                setModules(modules.map((mod: FullModule) => ({
                    ...mod,
                    lessons: mod.lessons.map((l: Lesson) => l.id === id ? { ...l, title: editValue } : l)
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
            setModules(modules.filter((m: FullModule) => m.id !== id));
        } catch {
            alert("Failed to delete module");
        }
    };

    const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
        if (!confirm("Are you sure you want to delete this lesson?")) return;
        try {
            await cmsApi.deleteLesson(lessonId);
            setModules(modules.map((m: FullModule) =>
                m.id === moduleId
                    ? { ...m, lessons: m.lessons.filter((l: Lesson) => l.id !== lessonId) }
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

        const items = newModules.map((m: FullModule, i: number) => ({ id: m.id, position: i + 1 }));
        setModules(newModules.map((m: FullModule, i: number) => ({ ...m, position: i + 1 })));

        try {
            await cmsApi.reorderModules({ items });
        } catch {
            alert("Failed to save module order");
        }
    };

    const handleReorderLesson = async (moduleId: string, lessonIndex: number, direction: 'up' | 'down') => {
        const mod = modules.find((m: FullModule) => m.id === moduleId);
        if (!mod) return;

        const newLessons = [...mod.lessons];
        const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
        if (targetIndex < 0 || targetIndex >= newLessons.length) return;

        [newLessons[lessonIndex], newLessons[targetIndex]] = [newLessons[targetIndex], newLessons[lessonIndex]];

        const items = newLessons.map((l: Lesson, i: number) => ({ id: l.id, position: i + 1 }));
        setModules(modules.map((m: FullModule) => m.id === moduleId ? { ...m, lessons: newLessons.map((l: Lesson, i: number) => ({ ...l, position: i + 1 })) } : m));

        try {
            await cmsApi.reorderLessons({ items });
        } catch {
            alert("Failed to save lesson order");
        }
    };

    const handlePublish = async () => {
        if (!course) return;

        const isSuperAdmin = user?.role === 'admin' && user?.organization_id === '00000000-0000-0000-0000-000000000001';

        if (isSuperAdmin && organizations.length > 0) {
            setIsOrgModalOpen(true);
        } else {
            publishCourse();
        }
    };

    const publishCourse = async (targetOrgId?: string) => {
        try {
            setSaving(true);
            await cmsApi.publishCourse(params.id as string, targetOrgId);
            alert("Course published successfully!");
        } catch (err) {
            console.error("Failed to publish course", err);
            alert("Failed to publish course.");
        } finally {
            setSaving(false);
            setIsOrgModalOpen(false); // Close modal after publishing attempt
        }
    };

    if (loading) return <div className="py-20 text-center">Loading editor...</div>;
    if (error) return <div className="py-20 text-center text-red-400">{error}</div>;

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                Course Editor
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-gray-400">Design your course structure and lesson content for {course?.title}</p>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${course?.pacing_mode === 'instructor_led' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {course?.pacing_mode?.replace('_', ' ') || 'Self Paced'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-6 py-3 glass hover:bg-white/20 transition-all rounded-xl text-sm font-bold shadow-lg active:scale-95">
                            Preview
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={saving}
                            className={`flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                            {saving ? 'Publishing...' : 'Publish Course'}
                        </button>
                    </div>
                </div>

                <CourseEditorLayout activeTab="outline">
                    <div className="p-8 space-y-6">
                        {modules.map((module: FullModule, mIndex: number) => (
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
                                    {module.lessons.map((lesson: Lesson, lIndex: number) => (
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
            {/* Organization Selector Modal */}
            <OrganizationSelector
                isOpen={isOrgModalOpen}
                onClose={() => setIsOrgModalOpen(false)}
                organizations={organizations}
                title="Publish to Organization"
                actionLabel="Publish Course"
                onConfirm={(orgId) => publishCourse(orgId)}
            />
        </div>
    );
}
