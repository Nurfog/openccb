"use client";

import { useEffect, useState } from "react";
import { cmsApi, CourseInstructor, User } from "@/lib/api";
import { useParams } from "next/navigation";
import { Plus, Trash2, UserPlus, Shield, ShieldCheck, ShieldAlert, X, Search, Check, Mail, GraduationCap } from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function CourseTeamPage() {
    const { id } = useParams() as { id: string };
    const [instructors, setInstructors] = useState<CourseInstructor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedRole, setSelectedRole] = useState<'instructor' | 'assistant'>('instructor');

    useEffect(() => {
        loadTeam();
    }, [id]);

    const loadTeam = async () => {
        try {
            setLoading(true);
            const team = await cmsApi.getCourseTeam(id);
            setInstructors(team);
        } catch (err) {
            console.error("Failed to load team:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.includes('@')) return; // Basic validation for email search

        try {
            setSearching(true);
            // This is a bit of a hack since we don't have a specific "search users" endpoint
            // for instructors. Let's assume listOrganizationsUsers or similar could work,
            // or just try to find by email if we had that endpoint.
            // For now, let's try to list all users and filter locally as a fallback.
            const allUsers = await cmsApi.getUsers();
            const filtered = allUsers.filter((u: User) =>
                u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setUsers(filtered);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setSearching(false);
        }
    };

    const handleAddMember = async (user: User) => {
        try {
            await cmsApi.addTeamMember(id, user.email, selectedRole);
            setIsAddModalOpen(false);
            setSearchQuery("");
            setUsers([]);
            loadTeam();
        } catch (err) {
            console.error("Failed to add member:", err);
            alert("Failed to add team member.");
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this instructor?")) return;
        try {
            await cmsApi.removeTeamMember(id, userId);
            setInstructors(instructors.filter(i => i.user_id !== userId));
        } catch (err) {
            console.error("Failed to remove member:", err);
            alert("Failed to remove team member.");
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'primary': return <ShieldAlert className="w-4 h-4 text-orange-400" />;
            case 'instructor': return <ShieldCheck className="w-4 h-4 text-blue-400" />;
            default: return <Shield className="w-4 h-4 text-gray-400" />;
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'primary': return 'Primary Instructor';
            case 'instructor': return 'Instructor';
            default: return 'Assistant';
        }
    };

    return (
        <>
            <CourseEditorLayout
                activeTab="team"
                pageTitle="Equipo del Curso"
                pageDescription="Gestiona múltiples instructores y asistentes para este curso."
                pageActions={
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95 group"
                    >
                        <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" /> Agregar Miembro
                    </button>
                }
            >
                <div className="space-y-8">
                    <h2 className="section-title">
                        <ShieldCheck className="text-blue-500" />
                        Miembros del Equipo
                    </h2>
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="py-20 text-center text-gray-500 animate-pulse">Loading team members...</div>
                        ) : instructors.length === 0 ? (
                            <div className="py-20 glass rounded-2xl flex flex-col items-center justify-center text-gray-500 gap-4">
                                <GraduationCap className="w-12 h-12 opacity-20" />
                                <p>No instructors assigned yet.</p>
                            </div>
                        ) : (
                            instructors.map((inst) => (
                                <div key={inst.id} className="glass p-6 rounded-2xl border-white/5 flex items-center justify-between group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold border-2 border-white/10 shadow-xl">
                                            {inst.full_name?.charAt(0) || inst.email?.charAt(0)}
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold flex items-center gap-2">
                                                {inst.full_name}
                                                {inst.role === 'primary' && (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full">
                                                        Owner
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-400 font-medium">
                                                <span className="flex items-center gap-1.5">
                                                    <Mail className="w-3.5 h-3.5 opacity-60" /> {inst.email}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                                <span className="flex items-center gap-1.5">
                                                    {getRoleIcon(inst.role)} {getRoleLabel(inst.role)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {inst.role !== 'primary' && (
                                            <button
                                                onClick={() => handleRemoveMember(inst.user_id)}
                                                className="p-3 rounded-xl hover:bg-red-500/10 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-95"
                                                title="Remove member"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CourseEditorLayout>

            {/* Add Member Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-[#1a1c22] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-white/5 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add Team Member</h2>
                                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Search for a user by name or email</p>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                <form onSubmit={handleSearch} className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        autoFocus
                                        placeholder="Type name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500"
                                    />
                                    {searching && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                                        </div>
                                    )}
                                </form>

                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-3 block">Assign Role</span>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setSelectedRole('instructor')}
                                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${selectedRole === 'instructor' ? 'bg-blue-600/10 border-blue-500/50 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-500 dark:text-gray-500 hover:border-slate-200 dark:hover:border-white/20'}`}
                                            >
                                                <ShieldCheck className="w-5 h-5" />
                                                <div>
                                                    <div className="font-bold text-sm">Instructor</div>
                                                    <div className="text-[10px] mt-0.5 opacity-60">Full access</div>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setSelectedRole('assistant')}
                                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${selectedRole === 'assistant' ? 'bg-blue-600/10 border-blue-500/50 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-500 dark:text-gray-500 hover:border-slate-200 dark:hover:border-white/20'}`}
                                            >
                                                <Shield className="w-5 h-5" />
                                                <div>
                                                    <div className="font-bold text-sm">Assistant</div>
                                                    <div className="text-[10px] mt-0.5 opacity-60">Limited access</div>
                                                </div>
                                            </button>
                                        </div>
                                    </label>
                                </div>

                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {users.length > 0 ? (
                                        users.map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => handleAddMember(u)}
                                                className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:border-blue-500/30 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                            >
                                                <div className="flex items-center gap-4 text-left">
                                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
                                                        {u.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-900 dark:text-white">{u.full_name}</div>
                                                        <div className="text-xs text-slate-500 dark:text-gray-500">{u.email}</div>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/0 flex items-center justify-center group-hover:bg-blue-500/20 transition-all">
                                                    <Plus className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100" />
                                                </div>
                                            </button>
                                        ))
                                    ) : searchQuery && !searching ? (
                                        <div className="py-8 text-center text-gray-600 italic text-sm">No users found matching your search.</div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
}
