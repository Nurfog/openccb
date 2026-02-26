"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, cmsApi, Course, Meeting } from "@/lib/api";
import {
    Video,
    Plus,
    Calendar as CalendarIcon,
    Clock,
    Trash2,
    ArrowLeft,
    Loader2,
    Globe,
    Link as LinkIcon,
    X
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function LiveSessionsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newMeeting, setNewMeeting] = useState({
        title: "",
        description: "",
        start_at: new Date().toISOString().slice(0, 16),
        duration_minutes: 60,
        provider: "jitsi"
    });

    const loadMeetings = async () => {
        try {
            setLoading(true);
            const data = await lmsApi.getMeetings(id);
            setMeetings(data);
        } catch (error) {
            console.error("Error loading meetings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMeetings();
    }, [id]);

    const handleCreateMeeting = async () => {
        try {
            await lmsApi.createMeeting(id, {
                ...newMeeting,
                start_at: new Date(newMeeting.start_at).toISOString()
            });
            setIsCreateModalOpen(false);
            loadMeetings();
        } catch (error) {
            console.error("Error creating meeting:", error);
            alert("Failed to create meeting.");
        }
    };

    const handleDeleteMeeting = async (meetingId: string) => {
        if (!confirm("Are you sure you want to delete this meeting?")) return;
        try {
            await lmsApi.deleteMeeting(id, meetingId);
            loadMeetings();
        } catch (error) {
            console.error("Error deleting meeting:", error);
            alert("Failed to delete meeting.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-transparent flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent text-gray-900 dark:text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
                                Live Learning Sessions
                            </h1>
                            <p className="text-gray-400 mt-1">Schedule and manage virtual meetings and live sessions</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn-premium px-6 py-3 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Schedule Session
                    </button>
                </div>

                <CourseEditorLayout activeTab="sessions">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {meetings.length === 0 ? (
                            <div className="col-span-full py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl text-center">
                                <Video className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-400 mb-2">No active sessions</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">Start by scheduling your first virtual meeting for this course.</p>
                            </div>
                        ) : (
                            meetings.map(meeting => (
                                <div key={meeting.id} className="glass p-6 border-white/10 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleDeleteMeeting(meeting.id)}
                                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                                            <Video size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg leading-tight mb-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{meeting.title}</h4>
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                <Globe size={10} />
                                                {meeting.provider} Session
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-8">
                                        <div className="flex items-center gap-3 text-sm text-gray-400">
                                            <CalendarIcon size={16} className="text-blue-500" />
                                            <span className="font-medium">{new Date(meeting.start_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-400">
                                            <Clock size={16} className="text-blue-500" />
                                            <span className="font-medium">
                                                {new Date(meeting.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                <span className="mx-2 opacity-30">|</span>
                                                {meeting.duration_minutes} minutes
                                            </span>
                                        </div>
                                        {meeting.description && (
                                            <p className="text-xs text-gray-500 line-clamp-2 mt-2 leading-relaxed italic">
                                                "{meeting.description}"
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                            onClick={() => {
                                                const url = meeting.join_url || `https://meet.jit.si/${meeting.meeting_id}`;
                                                window.open(url, '_blank');
                                            }}
                                        >
                                            <LinkIcon size={14} />
                                            Preview Link
                                        </button>
                                        <div className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${meeting.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500'}`}>
                                            {meeting.is_active ? 'Scheduled' : 'Past'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CourseEditorLayout>
            </div>

            {/* Create Meeting Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#16181b] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl scale-in-center">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2 font-black uppercase tracking-tighter">
                                <Video className="text-blue-500" />
                                Schedule Session
                            </h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Meeting Title</label>
                                <input
                                    type="text"
                                    value={newMeeting.title}
                                    onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                                    placeholder="e.g., Weekly Office Hours"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Description (Optional)</label>
                                <textarea
                                    value={newMeeting.description}
                                    onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                                    placeholder="What will be covered?"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50 resize-none h-20"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-500">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={newMeeting.start_at}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, start_at: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-500">Duration (Min)</label>
                                    <input
                                        type="number"
                                        value={newMeeting.duration_minutes}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, duration_minutes: parseInt(e.target.value) })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                            </div>

                            <div className="pt-6">
                                <button
                                    onClick={handleCreateMeeting}
                                    disabled={!newMeeting.title}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/10"
                                >
                                    Create Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
