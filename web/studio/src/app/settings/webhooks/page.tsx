"use client";

import React, { useState, useEffect } from "react";
import { cmsApi, Webhook, CreateWebhookPayload } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Webhook as WebhookIcon,
    Plus,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Shield,
    Globe,
    Activity
} from "lucide-react";
import { Navbar } from "@/components/Navbar";

const AVAILABLE_EVENTS = [
    { id: 'course.published', label: 'Course Published', description: 'Triggered when a course is published to LMS' },
    { id: 'lesson.completed', label: 'Lesson Completed', description: 'Triggered when a student completes a lesson' },
    { id: 'user.enrolled', label: 'User Enrolled', description: 'Triggered when a user enrolls in a course' }
];

export default function WebhooksPage() {
    const { user } = useAuth();
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newWebhook, setNewWebhook] = useState<CreateWebhookPayload>({
        url: '',
        events: ['course.published'],
        secret: ''
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchWebhooks();
        }
    }, [user]);

    const fetchWebhooks = async () => {
        try {
            const data = await cmsApi.getWebhooks();
            setWebhooks(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await cmsApi.createWebhook(newWebhook);
            setNewWebhook({ url: '', events: ['course.published'], secret: '' });
            setIsAdding(false);
            fetchWebhooks();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this webhook?')) return;
        try {
            await cmsApi.deleteWebhook(id);
            fetchWebhooks();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    };

    const toggleEvent = (eventId: string) => {
        setNewWebhook(prev => ({
            ...prev,
            events: prev.events.includes(eventId)
                ? prev.events.filter(e => e !== eventId)
                : [...prev.events, eventId]
        }));
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f1115] text-white">
            <Navbar />
            <main className="max-w-5xl mx-auto pt-32 pb-20 px-6">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-4xl font-black mb-2 flex items-center gap-4">
                            <WebhookIcon size={40} className="text-blue-500" />
                            Enterprise Webhooks
                        </h1>
                        <p className="text-gray-400">Integrate OpenCCB with your external systems via HTTP callbacks.</p>
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="btn-premium flex items-center gap-2 px-6 py-3"
                    >
                        <Plus size={20} /> Add Webhook
                    </button>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400" id="webhook-error">
                        <AlertCircle size={20} />
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                {isAdding && (
                    <div className="mb-12 bg-white/5 border border-white/10 rounded-3xl p-8 overflow-hidden relative group">
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                            <Plus size={20} className="text-blue-400" />
                            Configure New Webhook
                        </h2>
                        <form onSubmit={handleCreate} className="space-y-6 relative">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Globe size={14} /> Payload URL
                                    </label>
                                    <input
                                        type="url"
                                        id="webhook-url"
                                        required
                                        placeholder="https://your-api.com/webhooks"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                                        value={newWebhook.url}
                                        onChange={e => setNewWebhook({ ...newWebhook, url: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Shield size={14} /> Secret (HMAC-SHA256)
                                    </label>
                                    <input
                                        type="text"
                                        id="webhook-secret"
                                        placeholder="Optional signing secret"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                                        value={newWebhook.secret}
                                        onChange={e => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Activity size={14} /> Events to Subscribe
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {AVAILABLE_EVENTS.map(event => (
                                        <div
                                            key={event.id}
                                            id={`event-${event.id}`}
                                            onClick={() => toggleEvent(event.id)}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${newWebhook.events.includes(event.id)
                                                ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                                : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold">{event.label}</span>
                                                {newWebhook.events.includes(event.id) && <CheckCircle2 size={16} />}
                                            </div>
                                            <p className="text-[10px] opacity-60 leading-relaxed font-medium">{event.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-6 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button type="submit" id="create-webhook-btn" className="btn-premium px-8 py-2">Create Webhook</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="space-y-6">
                    {webhooks.length === 0 && !isAdding ? (
                        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-3xl">
                            <WebhookIcon size={64} className="mx-auto text-gray-600 mb-6" />
                            <h3 className="text-xl font-bold text-gray-400">No webhooks configured</h3>
                            <p className="text-sm text-gray-500 mt-2">Add your first webhook to start receiving system notifications.</p>
                        </div>
                    ) : (
                        webhooks.map(webhook => (
                            <div key={webhook.id} className="bg-white/5 border border-white/10 rounded-3xl p-8 flex items-center justify-between group hover:bg-white/[0.07] transition-all">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <Globe size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{webhook.url}</h3>
                                            <p className="text-xs text-gray-500">Created on {new Date(webhook.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {webhook.events.map(event => (
                                            <span key={event} className="text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                                                {event}
                                            </span>
                                        ))}
                                        {webhook.secret && (
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full border border-purple-500/20 flex items-center gap-1">
                                                <Shield size={10} /> Signed
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-end mr-4">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${webhook.is_active ? 'text-green-400' : 'text-gray-500'}`}>
                                            {webhook.is_active ? 'Active' : 'Paused'}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-600">ID: {webhook.id.slice(0, 8)}...</span>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(webhook.id)}
                                        className="delete-webhook-btn p-3 bg-red-500/10 text-red-400 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110 shadow-lg"
                                        title="Delete Webhook"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
