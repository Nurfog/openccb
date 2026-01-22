"use client";

import { useEffect, useState } from "react";
import { lmsApi, Course, Lesson, Module } from "@/lib/api";
import Link from "next/link";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronRight as ChevronRightIcon,
    AlertCircle,
    Clock,
    CheckCircle2
} from "lucide-react";

export default function StudentCalendarPage({ params }: { params: { id: string } }) {
    const [course, setCourse] = useState<(Course & { modules: Module[] }) | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const loadData = async () => {
            try {
                const { course, modules } = await lmsApi.getCourseOutline(params.id);
                setCourse({ ...course, modules });

                // Flatten lessons from modules
                const allLessons: Lesson[] = [];
                modules?.forEach(mod => {
                    mod.lessons.forEach(lesson => {
                        allLessons.push(lesson);
                    });
                });
                setLessons(allLessons);
            } catch (err) {
                console.error("Error al cargar los datos del curso", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [params.id]);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Padding
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-28 border border-white/5 bg-white/[0.01]"></div>);
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayLessons = lessons.filter(l => l.due_date && l.due_date.startsWith(dateStr));
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            days.push(
                <div key={day} className={`h-28 border border-white/5 p-2 relative hover:bg-white/5 transition-colors group ${isToday ? 'bg-blue-500/5' : ''}`}>
                    <span className={`text-sm font-black ${isToday ? 'text-blue-400' : 'text-gray-600'}`}>
                        {day}
                        {isToday && <span className="ml-2 text-[8px] uppercase tracking-widest px-1.5 py-0.5 bg-blue-500 text-white rounded">Hoy</span>}
                    </span>
                    <div className="mt-1 space-y-1 overflow-y-auto max-h-20">
                        {dayLessons.map(lesson => (
                            <Link key={lesson.id} href={`/courses/${params.id}/lessons/${lesson.id}`}>
                                <div
                                    className={`text-[9px] p-1 rounded truncate flex items-center gap-1 mb-1 border transition-all hover:scale-[1.02] ${lesson.important_date_type === 'exam' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        lesson.important_date_type === 'assignment' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            'bg-green-500/10 text-green-400 border-green-500/20'
                                        }`}
                                >
                                    <span className="w-1 h-1 rounded-full bg-current"></span>
                                    {lesson.title}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            );
        }

        return days;
    };

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));

    if (loading) return <div className="py-20 text-center animate-pulse text-gray-500 font-bold uppercase tracking-widest text-xs">Sincronizando tu cronología...</div>;
    if (!course) return <div className="text-center py-20 text-red-400">Curso no encontrado.</div>;

    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    return (
        <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-4 text-blue-500 font-bold text-xs uppercase tracking-widest">
                        <Link href={`/courses/${params.id}`} className="hover:text-white transition-colors">Esquema</Link>
                        <ChevronRightIcon size={14} className="text-gray-600" />
                        <span>Timeline</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">Cronología del Curso</h1>
                    <p className="text-gray-500 font-medium">{course.title}</p>
                </div>

                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div> Examen
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div> Tarea
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div> Actividad
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3">
                    <div className="glass-card bg-white/[0.01] border-white/5 p-6 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black uppercase tracking-tight italic">{monthName} {year}</h3>
                            <div className="flex items-center gap-2 bg-white/5 rounded-2xl p-1 border border-white/10">
                                <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1 text-[10px] font-black uppercase tracking-widest hover:text-blue-400 transition-colors">Hoy</button>
                                <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 border-t border-l border-white/5 rounded-2xl overflow-hidden">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                                <div key={day} className="bg-white/5 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-600 border-r border-b border-white/5">
                                    {day}
                                </div>
                            ))}
                            {renderCalendar()}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="glass-card p-8 border-blue-500/20 bg-blue-500/5 rounded-3xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-6 flex items-center gap-2">
                                <AlertCircle size={14} /> Próximos Vencimientos
                            </h4>
                            <div className="space-y-6">
                                {lessons
                                    .filter(l => l.due_date && new Date(l.due_date) >= new Date())
                                    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                                    .slice(0, 5)
                                    .map(lesson => (
                                        <Link key={lesson.id} href={`/courses/${params.id}/lessons/${lesson.id}`} className="block group">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex justify-between">
                                                <span>{lesson.important_date_type || 'Activity'}</span>
                                                <span className="text-blue-500 font-black">{new Date(lesson.due_date!).toLocaleDateString()}</span>
                                            </div>
                                            <div className="font-bold text-sm group-hover:text-blue-400 transition-colors">{lesson.title}</div>
                                        </Link>
                                    ))
                                }
                                {lessons.filter(l => l.due_date && new Date(l.due_date) >= new Date()).length === 0 && (
                                    <div className="text-xs text-gray-600 italic py-4">No hay próximos vencimientos. ¡Estás al día!</div>
                                )}
                            </div>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/10 blur-[60px] rounded-full"></div>
                    </div>

                    <div className="glass-card p-8 border-white/5 bg-white/[0.01] rounded-3xl">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-2">
                            <Clock size={14} /> Ritmo del Curso
                        </h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Modo</span>
                                <span className="text-xs font-black uppercase tracking-widest text-white">{course.pacing_mode.replace('_', '-')}</span>
                            </div>
                            {course.start_date && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-600">Fecha de Inicio</span>
                                    <span className="text-xs font-black text-white">{new Date(course.start_date).toLocaleDateString()}</span>
                                </div>
                            )}
                            {course.end_date && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-600">Fecha de Finalización</span>
                                    <span className="text-xs font-black text-white">{new Date(course.end_date).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
