"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, cmsApi, StudentGradeReport, Cohort, User } from "@/lib/api";
import {
    Users,
    UserPlus,
    Search,
    ArrowLeft,
    Loader2,
    X,
    Filter,
    CheckCircle2,
    Trash2,
    Mail,
    Plus,
    UserCircle,
    MoreHorizontal
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function CourseStudentsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [students, setStudents] = useState<StudentGradeReport[]>([]);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCohortId, setSelectedCohortId] = useState<string>("all");
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
    const [allOrgUsers, setAllOrgUsers] = useState<User[]>([]);
    const [orgUsersLoading, setOrgUsersLoading] = useState(false);
    const [enrollSearch, setEnrollSearch] = useState("");

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [gradesData, cohortsData] = await Promise.all([
                lmsApi.getCourseGrades(id),
                lmsApi.getCohorts()
            ]);
            setStudents(gradesData);
            setCohorts(cohortsData);
        } catch (error) {
            console.error("Error fetching students and cohorts:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const loadOrgUsers = async () => {
        try {
            setOrgUsersLoading(true);
            const users = await cmsApi.getAllUsers();
            // Filter out those already enrolled
            const enrolledIds = new Set(students.map(s => s.user_id));
            setAllOrgUsers(users.filter(u => u.role === 'student' && !enrolledIds.has(u.id)));
        } catch (error) {
            console.error("Error loading org users:", error);
        } finally {
            setOrgUsersLoading(false);
        }
    };

    useEffect(() => {
        if (isEnrollModalOpen) {
            loadOrgUsers();
        }
    }, [isEnrollModalOpen, students]);

    const handleEnroll = async (emails: string[]) => {
        try {
            await lmsApi.bulkEnroll(id, emails);
            fetchData();
            setIsEnrollModalOpen(false);
        } catch (error) {
            console.error("Enrollment failed:", error);
            alert("Failed to enroll students.");
        }
    };

    const handleCohortAssignment = async (userId: string, cohortId: string, remove: boolean = false) => {
        try {
            if (remove) {
                await lmsApi.removeMember(cohortId, userId);
            } else {
                await lmsApi.addMember(cohortId, userId);
            }
            // In a real app we'd need to refresh specifically which cohorts each student is in.
            // Since StudentGradeReport doesn't include cohorts, we might need a better API or just a toast.
            alert(`Student ${remove ? 'removed from' : 'added to'} cohort.`);
        } catch (error) {
            console.error("Cohort assignment failed:", error);
        }
    };

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email.toLowerCase().includes(searchTerm.toLowerCase());
        // Note: Filtering by cohort is tricky because the grades API doesn't return cohorts per student directly.
        // For now we'll just implement search. Real cohort filtering would need backend support in getCourseGrades.
        return matchesSearch;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-transparent flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <CourseEditorLayout
                activeTab="students"
                pageTitle="Estudiantes y Grupos"
                pageDescription="Gestiona las inscripciones y segmenta a tu audiencia por cohortes."
                pageActions={
                    <button
                        onClick={() => setIsEnrollModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95"
                    >
                        <UserPlus size={18} />
                        Inscribir Estudiantes
                    </button>
                }
            >
                <div className="space-y-8">
                    <h2 className="section-title">
                        <Users className="text-blue-500" />
                        Listado de Estudiantes
                    </h2>
                    {/* Search and Filters */}
                    <div className="glass p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Filter size={16} className="text-gray-400" />
                            <select
                                className="bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 text-slate-900 dark:text-white min-w-[150px]"
                                value={selectedCohortId}
                                onChange={(e) => setSelectedCohortId(e.target.value)}
                            >
                                <option value="all">All Cohorts</option>
                                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5 font-bold text-xs uppercase tracking-widest text-gray-500 uppercase">
                                    <th className="p-6">Student</th>
                                    <th className="p-6">Enrollment Date</th>
                                    <th className="p-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-12 text-center text-slate-500 dark:text-gray-500 italic">No students found.</td>
                                    </tr>
                                ) : filteredStudents.map(student => (
                                    <tr key={student.user_id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm">
                                                    {student.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{student.full_name}</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Mail size={12} /> {student.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-gray-400 text-sm font-medium">
                                            {/* In a real app we'd have the enrollment date here */}
                                            Available upon request
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="relative group/actions">
                                                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-500">
                                                        <MoreHorizontal size={20} />
                                                    </button>
                                                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1c1e] border border-white/10 rounded-xl shadow-2xl invisible group-hover/actions:visible z-10 p-2">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-3 py-2 border-b border-white/5 mb-1">Move to Cohort</div>
                                                        {cohorts.map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => handleCohortAssignment(student.user_id, c.id)}
                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 rounded-lg transition-colors"
                                                            >
                                                                {c.name}
                                                            </button>
                                                        ))}
                                                        <button
                                                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-2 border-t border-white/5"
                                                            onClick={() => { if (confirm("Unenroll student?")) handleCohortAssignment(student.user_id, "", true) }}
                                                        >
                                                            Unenroll
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CourseEditorLayout>

            {/* Enroll Modal */}
            {
                isEnrollModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#16181b] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl scale-in-center">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <UserPlus className="text-blue-500" />
                                    Enroll Organization Students
                                </h2>
                                <button onClick={() => setIsEnrollModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search and select students from organization..."
                                        value={enrollSearch}
                                        onChange={(e) => setEnrollSearch(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {orgUsersLoading ? (
                                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                                    ) : allOrgUsers.filter(u => u.full_name.toLowerCase().includes(enrollSearch.toLowerCase())).length === 0 ? (
                                        <div className="text-center p-8 text-gray-500 italic">No remaining students to enroll.</div>
                                    ) : (
                                        allOrgUsers.filter(u => u.full_name.toLowerCase().includes(enrollSearch.toLowerCase())).map(user => (
                                            <div key={user.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <UserCircle className="text-gray-500" />
                                                    <div>
                                                        <div className="font-bold text-sm tracking-tight">{user.full_name}</div>
                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleEnroll([user.email])}
                                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-gray-900 dark:text-white text-xs font-bold rounded-lg transition-all"
                                                >
                                                    Enroll Now
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3">
                                    <Plus size={20} className="text-blue-400 shrink-0" />
                                    <div className="text-xs text-blue-300 leading-relaxed font-medium">
                                        You can also enroll external students by going to the <strong>Gradebook</strong> and using the Bulk Enroll feature.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
}
