"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, Course, AdvancedAnalytics } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    LineChart,
    BarChart3,
    Users,
    TrendingUp,
    ArrowLeft,
    Layers,
    Calendar,
    Filter
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function AdvancedAnalyticsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { user } = useAuth();
    const [course, setCourse] = useState<Course | null>(null);
    const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const [courseData, advancedData] = await Promise.all([
                    cmsApi.getCourseWithFullOutline(id),
                    cmsApi.getAdvancedAnalytics(id)
                ]);
                setCourse(courseData);
                setAnalytics(advancedData);
            } catch (err: any) {
                console.error("Failed to load advanced analytics", err);
                setError(err.message || "Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, user]);

    if (loading) return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    if (error || !course || !analytics) return (
        <div className="min-h-screen bg-[#0f1115] text-white p-20 text-center flex flex-col items-center justify-center gap-6">
            <div className="text-gray-400">{error || "Data unavailable"}</div>
            <button onClick={() => router.back()} className="btn-premium px-8">Go Back</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/courses/${id}/analytics`)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                                Advanced Insights
                            </h1>
                            <p className="text-gray-400 mt-1">Cohort analysis and student retention for {course.title}</p>
                        </div>
                    </div>
                </div>

                <CourseEditorLayout activeTab="analytics">
                    <div className="p-8 space-y-12">
                        {/* Cohort Analysis */}
                        <section>
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black flex items-center gap-3">
                                    <Layers className="text-purple-500" />
                                    Cohort Completion
                                </h2>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl">
                                    <Filter size={14} /> Grouped by Month
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5">
                                            <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Cohort (Enrollment Month)</th>
                                            <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Students</th>
                                            <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Avg. Completion Rate</th>
                                            <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Engagement Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {analytics.cohorts.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-12 text-center text-gray-600 italic">No cohort data available yet.</td>
                                            </tr>
                                        ) : analytics.cohorts.map((cohort) => (
                                            <tr key={cohort.period} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="p-6 font-bold flex items-center gap-3">
                                                    <Calendar size={16} className="text-purple-400" />
                                                    {cohort.period}
                                                </td>
                                                <td className="p-6 font-black">{cohort.count}</td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden min-w-[200px]">
                                                            <div
                                                                className="h-full bg-purple-500 transition-all duration-1000 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                                                style={{ width: `${cohort.completion_rate * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-black">{Math.round(cohort.completion_rate * 100)}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    {cohort.completion_rate > 0.8 ? (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-500/20">Excellent</span>
                                                    ) : cohort.completion_rate > 0.5 ? (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full border border-blue-500/20">Healthy</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full border border-orange-500/20">Low Momentum</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Retention Analysis */}
                        <section>
                            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                                <TrendingUp className="text-indigo-500" />
                                Retention Heatmap
                            </h2>
                            <div className="space-y-6">
                                {analytics.retention.map((item, index) => {
                                    const firstStudentCount = analytics.retention[0]?.student_count || 1;
                                    const percentage = (item.student_count / firstStudentCount) * 100;

                                    return (
                                        <div key={item.lesson_id} className="group relative">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-gray-500">
                                                        {index + 1}
                                                    </div>
                                                    <span className="font-bold text-gray-300">{item.lesson_title}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-white">{item.student_count} Students</div>
                                                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{Math.round(percentage)}% Retention</div>
                                                </div>
                                            </div>
                                            <div className="h-4 w-full bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${percentage > 80 ? 'bg-indigo-500' :
                                                            percentage > 50 ? 'bg-indigo-600/70' :
                                                                'bg-indigo-700/40'
                                                        }`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                            {index > 0 && analytics.retention[index - 1].student_count > 0 && (
                                                <div className="absolute -top-4 right-0 text-[10px] font-black text-red-500/50">
                                                    -{Math.round(100 - (item.student_count / analytics.retention[index - 1].student_count) * 100)}% drop
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
