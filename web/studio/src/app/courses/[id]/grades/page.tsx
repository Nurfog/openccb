"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, cmsApi, StudentGradeReport, Cohort } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import {
    Search,
    GraduationCap,
    Download,
    CheckCircle,
    AlertCircle,
    User,
    Mail,
    Clock,
    Users,
    X,
    AlertTriangle,
    Loader2
} from "lucide-react";

export default function GradebookPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { user } = useAuth();
    const [students, setStudents] = useState<StudentGradeReport[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<StudentGradeReport[]>([]);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [selectedCohortId, setSelectedCohortId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [courseTitle, setCourseTitle] = useState("");
    const [showBulkEnroll, setShowBulkEnroll] = useState(false);
    const [bulkEmails, setBulkEmails] = useState("");
    const [bulkResults, setBulkResults] = useState<{
        successful_emails: string[];
        failed_emails: string[];
        already_enrolled_emails: string[];
    } | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    useEffect(() => {
        if (!user) return;
        if (user.role !== 'admin' && user.role !== 'instructor') {
            router.push('/');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                const [gradesData, cohortsData, courseData] = await Promise.all([
                    lmsApi.getCourseGrades(id, selectedCohortId || undefined),
                    lmsApi.getCohorts(),
                    cmsApi.getCourse(id)
                ]);
                setStudents(gradesData);
                setCohorts(cohortsData);
                setCourseTitle(courseData.title);
            } catch (err) {
                console.error("Failed to load gradebook data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, user, router, selectedCohortId]);

    useEffect(() => {
        let result = students;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.full_name.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q)
            );
        }
        setFilteredStudents(result);
    }, [students, searchQuery]);

    const averageScore = students.length > 0
        ? students.reduce((acc, s) => acc + (s.average_score || 0), 0) / students.length
        : 0;

    const exportCSV = async () => {
        try {
            const selectedOrgId = localStorage.getItem('studio_selected_org_id');
            const res = await fetch(lmsApi.exportGradesUrl(id), {
                headers: {
                    ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {})
                },
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${courseTitle}_grades_detailed.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Export failed", err);
        }
    };

    const handleBulkEnroll = async () => {
        if (!bulkEmails.trim()) return;

        const emails = bulkEmails
            .split(/[\n,]/)
            .map(e => e.trim())
            .filter(e => e.length > 0 && e.includes("@"));

        if (emails.length === 0) return;

        try {
            setBulkLoading(true);
            const results = await lmsApi.bulkEnroll(id, emails);
            setBulkResults(results);
            // Refresh list if any were successful
            if (results.successful_emails.length > 0) {
                const refreshedGrades = await lmsApi.getCourseGrades(id, selectedCohortId || undefined);
                setStudents(refreshedGrades);
            }
        } catch (err) {
            console.error("Bulk enrollment failed", err);
        } finally {
            setBulkLoading(false);
        }
    };

    if (loading && students.length === 0) return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <CourseEditorLayout
            activeTab="grades"
            pageTitle="Libro de Calificaciones"
            pageDescription="Seguimiento del progreso, calificaciones y rendimiento de los estudiantes."
            pageActions={
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowBulkEnroll(true)}
                        className="bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-gray-400 shadow-sm"
                    >
                        <Users size={16} className="text-blue-500" /> Inscripción Masiva
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95"
                    >
                        <Download size={16} /> Exportar CSV
                    </button>
                </div>
            }
        >
            <>

                {/* Bulk Enroll Modal */}
                {showBulkEnroll && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                                <div>
                                    <h3 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white uppercase tracking-tight">
                                        <Users className="text-blue-600 dark:text-blue-400" /> Inscripción Masiva
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Enroll multiple students at once</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowBulkEnroll(false);
                                        setBulkResults(null);
                                        setBulkEmails("");
                                    }}
                                    className="p-3 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all group active:scale-95"
                                >
                                    <X size={20} className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                {!bulkResults ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3">
                                                Enter email addresses (separated by commas or new lines)
                                            </label>
                                            <textarea
                                                value={bulkEmails}
                                                onChange={(e) => setBulkEmails(e.target.value)}
                                                placeholder="student1@example.com&#10;student2@example.com"
                                                className="w-full h-48 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-3xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 resize-none font-mono shadow-inner leading-relaxed"
                                            />
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-5 flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0 shadow-sm text-blue-500">
                                                <AlertTriangle size={20} />
                                            </div>
                                            <p className="text-xs text-blue-800/80 dark:text-blue-300 leading-relaxed font-bold uppercase tracking-tight">
                                                Students must already have an account in this organization directory to be successfully enrolled into the course.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-[2rem] p-6 text-center shadow-sm">
                                                <div className="text-3xl font-black text-green-600 dark:text-green-400">{bulkResults.successful_emails.length}</div>
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-green-700/50 dark:text-gray-500 font-black mt-1">Enrolled</div>
                                            </div>
                                            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-100 dark:border-yellow-500/20 rounded-[2rem] p-6 text-center shadow-sm">
                                                <div className="text-3xl font-black text-yellow-600 dark:text-yellow-400">{bulkResults.already_enrolled_emails.length}</div>
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-700/50 dark:text-gray-500 font-black mt-1">Skipped</div>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-[2rem] p-6 text-center shadow-sm">
                                                <div className="text-3xl font-black text-red-600 dark:text-red-400">{bulkResults.failed_emails.length}</div>
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-red-700/50 dark:text-gray-500 font-black mt-1">Failed</div>
                                            </div>
                                        </div>

                                        {bulkResults.failed_emails.length > 0 && (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-red-500/60 dark:text-gray-500 uppercase tracking-[0.2em]">Failed Emails (Not Found):</p>
                                                <div className="bg-red-50/50 dark:bg-black/20 border border-red-100 dark:border-white/10 rounded-2xl p-5 text-xs text-red-600 dark:text-red-400 max-h-48 overflow-y-auto font-mono custom-scrollbar leading-relaxed">
                                                    {bulkResults.failed_emails.map(e => (
                                                        <div key={e} className="py-1 border-b border-red-500/5 last:border-0">{e}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex justify-end items-center gap-4">
                                {!bulkResults ? (
                                    <>
                                        <button
                                            onClick={() => setShowBulkEnroll(false)}
                                            className="px-8 py-3 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-gray-400 active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleBulkEnroll}
                                            disabled={bulkLoading || !bulkEmails.trim()}
                                            className="flex items-center gap-3 px-10 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-white/5 text-white disabled:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:shadow-none disabled:cursor-not-allowed group"
                                        >
                                            {bulkLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />} Procesar Inscripción
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setShowBulkEnroll(false);
                                            setBulkResults(null);
                                            setBulkEmails("");
                                        }}
                                        className="btn-premium px-12 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl shadow-blue-500/20"
                                    >
                                        Done
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-8">
                    <h2 className="section-title">
                        <Users className="text-blue-500" />
                        Registro de Calificaciones
                    </h2>
                    {/* Controls & Stats */}
                    {/* Controls & Stats */}
                    <div className="flex flex-col md:flex-row gap-8 justify-between items-stretch bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
                            <div className="relative w-full sm:w-auto">
                                <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none z-10" />
                                <select
                                    value={selectedCohortId}
                                    onChange={(e) => setSelectedCohortId(e.target.value)}
                                    className="appearance-none bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-10 py-3.5 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-full sm:min-w-[240px] shadow-inner cursor-pointer"
                                >
                                    <option value="">All Cohorts</option>
                                    {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="relative w-full flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Find a student fast..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 font-bold shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex gap-10 border-l border-slate-100 dark:border-white/10 pl-10 items-center">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-1.5">Total Enrollment</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{filteredStudents.length}</p>
                            </div>
                            <div className="w-px h-10 bg-slate-100 dark:bg-white/5" />
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-1.5">Avg Performance</p>
                                <p className={`text-3xl font-black tracking-tighter ${averageScore < 0.7 ? 'text-orange-500' : 'text-blue-600'}`}>
                                    {(averageScore * 100).toFixed(0)}%
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5">
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Student</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Learning Progress</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Score Rating</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Activity</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-gray-600 italic">No students found.</td>
                                    </tr>
                                ) : filteredStudents.map((s) => (
                                    <tr key={s.user_id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">
                                                    {s.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">{s.full_name}</div>
                                                    <div className="text-[11px] text-slate-400 dark:text-gray-500 flex items-center gap-1.5 mt-1 font-medium italic">
                                                        <Mail size={12} className="text-blue-400" /> {s.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 align-middle">
                                            <div className="w-full max-w-[160px]">
                                                <div className="flex justify-between text-[10px] mb-2 font-black text-slate-400 uppercase tracking-widest">
                                                    <span>{(s.progress * 100).toFixed(0)}% Complete</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden shadow-inner">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-lg shadow-blue-500/30 transition-all duration-500"
                                                        style={{ width: `${s.progress * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 align-middle">
                                            {s.average_score !== null ? (
                                                <div className="flex flex-col">
                                                    <span className={`text-lg font-black tracking-tighter ${(s.average_score || 0) >= 0.8 ? 'text-green-600 dark:text-green-400' : (s.average_score || 0) >= 0.6 ? 'text-orange-500' : 'text-red-500'}`}>
                                                        {((s.average_score || 0) * 100).toFixed(0)}%
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Weighted Avg</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 dark:text-gray-600 text-[10px] font-black uppercase tracking-widest italic bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">Pending</span>
                                            )}
                                        </td>
                                        <td className="p-6 align-middle">
                                            <div className="text-xs text-slate-500 dark:text-gray-400 font-bold flex items-center gap-2 uppercase tracking-tight">
                                                <Clock size={16} className="text-slate-400" />
                                                {s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : 'No Activity'}
                                            </div>
                                        </td>
                                        <td className="p-6 text-right align-middle">
                                            {s.progress >= 1 ? (
                                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shadow-sm">
                                                    <CheckCircle size={12} /> Graduated
                                                </span>
                                            ) : s.last_active_at && (Date.now() - new Date(s.last_active_at).getTime() > 7 * 24 * 60 * 60 * 1000) ? (
                                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shadow-sm">
                                                    <AlertCircle size={12} /> At Risk
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm">
                                                    <GraduationCap size={12} /> Engaged
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        </CourseEditorLayout>
    );
}
