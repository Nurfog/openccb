"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, cmsApi, StudentGradeReport, Cohort } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import {
    ArrowLeft,
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
            const token = localStorage.getItem('studio_token');
            const selectedOrgId = localStorage.getItem('studio_selected_org_id');
            const res = await fetch(lmsApi.exportGradesUrl(id), {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {})
                }
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
                                Gradebook
                            </h1>
                            <p className="text-gray-400 mt-1">Student, progress, and performance tracking</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowBulkEnroll(true)}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-medium"
                        >
                            <Users size={16} /> Bulk Enroll
                        </button>
                        <button
                            onClick={exportCSV}
                            className="btn-premium px-4 flex items-center gap-2"
                        >
                            <Download size={16} /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Bulk Enroll Modal */}
                {showBulkEnroll && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-[#1a1d23] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Users className="text-blue-400" /> Bulk Student Enrollment
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowBulkEnroll(false);
                                        setBulkResults(null);
                                        setBulkEmails("");
                                    }}
                                    className="p-1 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                {!bulkResults ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                Enter email addresses (separated by commas or new lines)
                                            </label>
                                            <textarea
                                                value={bulkEmails}
                                                onChange={(e) => setBulkEmails(e.target.value)}
                                                placeholder="student1@example.com&#10;student2@example.com"
                                                className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white placeholder-gray-600 resize-none font-mono"
                                            />
                                        </div>
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 italic text-sm text-blue-400">
                                            <AlertTriangle size={18} className="shrink-0" />
                                            Students must already have an account in this organization to be enrolled.
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                                                <div className="text-2xl font-black text-green-400">{bulkResults.successful_emails.length}</div>
                                                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mt-1">Enrolled</div>
                                            </div>
                                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
                                                <div className="text-2xl font-black text-yellow-400">{bulkResults.already_enrolled_emails.length}</div>
                                                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mt-1">Skipped</div>
                                            </div>
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                                                <div className="text-2xl font-black text-red-400">{bulkResults.failed_emails.length}</div>
                                                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mt-1">Failed</div>
                                            </div>
                                        </div>

                                        {bulkResults.failed_emails.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Failed Emails (Not Found):</p>
                                                <div className="bg-black/20 rounded-xl p-3 text-xs text-red-400 max-h-32 overflow-y-auto font-mono">
                                                    {bulkResults.failed_emails.map(e => (
                                                        <div key={e}>{e}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-white/5 border-t border-white/5 flex justify-end gap-3">
                                {!bulkResults ? (
                                    <>
                                        <button
                                            onClick={() => setShowBulkEnroll(false)}
                                            className="px-6 py-2 rounded-xl hover:bg-white/5 transition-colors font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleBulkEnroll}
                                            disabled={bulkLoading || !bulkEmails.trim()}
                                            className="btn-premium px-8 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {bulkLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Process Enrollment'}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setShowBulkEnroll(false);
                                            setBulkResults(null);
                                            setBulkEmails("");
                                        }}
                                        className="btn-premium px-8"
                                    >
                                        Done
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <CourseEditorLayout activeTab="grades">
                    <div className="p-8 space-y-8">
                        {/* Controls & Stats */}
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-6">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="relative">
                                    <select
                                        value={selectedCohortId}
                                        onChange={(e) => setSelectedCohortId(e.target.value)}
                                        className="appearance-none bg-black/20 text-gray-900 dark:text-white border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-[200px]"
                                    >
                                        <option value="">All Cohorts</option>
                                        {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        ▼
                                    </div>
                                </div>
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white placeholder-gray-600"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-8 border-l border-white/10 pl-8">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Students</p>
                                    <p className="text-2xl font-black">{filteredStudents.length}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg Score</p>
                                    <p className={`text-2xl font-black ${averageScore < 0.7 ? 'text-orange-400' : 'text-green-400'}`}>
                                        {(averageScore * 100).toFixed(0)}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5">
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Student</th>
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Progress</th>
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Avg. Score</th>
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500">Last Active</th>
                                        <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-gray-600 italic">No students found.</td>
                                        </tr>
                                    ) : filteredStudents.map((s) => (
                                        <tr key={s.user_id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-gray-900 dark:text-white font-bold text-sm">
                                                        {s.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-400 transition-colors">{s.full_name}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <Mail size={10} /> {s.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 align-middle">
                                                <div className="w-full max-w-[140px]">
                                                    <div className="flex justify-between text-xs mb-1 font-bold text-gray-400">
                                                        <span>{(s.progress * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${s.progress * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 align-middle">
                                                {s.average_score !== null ? (
                                                    <span className={`font-black ${(s.average_score || 0) >= 0.8 ? 'text-green-400' : (s.average_score || 0) >= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {((s.average_score || 0) * 100).toFixed(0)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600 text-xs italic">No grades</span>
                                                )}
                                            </td>
                                            <td className="p-6 align-middle">
                                                <div className="text-sm text-gray-400 flex items-center gap-2">
                                                    <Clock size={14} />
                                                    {s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : 'Never'}
                                                </div>
                                            </td>
                                            <td className="p-6 text-right align-middle">
                                                {s.progress >= 1 ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">
                                                        <CheckCircle size={12} /> Completed
                                                    </span>
                                                ) : s.last_active_at && (Date.now() - new Date(s.last_active_at).getTime() > 7 * 24 * 60 * 60 * 1000) ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
                                                        <AlertCircle size={12} /> Inactive
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        <GraduationCap size={12} /> Active
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
