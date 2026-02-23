"use client";

import React, { useEffect, useState } from 'react';
import { lmsApi, UserBookmark, Course, Module } from '@/lib/api';
import { Bookmark, ChevronRight, BookOpen, Clock, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BookmarksPage() {
    const [bookmarks, setBookmarks] = useState<UserBookmark[]>([]);
    const [courses, setCourses] = useState<Record<string, Course & { modules: Module[] }>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBookmarks = async () => {
            try {
                const data = await lmsApi.getBookmarks();
                setBookmarks(data);

                // Fetch course details for each unique course_id
                const courseIds = [...new Set(data.map(b => b.course_id))];
                const courseData: Record<string, Course & { modules: Module[] }> = {};

                await Promise.all(courseIds.map(async (id) => {
                    try {
                        const outline = await lmsApi.getCourseOutline(id);
                        courseData[id] = { ...outline.course, modules: outline.modules };
                    } catch (e) {
                        console.error(`Error fetching course ${id}`, e);
                    }
                }));
                setCourses(courseData);
            } catch (err) {
                console.error("Error fetching bookmarks:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBookmarks();
    }, []);

    const handleRemoveBookmark = async (lessonId: string) => {
        try {
            await lmsApi.toggleBookmark(lessonId);
            setBookmarks(prev => prev.filter(b => b.lesson_id !== lessonId));
        } catch (err) {
            console.error("Error removing bookmark:", err);
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-500 font-bold uppercase tracking-widest">Cargando Marcadores...</div>;

    return (
        <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="mb-12">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl glass border-yellow-500/20 bg-yellow-500/10 flex items-center justify-center">
                        <Bookmark size={24} className="text-yellow-400" fill="currentColor" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white">Mis Lecciones Guardadas</h1>
                </div>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Acceso rápido a los contenidos que marcaste como importantes</p>
            </div>

            {bookmarks.length === 0 ? (
                <div className="py-20 text-center glass rounded-[2.5rem] border-white/5 bg-white/[0.02]">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                        <Bookmark size={32} className="text-gray-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Aún no tienes marcadores</h3>
                    <p className="text-gray-500 max-w-md mx-auto">Cuando encuentres una lección interesante, haz clic en el icono de marcador para guardarla aquí.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {bookmarks.map((bookmark) => {
                        const course = courses[bookmark.course_id];
                        return (
                            <div key={bookmark.id} className="group relative glass rounded-3xl border-white/5 hover:border-yellow-500/30 transition-all duration-500 bg-white/[0.02] hover:bg-yellow-500/[0.02] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center shrink-0 border border-white/5">
                                        <BookOpen size={24} className="text-yellow-400" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60">{course?.title || 'Curso'}</span>
                                            <span className="text-gray-700">•</span>
                                            <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                                <Clock size={10} />
                                                Guardado {formatDistanceToNow(new Date(bookmark.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                        </div>
                                        <Link href={`/courses/${bookmark.course_id}/lessons/${bookmark.lesson_id}`}>
                                            <h3 className="text-xl font-black text-white group-hover:text-yellow-400 transition-colors tracking-tight">
                                                {(() => {
                                                    const lesson = course?.modules?.flatMap(m => m.lessons).find(l => l.id === bookmark.lesson_id);
                                                    return lesson?.title || `Lección ${bookmark.lesson_id.substring(0, 8)}`;
                                                })()}
                                            </h3>
                                        </Link>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => handleRemoveBookmark(bookmark.lesson_id)}
                                        className="p-3 rounded-xl hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
                                        title="Eliminar marcador"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                    <Link
                                        href={`/courses/${bookmark.course_id}/lessons/${bookmark.lesson_id}`}
                                        className="btn-premium !py-3 !px-6 text-xs group/btn"
                                    >
                                        Continuar <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
