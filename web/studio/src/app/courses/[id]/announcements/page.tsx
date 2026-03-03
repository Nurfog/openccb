"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, AnnouncementWithAuthor, Cohort } from "@/lib/api";
import { Megaphone, Plus, Search, Loader2, ArrowLeft, Pin, Trash2, Users } from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function AnnouncementsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showNewModal, setShowNewModal] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [annData, cohortData] = await Promise.all([
                lmsApi.listAnnouncements(id),
                lmsApi.getCohorts()
            ]);
            setAnnouncements(annData);
            setCohorts(cohortData.filter((c: any) => c.course_id === id));
        } catch (error) {
            console.error("Error fetching announcements:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleDelete = async (announcementId: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este anuncio?")) return;
        try {
            await lmsApi.deleteAnnouncement(announcementId);
            fetchData();
        } catch (error) {
            console.error("Error deleting announcement:", error);
            alert("Error al eliminar el anuncio");
        }
    };

    const filteredAnnouncements = announcements.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <CourseEditorLayout
                activeTab="announcements"
                pageTitle="Anuncios"
                pageDescription="Gestiona las comunicaciones del curso y segmentos de cohortes."
                pageActions={
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md shadow-orange-500/20 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Nuevo Anuncio
                    </button>
                }
            >
                <div className="space-y-8">
                    <h2 className="section-title">
                        <Megaphone className="text-orange-500" />
                        Comunicados del Curso
                    </h2>
                    {/* Search Bar */}
                    <div className="glass p-4 rounded-2xl flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search announcements..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500"
                            />
                        </div>
                    </div>

                    {/* Announcements List */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                            <p className="text-gray-400">Loading announcements...</p>
                        </div>
                    ) : filteredAnnouncements.length > 0 ? (
                        <div className="grid gap-6">
                            {filteredAnnouncements.map((a) => (
                                <div key={a.id} className={`relative p-6 rounded-2xl border transition-all duration-300 ${a.is_pinned ? 'bg-orange-500/10 border-orange-500/30' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 hover:border-slate-200 dark:hover:border-white/20'}`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-gray-900 dark:text-white font-bold overflow-hidden">
                                                {a.author_avatar ? (
                                                    <img src={a.author_avatar} alt={a.author_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    a.author_name.charAt(0)
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 dark:text-white">{a.author_name}</h4>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
                                                    <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es })}</span>
                                                    {a.cohort_ids && a.cohort_ids.length > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <div className="flex items-center gap-1 text-blue-400 font-medium">
                                                                <Users className="w-3 h-3" />
                                                                <span>{a.cohort_ids.length} Cohorts</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {a.is_pinned && <Pin className="w-4 h-4 text-orange-400 fill-current" />}
                                            <button
                                                onClick={() => handleDelete(a.id)}
                                                className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{a.title}</h3>
                                    <p className="text-slate-600 dark:text-gray-300 whitespace-pre-wrap">{a.content}</p>

                                    {/* Display Target Cohort Names if segmented */}
                                    {a.cohort_ids && a.cohort_ids.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {a.cohort_ids.map(cid => {
                                                const cohort = cohorts.find(c => c.id === cid);
                                                return (
                                                    <span key={cid} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                                        {cohort?.name || 'Unknown Cohort'}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl p-20 text-center">
                            <Megaphone className="w-12 h-12 text-slate-400 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No announcements found</h3>
                            <p className="text-slate-500 dark:text-gray-400">Start by creating a new announcement for your students.</p>
                        </div>
                    )}
                </div>
            </CourseEditorLayout>

            {
                showNewModal && (
                    <NewAnnouncementModal
                        courseId={id}
                        cohorts={cohorts}
                        onClose={() => setShowNewModal(false)}
                        onSuccess={() => {
                            setShowNewModal(false);
                            fetchData();
                        }}
                    />
                )}
        </>
    );
}

// Inline NewAnnouncementModal for simplicity, or move to its own file if it grows
function NewAnnouncementModal({ courseId, cohorts, onClose, onSuccess }: { courseId: string, cohorts: Cohort[], onClose: () => void, onSuccess: () => void }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [isPinned, setIsPinned] = useState(false);
    const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await lmsApi.createAnnouncement(courseId, {
                title,
                content,
                is_pinned: isPinned,
                cohort_ids: selectedCohorts.length > 0 ? selectedCohorts : undefined
            });
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("Failed to create announcement");
        } finally {
            setLoading(false);
        }
    };

    const toggleCohort = (id: string) => {
        setSelectedCohorts(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1a1c1e] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <Megaphone className="w-5 h-5 text-orange-500" />
                        Create New Announcement
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white transition-colors">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-400">Title</label>
                        <input
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500"
                            placeholder="Announcement title"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-400">Content</label>
                        <textarea
                            required
                            rows={5}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50 resize-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500"
                            placeholder="Type your message here..."
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-400 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Target Segments (Optional)
                        </label>
                        <p className="text-xs text-gray-500">Select specific cohorts to receive this announcement. Leave empty to send to all students.</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                            {cohorts.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleCohort(c.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedCohorts.includes(c.id) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
                        <input
                            type="checkbox"
                            id="pin"
                            checked={isPinned}
                            onChange={(e) => setIsPinned(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-orange-600 focus:ring-orange-500/50"
                        />
                        <label htmlFor="pin" className="text-sm font-medium text-slate-600 dark:text-gray-300 cursor-pointer">
                            Pin this announcement to the top
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 font-bold text-gray-500 hover:bg-white/5 rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                            Publish Announcement
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
