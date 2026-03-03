"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, Cohort, Course, CourseAnalytics, lmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    BarChart3,
    Users,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    BookOpen,
    Layers,
    ShieldAlert
} from "lucide-react";
import DropoutRiskDashboard from "@/components/Analytics/DropoutRiskDashboard";
import LiveSessions from "@/components/Courses/LiveSessions";
import { Video } from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function AnalyticsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { user } = useAuth();
    const [course, setCourse] = useState<Course | null>(null);
    const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [selectedCohortId, setSelectedCohortId] = useState<string>("");
    const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<"overview" | "risks" | "live">("overview");

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            if (user.role !== 'admin' && user.role !== 'instructor') {
                router.push('/');
                return;
            }

            try {
                const cohortsData = await lmsApi.getCohorts();
                setCohorts(cohortsData);

                const [courseData, analyticsData] = await Promise.all([
                    cmsApi.getCourseWithFullOutline(id),
                    cmsApi.getCourseAnalytics(id, selectedCohortId || undefined)
                ]);
                setCourse(courseData);
                setAnalytics(analyticsData);
            } catch (err: unknown) {
                console.error("Failed to load analytics", err);
                setAuthError(err instanceof Error ? err.message : "Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, user, router, selectedCohortId]);

    if (loading) return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    if (authError) return (
        <div className="min-h-screen bg-transparent text-slate-900 dark:text-white flex flex-col items-center justify-center p-20 text-center gap-6">
            <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 dark:text-red-500">
                <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-black">Access Denied</h2>
            <p className="text-slate-500 dark:text-gray-400 max-w-md font-medium">{authError}</p>
            <button onClick={() => router.back()} className="btn-premium px-8 py-3">Go Back</button>
        </div>
    );

    if (!course || !analytics) return (
        <div className="min-h-screen bg-transparent text-gray-900 dark:text-white p-20 text-center">
            Course not found or analytics unavailable.
        </div>
    );

    const difficultLessons = analytics.lessons
        .filter(l => l.average_score < 0.7 && l.submission_count > 0)
        .sort((a, b) => a.average_score - b.average_score);

    return (
        <CourseEditorLayout
            activeTab="analytics"
            pageTitle="Análisis del Curso"
            pageDescription={`Insights de rendimiento y progreso para ${course?.title}`}
            pageActions={
                <div className="flex items-center gap-3">
                    <select
                        value={selectedCohortId}
                        onChange={(e) => setSelectedCohortId(e.target.value)}
                        className="bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-[160px]"
                    >
                        <option value="">Todos los Estudiantes</option>
                        {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                        onClick={() => router.push(`/courses/${id}/analytics/advanced`)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-xl font-bold text-xs transition-all active:scale-95"
                    >
                        <Layers size={14} /> Insights Avanzados
                    </button>
                    <div className="bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-blue-600/20">
                        {user?.role} View
                    </div>
                </div>
            }
        >
            <div className="space-y-12">
                {/* Tab Selector */}
                <div className="flex items-center gap-1 mb-10 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit border border-slate-200 dark:border-white/5">
                    <button
                        onClick={() => setActiveAnalyticsTab("overview")}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAnalyticsTab === "overview" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/5"}`}
                    >
                        <BarChart3 size={14} /> Overview
                    </button>
                    <button
                        onClick={() => setActiveAnalyticsTab("risks")}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAnalyticsTab === "risks" ? "bg-red-600 text-white shadow-lg shadow-red-500/20" : "text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-white hover:bg-white/5"}`}
                    >
                        <ShieldAlert size={14} /> Predictive Risks
                    </button>
                    <button
                        onClick={() => setActiveAnalyticsTab("live")}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAnalyticsTab === "live" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/5"}`}
                    >
                        <Video size={14} /> Live Sessions
                    </button>
                </div>

                {activeAnalyticsTab === "overview" && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 group hover:bg-white transition-all shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <Users size={24} />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 dark:text-gray-400 uppercase tracking-[0.2em]">Enrollments</span>
                                </div>
                                <div className="text-4xl font-black text-slate-900 dark:text-white">{analytics.total_enrollments}</div>
                                <div className="text-xs text-green-600 dark:text-green-400 font-black uppercase mt-2 tracking-wider">Active Learners</div>
                            </div>

                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 group hover:bg-white transition-all shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-600/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                        <TrendingUp size={24} />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 dark:text-gray-400 uppercase tracking-[0.2em]">Average Score</span>
                                </div>
                                <div className="text-4xl font-black text-slate-900 dark:text-white">{Math.round(analytics.average_score * 100)}%</div>
                                <div className="text-xs text-slate-500 dark:text-gray-500 font-black uppercase mt-2 tracking-wider">Across all assessments</div>
                            </div>

                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 group hover:bg-white transition-all shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                        <AlertTriangle size={24} />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 dark:text-gray-400 uppercase tracking-[0.2em]">Attention Needed</span>
                                </div>
                                <div className="text-4xl font-black text-slate-900 dark:text-white">{difficultLessons.length}</div>
                                <div className="text-xs text-orange-600 dark:text-orange-400 font-black uppercase mt-2 tracking-wider">Struggling Lessons</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <section>
                                <h2 className="section-title mb-6">
                                    <BarChart3 className="text-blue-500" />
                                    Rendimiento de Lecciones
                                </h2>
                                <div className="space-y-4">
                                    {analytics.lessons.map((lesson) => (
                                        <div key={lesson.lesson_id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-50 dark:hover:bg-white/[0.07] transition-all shadow-sm">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="font-bold text-slate-800 dark:text-white">{lesson.lesson_title}</h3>
                                                    <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 font-medium">{lesson.submission_count} submissions</p>
                                                </div>
                                                <div className={`text-xl font-black ${lesson.average_score < 0.6 ? "text-red-500" : lesson.average_score < 0.8 ? "text-orange-500" : "text-emerald-500"}`}>
                                                    {Math.round(lesson.average_score * 100)}%
                                                </div>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${lesson.average_score < 0.6 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" : lesson.average_score < 0.8 ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"}`}
                                                    style={{ width: `${lesson.average_score * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-8">
                                <div>
                                    <h2 className="section-title mb-6">
                                        <AlertTriangle className="text-orange-500" />
                                        Lecciones con Dificultad
                                    </h2>
                                    {difficultLessons.length > 0 ? (
                                        <div className="space-y-4">
                                            {difficultLessons.map(l => (
                                                <div key={l.lesson_id} className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                                                    <div>
                                                        <h4 className="font-bold text-red-600 dark:text-red-400">{l.lesson_title}</h4>
                                                        <p className="text-xs text-red-700/60 dark:text-red-300/60 mt-1 text-balance max-w-xs font-medium">
                                                            Average score is below 70%. Consider reviewing the material or difficulty of questions.
                                                        </p>
                                                    </div>
                                                    <div className="text-2xl font-black text-red-600 dark:text-red-500">{Math.round(l.average_score * 100)}%</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center">
                                            <CheckCircle2 size={40} className="text-green-500 mx-auto mb-4" />
                                            <h4 className="font-bold text-green-400">All set!</h4>
                                            <p className="text-sm text-green-300/60 mt-2">No lessons currently fall below the difficulty threshold.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 rounded-3xl p-8 shadow-sm">
                                    <h3 className="text-lg font-black mb-4 flex items-center gap-2 uppercase tracking-wide text-blue-700 dark:text-white">
                                        <BookOpen className="text-blue-600 dark:text-blue-400" />
                                        Content Strategy Tip
                                    </h3>
                                    <p className="text-sm text-blue-800/70 dark:text-blue-200/70 leading-relaxed font-medium">
                                        High submission counts with low average scores often indicate that the assessment might be misleading or the prerequisites aren&apos;t clearly explained in previous lessons.
                                    </p>
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {activeAnalyticsTab === "risks" && (
                    <DropoutRiskDashboard courseId={id} />
                )}

                {activeAnalyticsTab === "live" && (
                    <LiveSessions courseId={id} />
                )}
            </div>
        </CourseEditorLayout>
    );
}
