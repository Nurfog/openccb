"use client";

import React, { useState, useEffect } from "react";
import { lmsApi, Meeting } from "@/lib/api";
import {
    Video,
    Plus,
    Calendar,
    Clock,
    Trash2,
    ExternalLink,
    AlertCircle
} from "lucide-react";

interface LiveSessionsProps {
    courseId: string;
}

export default function LiveSessions({ courseId }: LiveSessionsProps) {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        start_at: "",
        duration_minutes: 60
    });

    useEffect(() => {
        loadMeetings();
    }, [courseId]);

    const loadMeetings = async () => {
        try {
            const data = await lmsApi.getMeetings(courseId);
            setMeetings(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await lmsApi.createMeeting(courseId, {
                ...formData,
                start_at: new Date(formData.start_at).toISOString()
            } as any);
            setShowForm(false);
            loadMeetings();
        } catch (err) {
            alert("Failed to create meeting");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this meeting?")) return;
        try {
            await lmsApi.deleteMeeting(courseId, id);
            loadMeetings();
        } catch (err) {
            alert("Failed to delete");
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading sessions...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Video className="text-blue-500" />
                        Virtual Classrooms
                    </h2>
                    <p className="text-sm text-gray-500">Schedule and manage your live Jitsi sessions.</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all"
                >
                    <Plus size={18} /> Schedule Session
                </button>
            </div>

            {showForm && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-in slide-in-from-top-4">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400">SESSION TITLE</label>
                                <input
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:border-blue-500 outline-none"
                                    placeholder="Weekly Sync Up"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400">START DATE & TIME</label>
                                <input
                                    required
                                    type="datetime-local"
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:border-blue-500 outline-none"
                                    value={formData.start_at}
                                    onChange={e => setFormData({ ...formData, start_at: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400">DESCRIPTION (OPTIONAL)</label>
                            <textarea
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:border-blue-500 outline-none h-20"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button className="bg-blue-600 px-6 py-2 rounded-lg font-bold">Create Meeting</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {meetings.map(m => (
                    <div key={m.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <Video size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{m.title}</h3>
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-1">
                                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(m.start_at).toLocaleString()}</span>
                                        <span className="flex items-center gap-1"><Clock size={14} /> {m.duration_minutes} min</span>
                                        <span className="capitalize px-2 py-0.5 bg-white/5 rounded-full border border-white/10">{m.provider}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={m.join_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                                >
                                    Join Room <ExternalLink size={14} />
                                </a>
                                <button
                                    onClick={() => handleDelete(m.id)}
                                    className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {meetings.length === 0 && !loading && (
                    <div className="p-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <AlertCircle className="mx-auto text-gray-600 mb-2" />
                        <p className="text-gray-500">No sessions scheduled for this course.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
