"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { lmsApi, getLessonCollaborativeDoc, CollaborativeDoc } from "@/lib/api";
import {
    ArrowLeft,
    FileText,
    RefreshCw,
    Trash2,
    Eye,
    Clock,
    User,
} from "lucide-react";

export default function LessonCollaborativeDocPage() {
    const { id: courseId, lessonId } = useParams() as { id: string; lessonId: string };
    const router = useRouter();
    const [doc, setDoc] = useState<CollaborativeDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);
    const [cleared, setCleared] = useState(false);

    const loadDoc = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getLessonCollaborativeDoc(lessonId);
            setDoc(data);
        } catch (e) {
            // El doc puede no existir aún (revision 0)
            setDoc({ lesson_id: lessonId, organization_id: "", content: "", revision: 0, last_modified_by: null, updated_at: new Date().toISOString() });
        } finally {
            setLoading(false);
        }
    }, [lessonId]);

    useEffect(() => {
        void loadDoc();
    }, [loadDoc]);

    const clearDoc = async () => {
        const ok = confirm("¿Borrar el contenido del documento colaborativo? Los estudiantes perderán todo el texto.");
        if (!ok) return;
        setClearing(true);
        try {
            await lmsApi.updateLessonCollaborativeDoc(lessonId, {
                content: "",
                base_revision: doc?.revision ?? 0,
            });
            setCleared(true);
            setDoc((prev) => prev ? { ...prev, content: "", revision: (prev.revision || 0) + 1 } : prev);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo borrar el documento");
        } finally {
            setClearing(false);
        }
    };

    const wordCount = (doc?.content ?? "").trim().split(/\s+/).filter(Boolean).length;
    const charCount = (doc?.content ?? "").length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 px-4 py-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <h1 className="text-lg font-black flex items-center gap-2">
                        <FileText className="w-5 h-5" /> Documento Colaborativo
                    </h1>
                    <p className="text-xs text-black/50 dark:text-white/50">
                        Vista de instructor — lección <span className="font-mono">{lessonId.slice(0, 8)}…</span>
                    </p>
                </div>
                <button
                    onClick={() => void loadDoc()}
                    className="ml-auto p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                    title="Recargar"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {cleared && (
                <div className="mb-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-3 text-sm text-green-700 dark:text-green-300">
                    Documento borrado correctamente.
                </div>
            )}

            {/* Metadatos */}
            <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 mb-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                        <div className="text-black/40 dark:text-white/40 mb-0.5">Revisión</div>
                        <div className="font-black text-lg">{doc?.revision ?? 0}</div>
                    </div>
                    <div>
                        <div className="text-black/40 dark:text-white/40 mb-0.5">Palabras</div>
                        <div className="font-black text-lg">{wordCount}</div>
                    </div>
                    <div>
                        <div className="text-black/40 dark:text-white/40 mb-0.5">Caracteres</div>
                        <div className="font-black text-lg">{charCount}</div>
                    </div>
                    <div>
                        <div className="text-black/40 dark:text-white/40 mb-0.5">Última edición</div>
                        <div className="font-semibold">
                            {doc?.updated_at ? new Date(doc.updated_at).toLocaleString() : "—"}
                        </div>
                    </div>
                </div>
                {doc?.last_modified_by && (
                    <div className="flex items-center gap-1 text-xs text-black/50 dark:text-white/40">
                        <User className="w-3 h-3" />
                        Último editor: <span className="font-mono">{doc.last_modified_by}</span>
                    </div>
                )}
            </section>

            {/* Vista previa del contenido */}
            <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-black/40 dark:text-white/40 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Contenido actual
                    </h2>
                </div>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />
                    </div>
                ) : doc?.content ? (
                    <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed max-h-96 overflow-auto text-black/80 dark:text-white/80">
                        {doc.content}
                    </pre>
                ) : (
                    <p className="text-sm text-black/40 dark:text-white/40 text-center py-8">
                        El documento está vacío — los estudiantes aún no han escrito nada.
                    </p>
                )}
            </section>

            {/* Acciones */}
            <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 flex items-center justify-between gap-4">
                <div className="text-xs text-black/50 dark:text-white/50">
                    El documento es editable por todos los estudiantes matriculados en el curso en tiempo real via SSE.
                </div>
                <button
                    onClick={() => void clearDoc()}
                    disabled={clearing || !doc?.content}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm font-semibold hover:bg-red-100 disabled:opacity-40"
                >
                    <Trash2 className="w-4 h-4" />
                    {clearing ? "Borrando…" : "Borrar documento"}
                </button>
            </section>
        </div>
    );
}
