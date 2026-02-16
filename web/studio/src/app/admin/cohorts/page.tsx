"use client";

import React, { useEffect, useState, useCallback } from "react";
import { lmsApi, cmsApi, Cohort, User } from "@/lib/api";
import { Users, Plus, UserPlus, X, Search, Trash2, Loader2, CheckCircle2 } from "lucide-react";

export default function CohortsPage() {
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [newCohortName, setNewCohortName] = useState("");
    const [newCohortDesc, setNewCohortDesc] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [fetchedCohorts, fetchedUsers] = await Promise.all([
                lmsApi.getCohorts(),
                cmsApi.getAllUsers(),
            ]);
            setCohorts(fetchedCohorts);
            setUsers(fetchedUsers);
            if (fetchedCohorts.length > 0 && !selectedCohort) {
                setSelectedCohort(fetchedCohorts[0]);
            }
        } catch (error) {
            setMessage({ text: "Error loading cohorts or users", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }, [selectedCohort]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const loadMembers = useCallback(async (cohortId: string) => {
        try {
            const ids = await lmsApi.getMembers(cohortId);
            setMemberIds(ids);
        } catch (error) {
            console.error("Error loading members:", error);
        }
    }, []);

    useEffect(() => {
        if (selectedCohort) {
            loadMembers(selectedCohort.id);
        }
    }, [selectedCohort, loadMembers]);

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleCreateCohort = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCohortName.trim()) return;

        setIsCreating(true);
        try {
            const cohort = await lmsApi.createCohort({
                name: newCohortName,
                description: newCohortDesc,
            });
            setCohorts([cohort, ...cohorts]);
            setSelectedCohort(cohort);
            setNewCohortName("");
            setNewCohortDesc("");
            setMessage({ text: "Cohort created successfully", type: "success" });
        } catch (error) {
            setMessage({ text: "Error creating cohort", type: "error" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddMember = async (userId: string) => {
        if (!selectedCohort) return;

        try {
            await lmsApi.addMember(selectedCohort.id, userId);
            setMemberIds([...memberIds, userId]);
            setMessage({ text: "Student added to cohort", type: "success" });
        } catch (error) {
            setMessage({ text: "Error adding student", type: "error" });
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!selectedCohort) return;

        try {
            await lmsApi.removeMember(selectedCohort.id, userId);
            setMemberIds(memberIds.filter(id => id !== userId));
            setMessage({ text: "Student removed from cohort", type: "success" });
        } catch (error) {
            setMessage({ text: "Error removing student", type: "error" });
        }
    };

    const filteredUsers = users.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {message && (
                <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-[100] transition-opacity duration-500 flex items-center gap-2 ${message.type === "success" ? "bg-green-600/90 text-white" : "bg-red-600/90 text-white"
                    }`}>
                    {message.type === "success" ? <CheckCircle2 size={18} /> : <X size={18} />}
                    <span className="font-medium">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-2 hover:opacity-70"><X size={14} /></button>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Cohorts & Groups</h1>
                    <p className="text-gray-400">Manage student segments for your organization.</p>
                </div>
                <button
                    onClick={() => setSelectedCohort(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="h-4 w-4" /> New Cohort
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Cohorts List */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <Users className="h-5 w-5" /> Cohorts
                    </h2>
                    <div className="space-y-2 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                        {cohorts.map((cohort) => (
                            <button
                                key={cohort.id}
                                onClick={() => setSelectedCohort(cohort)}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedCohort?.id === cohort.id
                                        ? "bg-blue-600/10 border-blue-500 ring-1 ring-blue-500/50"
                                        : "bg-gray-900/50 hover:bg-gray-800 border-white/5"
                                    }`}
                            >
                                <div className="font-medium text-white">{cohort.name}</div>
                                {cohort.description && (
                                    <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                        {cohort.description}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cohort Details & User Management */}
                <div className="md:col-span-2 space-y-6">
                    {selectedCohort ? (
                        <div className="glass-card bg-gray-900/40 border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-1">{selectedCohort.name}</h3>
                                    <p className="text-gray-400">{selectedCohort.description || "No description provided."}</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h4 className="text-lg font-medium text-white">Students</h4>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                        <input
                                            placeholder="Search students..."
                                            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            value={searchTerm}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredUsers.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 bg-black/20 rounded-xl italic">
                                            No students found.
                                        </div>
                                    ) : (
                                        filteredUsers.map((user) => {
                                            const isMember = memberIds.includes(user.id);
                                            return (
                                                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-900/60 border border-white/5 rounded-xl hover:bg-gray-800/80 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400">
                                                            {user.full_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-white">{user.full_name}</div>
                                                            <div className="text-xs text-gray-400">{user.email}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {isMember ? (
                                                            <button
                                                                onClick={() => handleRemoveMember(user.id)}
                                                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-900/50 rounded-lg text-sm transition-all"
                                                            >
                                                                <Trash2 className="h-4 w-4" /> Remove
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAddMember(user.id)}
                                                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-900/50 rounded-lg text-sm transition-all"
                                                            >
                                                                <UserPlus className="h-4 w-4" /> Add
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card bg-gray-900/40 border border-white/5 rounded-2xl p-8 shadow-xl max-w-xl mx-auto">
                            <div className="text-center mb-8">
                                <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-white">Create New Cohort</h3>
                                <p className="text-gray-400">Define a new student segment to target specific learning experiences.</p>
                            </div>
                            <form onSubmit={handleCreateCohort} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Cohort Name</label>
                                    <input
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
                                        placeholder="e.g. Science Batch 2026-A"
                                        value={newCohortName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCohortName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Description (Optional)</label>
                                    <textarea
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white min-h-[100px]"
                                        placeholder="What is this cohort for?"
                                        value={newCohortDesc}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewCohortDesc(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    disabled={isCreating}
                                >
                                    {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                    Create Cohort
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
