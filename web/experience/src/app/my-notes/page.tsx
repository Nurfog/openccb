"use client";

import { useEffect, useState } from "react";
import { lmsApi, LessonAnnotation, Course, Module } from "@/lib/api";
import { StickyNote, Clock, Trash2, ChevronRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function formatTimestamp(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

type CourseCache = Record<string, Course & { modules: Module[] }>;

export default function MyNotesPage() {
    const [annotations, setAnnotations] = useState<LessonAnnotation[]>([]);
    const [courses, setCourses] = useState<CourseCache>({});
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const data = await lmsApi.getMyAnnotations();
                setAnnotations(data);

                const courseIds = [...new Set(data.map(a => a.course_id))];
                const cache: CourseCache = {};
                await Promise.all(courseIds.map(async id => {
                    try {
                        const outline = await lmsApi.getCourseOutline(id);
                        cache[id] = { ...outline.course, modules: outline.modules };
                    } catch { /* ignorar */ }
                }));
                setCourses(cache);
            } catch (err) {
                console.error("Error fetching annotations:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const handleDelete = async (ann: LessonAnnotation) => {
        try {
            await lmsApi.deleteLessonAnnotation(ann.lesson_id, ann.id);
            setAnnotations(prev => prev.filter(a => a.id !== ann.id));
        } catch (err) {
            console.error("Error deleting annotation:", err);
        } finally {
            setConfirmDelete(null);
        }
    };

    if (loading) {
        return (
            <div className="p-20 text-center animate-pulse text-gray-500 font-bold uppercase tracking-widest">
                Cargando Notas...
            </div>
        );
    }

    // Agrupar por curso
    const grouped: Record<string, LessonAnnotation[]> = {};
    for (const ann of annotations) {
        if (!grouped[ann.course_id]) grouped[ann.course_id] = [];
        grouped[ann.course_id].push(ann);
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-20">
            {/* Header */}
            <div className="mb-12">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <StickyNote size={24} className="text-amber-400" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white">Mis Notas</h1>
                </div>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                    Todas las anotaciones que tomaste durante tus lecciones
                </p>
            </div>

            {annotations.length === 0 ? (
                <div className="py-20 text-center rounded-[2.5rem] border border-white/5 bg-white/[0.02]">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                        <StickyNote size={32} className="text-gray-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Aún no tienes notas</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Cuando estudies una lección, usa el panel de notas para guardar ideas importantes.
                    </p>
                </div>
            ) : (
                <div className="space-y-10">
                    {Object.entries(grouped).map(([courseId, notes]) => {
                        const course = courses[courseId];
                        return (
                            <section key={courseId}>
                                {/* Curso header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                        <BookOpen size={14} className="text-amber-400" />
                                    </div>
                                    <h2 className="text-sm font-black uppercase tracking-widest text-amber-400">
                                        {course?.title ?? `Curso ${courseId.substring(0, 8)}`}
                                    </h2>
                                    <span className="text-[10px] text-gray-600 font-bold">
                                        {notes.length} nota{notes.length > 1 ? "s" : ""}
                                    </span>
                                </div>

                                <div className="grid gap-4">
                                    {notes.map(ann => {
                                        const lesson = course?.modules
                                            ?.flatMap(m => m.lessons)
                                            .find(l => l.id === ann.lesson_id);
                                        const lessonTitle = lesson?.title ?? `Lección ${ann.lesson_id.substring(0, 8)}`;

                                        return (
                                            <div
                                                key={ann.id}
                                                className="group rounded-3xl border border-white/5 hover:border-amber-500/30 bg-white/[0.02] hover:bg-amber-500/[0.02] p-5 transition-all duration-300"
                                            >
                                                {/* Lesson title + badge de posición */}
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 truncate">
                                                            {lessonTitle}
                                                        </p>
                                                        {ann.position_data?.type === "timestamp" && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                                                <Clock size={9} />
                                                                {formatTimestamp(ann.position_data.value)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-gray-600 shrink-0">
                                                        {formatDistanceToNow(new Date(ann.updated_at), { addSuffix: true, locale: es })}
                                                    </span>
                                                </div>

                                                {/* Contenido */}
                                                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-4">
                                                    {ann.content}
                                                </p>

                                                {/* Acciones */}
                                                <div className="flex items-center justify-between gap-4">
                                                    <Link
                                                        href={`/courses/${courseId}/lessons/${ann.lesson_id}`}
                                                        className="flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-widest transition-colors"
                                                    >
                                                        Ir a la lección <ChevronRight size={14} />
                                                    </Link>

                                                    {confirmDelete === ann.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-red-400 font-bold">¿Eliminar?</span>
                                                            <button
                                                                onClick={() => handleDelete(ann)}
                                                                className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                            >
                                                                Sí
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete(null)}
                                                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDelete(ann.id)}
                                                            className="p-2 rounded-xl hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Eliminar nota"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
