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
    ArrowLeft,
    CheckCircle2,
    BookOpen,
    Layers,
    ShieldAlert
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import DropoutRiskDashboard from "@/components/Analytics/DropoutRiskDashboard";
import LiveSessions from "@/components/Courses/LiveSessions";
import { Video } from "lucide-react";

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
            // Wait for auth to load
            if (!user) {
                return;
            }

            // Check authorization
            if (user.role !== 'admin' && user.role !== 'instructor') {
                router.push('/');
                return;
            }

            try {
                // Fetch cohorts once
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
        <div className="min-h-screen bg-transparent text-gray-900 dark:text-white flex flex-col items-center justify-center p-20 text-center gap-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">{authError}</p>
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
        <div className="min-h-screen bg-transparent text-gray-900 dark:text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                Course Analytics
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">Performance insights and student progress for {course?.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <select
                            value={selectedCohortId}
                            onChange={(e) => setSelectedCohortId(e.target.value)}
                            className="bg-black/5 dark:bg-white/5 text-gray-900 dark:text-white border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="">All Students</option>
                            {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button
                            onClick={() => router.push(`/courses/${id}/analytics/advanced`)}
                            className="btn-premium !bg-purple-600/10 !text-purple-400 border border-purple-500/20 hover:!bg-purple-600/20 !shadow-none gap-2 text-xs py-2"
                        >
                            <Layers size={14} /> Advanced Insights
                        </button>
                        <div className="bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border border-blue-500/30">
                            {user?.role} View
                        </div>
                    </div>
                </div>

                <CourseEditorLayout activeTab="analytics">
                    <div className="p-8">
                        {/* Tab Selector */}
                        <div className="flex items-center gap-1 mb-10 p-1 bg-white/5 rounded-2xl w-fit">
                            <button
                                onClick={() => setActiveAnalyticsTab("overview")}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeAnalyticsTab === "overview" ? 'bg-blue-600 text-gray-900 dark:text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-900 dark:text-white hover:bg-white/5'}`}
                            >
                                <BarChart3 size={16} /> Overview
                            </button>
                            <button
                                onClick={() => setActiveAnalyticsTab("risks")}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeAnalyticsTab === "risks" ? 'bg-red-600 text-gray-900 dark:text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-gray-900 dark:text-white hover:bg-white/5'}`}
                            >
                                <ShieldAlert size={16} /> Predictive Risks
                            </button>
                            <button
                                onClick={() => setActiveAnalyticsTab("live")}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeAnalyticsTab === "live" ? 'bg-blue-600 text-gray-900 dark:text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-900 dark:text-white hover:bg-white/5'}`}
                            >
                                <Video size={16} /> Live Sessions
                            </button>
                        </div>

                        {activeAnalyticsTab === "overview" ? (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 group hover:bg-white/[0.07] transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                <Users size={24} />
                                            </div>
                                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Enrollments</span>
                                        </div>
                                        <div className="text-4xl font-black">{analytics.total_enrollments}</div>
                                        <div className="text-xs text-green-400 font-bold mt-2">Active Learners</div>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 group hover:bg-white/[0.07] transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                                <TrendingUp size={24} />
                                            </div>
                                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Average Score</span>
                                        </div>
                                        <div className="text-4xl font-black">{Math.round(analytics.average_score * 100)}%</div>
                                        <div className="text-xs text-gray-500 font-bold mt-2">Across all assessments</div>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 group hover:bg-white/[0.07] transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                                                <AlertTriangle size={24} />
                                            </div>
                                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Attention Needed</span>
                                        </div>
                                        <div className="text-4xl font-black">{difficultLessons.length}</div>
                                        <div className="text-xs text-orange-400 font-bold mt-2">Struggling Lessons</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    {/* Lesson Breakdown */}
                                    <section>
                                        <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                                            <BarChart3 className="text-blue-500" />
                                            Lesson Performance
                                        </h2>
                                        <div className="space-y-4">
                                            {analytics.lessons.map((lesson) => (
                                                <div key={lesson.lesson_id} className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 hover:bg-black/[0.07] dark:hover:bg-white/[0.07] transition-all">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <h3 className="font-bold">{lesson.lesson_title}</h3>
                                                            <p className="text-xs text-gray-500 mt-1">{lesson.submission_count} submissions</p>
                                                        </div>
                                                        <div className={`text-xl font-black ${lesson.average_score < 0.6 ? 'text-red-400' : lesson.average_score < 0.8 ? 'text-orange-400' : 'text-green-400'}`}>
                                                            {Math.round(lesson.average_score * 100)}%
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${lesson.average_score < 0.6 ? 'bg-red-500' : lesson.average_score < 0.8 ? 'bg-orange-500' : 'bg-green-500'}`}
                                                            style={{ width: `${lesson.average_score * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Actionable Insights */}
                                    <section className="space-y-8">
                                        <div>
                                            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                                                <AlertTriangle className="text-orange-500" />
                                                Struggling Lessons
                                            </h2>
                                            {difficultLessons.length > 0 ? (
                                                <div className="space-y-4">
                                                    {difficultLessons.map(l => (
                                                        <div key={l.lesson_id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center justify-between">
                                                            <div>
                                                                <h4 className="font-bold text-red-400">{l.lesson_title}</h4>
                                                                <p className="text-xs text-red-300/60 mt-1 text-balance max-w-xs">
                                                                    Average score is below 70%. Consider reviewing the material or difficulty of questions.
                                                                </p>
                                                            </div>
                                                            <div className="text-2xl font-black text-red-500">{Math.round(l.average_score * 100)}%</div>
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

                                        <div className="bg-blue-600/10 border border-blue-500/20 rounded-3xl p-8">
                                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                                <BookOpen className="text-blue-400" />
                                                Content Strategy Tip
                                            </h3>
                                            <p className="text-sm text-blue-200/70 leading-relaxed">
                                                High submission counts with low average scores often indicate that the assessment might be misleading or the prerequisites aren&apos;t clearly explained in previous lessons.
                                            </p>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        ) : (
                            <DropoutRiskDashboard courseId={id} />
                        )}
                    </div>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
