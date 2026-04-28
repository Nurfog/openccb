"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { lmsApi, LessonAnnotation, CreateAnnotationPayload } from "@/lib/api";
import {
    StickyNote,
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Loader2,
    ChevronDown,
    ChevronUp,
    Clock,
} from "lucide-react";

type Props = {
    lessonId: string;
    /** Posición actual del reproductor de video (segundos), si aplica */
    videoTimestamp?: number;
};

function formatTimestamp(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "Hace un momento";
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export default function LessonAnnotations({ lessonId, videoTimestamp }: Props) {
    const [annotations, setAnnotations] = useState<LessonAnnotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const load = useCallback(async () => {
        try {
            const data = await lmsApi.getLessonAnnotations(lessonId);
            setAnnotations(data);
        } catch {
            // silencioso
        } finally {
            setLoading(false);
        }
    }, [lessonId]);

    useEffect(() => { load(); }, [load]);

    // Auto-foco al abrir
    useEffect(() => {
        if (open && textareaRef.current) textareaRef.current.focus();
    }, [open]);

    const handleCreate = async () => {
        if (!draft.trim()) return;
        setSaving(true);
        try {
            const payload: CreateAnnotationPayload = { content: draft.trim() };
            if (videoTimestamp !== undefined) {
                payload.position_data = { type: "timestamp", value: Math.round(videoTimestamp) };
            }
            const created = await lmsApi.createLessonAnnotation(lessonId, payload);
            setAnnotations(prev => [...prev, created]);
            setDraft("");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (ann: LessonAnnotation) => {
        setEditingId(ann.id);
        setEditContent(ann.content);
    };

    const handleUpdate = async (ann: LessonAnnotation) => {
        if (!editContent.trim()) return;
        try {
            const updated = await lmsApi.updateLessonAnnotation(lessonId, ann.id, {
                content: editContent.trim(),
                position_data: ann.position_data,
            });
            setAnnotations(prev => prev.map(a => a.id === updated.id ? updated : a));
            setEditingId(null);
        } catch {
            // silencioso
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await lmsApi.deleteLessonAnnotation(lessonId, id);
            setAnnotations(prev => prev.filter(a => a.id !== id));
        } catch {
            // silencioso
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
            {/* Header colapsable */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <StickyNote size={16} className="text-amber-500" />
                    </div>
                    <div className="text-left">
                        <p className="font-black text-sm text-slate-900 dark:text-white">Mis Notas</p>
                        <p className="text-[10px] text-slate-400">
                            {annotations.length === 0 ? "Sin notas" : `${annotations.length} nota${annotations.length > 1 ? "s" : ""}`}
                        </p>
                    </div>
                </div>
                {open ? (
                    <ChevronUp size={16} className="text-slate-400" />
                ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                )}
            </button>

            {open && (
                <div className="border-t border-slate-100 dark:border-white/5 p-4 space-y-4">
                    {/* Editor de nueva nota */}
                    <div className="space-y-2">
                        <textarea
                            ref={textareaRef}
                            rows={3}
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreate();
                            }}
                            placeholder={videoTimestamp !== undefined
                                ? `Nota en ${formatTimestamp(videoTimestamp)}… (Ctrl+Enter para guardar)`
                                : "Escribe una nota para esta lección… (Ctrl+Enter para guardar)"}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 resize-none"
                        />
                        {videoTimestamp !== undefined && (
                            <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                                <Clock size={10} /> Se guardará en {formatTimestamp(videoTimestamp)}
                            </p>
                        )}
                        <button
                            onClick={handleCreate}
                            disabled={saving || !draft.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Guardar nota
                        </button>
                    </div>

                    {/* Lista de notas */}
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 size={20} className="text-amber-400 animate-spin" />
                        </div>
                    ) : annotations.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-2">
                            No tienes notas en esta lección aún.
                        </p>
                    ) : (
                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {annotations.map(ann => (
                                <div
                                    key={ann.id}
                                    className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/15 rounded-xl p-3 group"
                                >
                                    {/* Posición/timestamp */}
                                    {ann.position_data?.type === "timestamp" && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full mb-1.5">
                                            <Clock size={9} />
                                            {formatTimestamp(ann.position_data.value)}
                                        </span>
                                    )}

                                    {editingId === ann.id ? (
                                        <div className="space-y-2">
                                            <textarea
                                                rows={3}
                                                value={editContent}
                                                onChange={e => setEditContent(e.target.value)}
                                                autoFocus
                                                className="w-full bg-white dark:bg-black/20 border border-amber-300 dark:border-amber-500/30 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleUpdate(ann)}
                                                    disabled={!editContent.trim()}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                >
                                                    <Check size={12} /> Guardar
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-600 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                >
                                                    <X size={12} /> Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                {ann.content}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] text-slate-400">{timeAgo(ann.updated_at)}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startEdit(ann)}
                                                        className="p-1.5 hover:bg-amber-200/60 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg transition-all"
                                                        title="Editar nota"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(ann.id)}
                                                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                                        title="Eliminar nota"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
