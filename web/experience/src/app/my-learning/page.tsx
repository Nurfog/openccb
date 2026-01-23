"use client";

import { useEffect, useState } from "react";
import { lmsApi, Course, Module } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, TrendingUp, Clock, CheckCircle2, Award, Target } from "lucide-react";

interface CourseWithModules extends Course {
    modules?: Module[];
}

interface EnrollmentWithProgress {
    course: CourseWithModules;
    progress: number;
    lastAccessed?: string;
}

export default function MyLearningPage() {
    const [enrollments, setEnrollments] = useState<EnrollmentWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [gamification, setGamification] = useState<{ points: number, level: number, badges: any[] } | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const enrollmentData = await lmsApi.getEnrollments(user.id);
                const gamificationData = await lmsApi.getGamification(user.id);
                setGamification(gamificationData);

                // Fetch course details for each enrollment
                const enrichedEnrollments: EnrollmentWithProgress[] = [];
                for (const enrollment of enrollmentData) {
                    try {
                        const { course, modules } = await lmsApi.getCourseOutline(enrollment.course_id);

                        // TODO: Implement actual progress tracking
                        // For now, show 0% progress for all courses
                        const progress = 0;

                        enrichedEnrollments.push({
                            course: { ...course, modules },
                            progress,
                            lastAccessed: enrollment.enrolled_at
                        });
                    } catch (err) {
                        console.error(`Error loading course ${enrollment.course_id}`, err);
                    }
                }

                setEnrollments(enrichedEnrollments);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-80 glass-card animate-pulse bg-white/5 border-white/5 rounded-3xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-20 text-center">
                <h1 className="text-4xl font-black mb-4">Inicia Sesión</h1>
                <p className="text-gray-500 mb-8">Debes iniciar sesión para ver tus cursos.</p>
                <Link href="/auth/login" className="btn-primary">
                    Ir a Login
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-20">
            {/* Header */}
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">
                        <BookOpen size={14} />
                        <span>Mi Aprendizaje</span>
                    </div>
                    <h1 className="text-6xl font-black tracking-tighter leading-none">
                        Mis <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600">Cursos</span>
                    </h1>
                    <p className="text-gray-500 font-medium max-w-xl text-lg">
                        Continúa tu viaje de aprendizaje donde lo dejaste.
                    </p>
                </div>

                {/* Gamification Stats */}
                {gamification && (
                    <div className="flex items-center gap-4">
                        <div className="glass-card p-4 border-indigo-500/20 bg-indigo-500/5">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
                                    {gamification.level}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nivel</p>
                                    <p className="text-sm font-bold text-white">{gamification.points} XP</p>
                                </div>
                            </div>
                        </div>
                        {gamification.badges.length > 0 && (
                            <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5">
                                <div className="flex items-center gap-3">
                                    <Award className="w-8 h-8 text-amber-400" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Medallas</p>
                                        <p className="text-sm font-bold text-white">{gamification.badges.length}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Enrolled Courses */}
            {enrollments.length === 0 ? (
                <div className="glass-card p-12 text-center border-dashed">
                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-6">
                        <Target className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-black mb-3">No estás inscrito en ningún curso</h3>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        Explora nuestro catálogo y comienza tu viaje de aprendizaje hoy.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all"
                    >
                        <BookOpen size={16} />
                        Explorar Catálogo
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {enrollments.map(({ course, progress }) => (
                        <Link
                            key={course.id}
                            href={`/courses/${course.id}`}
                            className="glass-card group hover:border-indigo-500/50 transition-all duration-300 overflow-hidden"
                        >
                            <div className="p-6 space-y-4">
                                {/* Progress Ring */}
                                <div className="flex items-center justify-between">
                                    <div className="relative w-16 h-16">
                                        <svg className="w-16 h-16 transform -rotate-90">
                                            <circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                                className="text-white/10"
                                            />
                                            <circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 28}`}
                                                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                                                className="text-indigo-500 transition-all duration-500"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xs font-black text-white">{Math.round(progress)}%</span>
                                        </div>
                                    </div>
                                    {progress === 100 && (
                                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                                    )}
                                </div>

                                {/* Course Info */}
                                <div>
                                    <h3 className="text-xl font-black tracking-tight mb-2 group-hover:text-indigo-400 transition-colors">
                                        {course?.title || 'Curso sin título'}
                                    </h3>
                                    <p className="text-sm text-gray-500 line-clamp-2">
                                        {course?.description || "Continúa aprendiendo..."}
                                    </p>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Clock size={12} />
                                        <span>{course.modules?.length || 0} módulos</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <TrendingUp size={12} />
                                        <span>{progress < 100 ? 'En progreso' : 'Completado'}</span>
                                    </div>
                                </div>

                                {/* Continue Button */}
                                <button className="w-full py-2.5 bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 rounded-xl font-bold text-sm transition-all group-hover:translate-x-1">
                                    {progress === 0 ? 'Comenzar' : progress === 100 ? 'Revisar' : 'Continuar'}
                                </button>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
