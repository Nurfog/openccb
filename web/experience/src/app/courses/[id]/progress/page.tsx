"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, GradingCategory, UserGrade, Course, Module } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Award,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Target,
    BookOpen,
    ArrowLeft,
    TrendingUp
} from "lucide-react";
import PerformanceBar from "@/components/PerformanceBar";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function StudentProgressPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [course, setCourse] = useState<(Course & { modules: Module[], grading_categories?: GradingCategory[] }) | null>(null);
    const [userGrades, setUserGrades] = useState<UserGrade[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const loadData = React.useCallback(async () => {
        try {
            const { course, modules, grading_categories } = await lmsApi.getCourseOutline(id);
            setCourse({ ...course, modules, grading_categories });

            if (user) {
                const grades = await lmsApi.getUserGrades(user.id, id);
                setUserGrades(grades);
            }
        } catch (err) {
            console.error("Error al cargar los datos de progreso", err);
        } finally {
            setLoading(false);
        }
    }, [id, user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    if (!course) return <div className="p-20 text-center text-white">Curso no encontrado.</div>;

    const gradingCategories = course.grading_categories || [];

    // Calculate progress
    const categoryStats = gradingCategories.map(cat => {
        const catLessons = course.modules.flatMap(m => m.lessons).filter(l => l.grading_category_id === cat.id);
        const catGrades = userGrades.filter(g => catLessons.some(l => l.id === g.lesson_id));

        const count = catLessons.length;
        const completedCount = catGrades.length;
        const avgScore = completedCount > 0
            ? (catGrades.reduce((sum, g) => sum + g.score, 0) / completedCount) * 100
            : 0;

        const weightedScore = (avgScore * cat.weight) / 100;

        return {
            ...cat,
            count,
            completedCount,
            avgScore,
            weightedScore
        };
    });

    const totalWeightedGrade = categoryStats.reduce((sum, s) => sum + s.weightedScore, 0);

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-20">
            {/* Nav */}
            <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 py-4 px-8">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <h1 className="text-xl font-bold">{course.title}</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-8 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left: Overall Progress */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-[2.5rem] p-12 border border-blue-500/20 text-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all duration-700"></div>
                        <h2 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-8">Estado General</h2>

                        <div className="relative inline-flex items-center justify-center mb-8">
                            <svg className="w-48 h-48 -rotate-90">
                                <circle
                                    className="text-white/5"
                                    strokeWidth="8"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="88"
                                    cx="96"
                                    cy="96"
                                />
                                <circle
                                    className="text-blue-500 transition-all duration-1000 ease-out"
                                    strokeWidth="8"
                                    strokeDasharray={88 * 2 * Math.PI}
                                    strokeDashoffset={88 * 2 * Math.PI * (1 - totalWeightedGrade / 100)}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="88"
                                    cx="96"
                                    cy="96"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-6xl font-black">{Math.round(totalWeightedGrade)}%</span>
                                <span className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Calificación Actual</span>
                            </div>
                        </div>

                        {/* Performance Bar */}
                        <div className="mt-8">
                            <PerformanceBar
                                score={Math.round(totalWeightedGrade)}
                                passingPercentage={course.passing_percentage || 70}
                            />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-3xl p-8 border border-white/10 space-y-6">
                        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" /> Resumen de Evaluaciones
                        </h3>
                        <div className="space-y-4">
                            {categoryStats.map(stat => (
                                <div key={stat.id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                        <span className="text-gray-400 group-hover:text-white transition-colors">{stat.name}</span>
                                    </div>
                                    <span className="font-bold">{Math.round(stat.weightedScore)} / {stat.weight}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Detailed Breakdown */}
                <div className="lg:col-span-2 space-y-12">
                    <section>
                        <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                            <Target className="w-8 h-8 text-blue-500" />
                            Desglose Detallado
                        </h2>

                        <div className="space-y-4">
                            {categoryStats.map(cat => (
                                <div key={cat.id} className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/[0.07] transition-all group">
                                    <div className="flex items-start justify-between mb-8">
                                        <div>
                                            <h3 className="text-xl font-bold">{cat.name}</h3>
                                            <p className="text-gray-400 text-sm mt-1">
                                                Peso: {cat.weight}% de la calificación total del curso
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-4xl font-black text-blue-500">{Math.round(cat.avgScore)}%</div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Puntuación Promedio</div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${cat.avgScore}%` }}
                                            ></div>
                                        </div>

                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-gray-500" />
                                                    <span className="text-gray-400">{cat.completedCount} / {cat.count} evaluaciones completadas</span>
                                                </div>
                                            </div>
                                            {cat.completedCount === cat.count && (
                                                <div className="flex items-center gap-2 text-green-400 font-bold">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Categoría Finalizada
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Certificate Section */}
                    {totalWeightedGrade >= (course.passing_percentage || 70) ? (
                        <section className="bg-green-500/10 border border-green-500/20 rounded-[2rem] p-8 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-400">
                                    <Award className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-green-400">¡Curso Completado!</h3>
                                    <p className="text-sm text-green-300/60 mt-0.5">
                                        ¡Felicidades! Has aprobado <b>{course.title}</b>.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (!course.certificate_template || !user) {
                                        alert("Plantilla de certificado no disponible.");
                                        return;
                                    }
                                    const filledTemplate = course.certificate_template
                                        .replace(/{{student_name}}/g, user.full_name)
                                        .replace(/{{course_title}}/g, course.title)
                                        .replace(/{{date}}/g, new Date().toLocaleDateString())
                                        .replace(/{{score}}/g, Math.round(totalWeightedGrade).toString());

                                    const win = window.open('', '_blank');
                                    if (win) {
                                        win.document.write(filledTemplate);
                                        win.document.close();
                                        // Wait visuals to render then print
                                        setTimeout(() => {
                                            win.focus();
                                            win.print();
                                        }, 500);
                                    }
                                }}
                                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-900/20 flex items-center gap-2"
                            >
                                <Award className="w-4 h-4" />
                                Descargar Certificado
                            </button>
                        </section>
                    ) : (
                        <section className="bg-indigo-600/10 border border-indigo-500/20 rounded-[2rem] p-8 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <TrendingUp className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Ruta de Certificación</h3>
                                    <p className="text-sm text-indigo-300/60 mt-0.5">
                                        Mantén {course.passing_percentage || 70}% o más para obtener tu certificado verificado.
                                    </p>
                                </div>
                            </div>
                            <div className="text-indigo-400 font-bold text-sm">
                                Falta {Math.max(0, (course.passing_percentage || 70) - Math.round(totalWeightedGrade))}%
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
