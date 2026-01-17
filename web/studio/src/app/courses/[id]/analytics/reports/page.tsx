"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, Course, AdvancedAnalytics, CourseAnalytics } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    ArrowLeft,
    Download,
    Users,
    CheckCircle,
    Clock,
    Filter
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function ReportsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { user } = useAuth();
    const [course, setCourse] = useState<Course | null>(null);
    const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
    const [advanced, setAdvanced] = useState<AdvancedAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const [courseData, basicData, advancedData] = await Promise.all([
                    cmsApi.getCourseWithFullOutline(id),
                    cmsApi.getCourseAnalytics(id),
                    cmsApi.getAdvancedAnalytics(id)
                ]);
                setCourse(courseData);
                setAnalytics(basicData);
                setAdvanced(advancedData);
            } catch (err) {
                console.error("Failed to load report data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, user]);

    const exportToCSV = () => {
        if (!analytics || !course) return;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Lesson,Students,Avg Score,Type\n";

        analytics.lessons.forEach(l => {
            csvContent += `"${l.lesson_title}",${l.submission_count},${(l.average_score * 100).toFixed(1)}%\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `report_${course.title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    if (!course || !analytics) return <div className="p-20 text-center text-red-400">Error caricamento dati.</div>;

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/courses/${id}/analytics`)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                Custom Report Builder
                            </h1>
                            <p className="text-gray-400 mt-1">Generate and export engagement data for {course.title}</p>
                        </div>
                    </div>

                    <button
                        onClick={exportToCSV}
                        className="btn-premium px-8 flex items-center gap-2"
                    >
                        <Download size={18} />
                        Export to CSV
                    </button>
                </div>

                <CourseEditorLayout activeTab="analytics">
                    <div className="p-8 space-y-12">
                        {/* Filters */}
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                            <Filter size={18} className="text-gray-500 ml-2" />
                            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Filter by Cohort:</span>
                            <select
                                className="bg-transparent text-sm font-bold text-white focus:outline-none"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">All students</option>
                                {advanced?.cohorts.map(c => (
                                    <option key={c.period} value={c.period}>{c.period}</option>
                                ))}
                            </select>
                        </div>

                        {/* Report Table */}
                        <div className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5">
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Lección</th>
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Completado por</th>
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Puntaje Promedio</th>
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Tendencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {analytics.lessons.map((lesson) => (
                                        <tr key={lesson.lesson_id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-6 font-bold text-gray-300">{lesson.lesson_title}</td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-2">
                                                    <Users size={14} className="text-blue-400" />
                                                    <span className="font-black">{lesson.submission_count}</span>
                                                    <span className="text-[10px] text-gray-500">estudiantes</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden min-w-[100px]">
                                                        <div
                                                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                            style={{ width: `${lesson.average_score * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-black">{(lesson.average_score * 100).toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                {lesson.average_score > 0.8 ? (
                                                    <div className="flex items-center gap-1 text-green-400 text-[10px] font-black uppercase tracking-widest">
                                                        <CheckCircle size={12} /> Alta
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-orange-400 text-[10px] font-black uppercase tracking-widest">
                                                        <Clock size={12} /> Estable
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Total Enrollments</h4>
                                <div className="text-3xl font-black">{analytics.total_enrollments}</div>
                            </div>
                            <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2">Avg. Score</h4>
                                <div className="text-3xl font-black">{(analytics.average_score * 100).toFixed(1)}%</div>
                            </div>
                            <div className="p-8 rounded-3xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-2">Retention Rate</h4>
                                <div className="text-3xl font-black">
                                    {advanced ? Math.round((advanced.retention[advanced.retention.length - 1]?.student_count / advanced.retention[0]?.student_count) * 100) : '--'}%
                                </div>
                            </div>
                        </div>
                    </div>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
