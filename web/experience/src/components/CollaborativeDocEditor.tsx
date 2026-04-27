"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lmsApi, getLmsApiUrl, CollaborativeDoc, UpdateCollaborativeDocResponse } from "@/lib/api";
import {
    AlertTriangle,
    CheckCircle,
    Loader2,
    Save,
    Users,
} from "lucide-react";

type ConflictInfo = {
    localContent: string;
    serverContent: string;
    serverRevision: number;
};

type Props = {
    lessonId: string;
};

export default function CollaborativeDocEditor({ lessonId }: Props) {
    const [content, setContent] = useState("");
    const [revision, setRevision] = useState(0);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<"idle" | "saved" | "conflict" | "error">("idle");
    const [conflict, setConflict] = useState<ConflictInfo | null>(null);
    const [activeEditors, setActiveEditors] = useState(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sseRef = useRef<EventSource | null>(null);
    const localDirtyRef = useRef(false);
    const revisionRef = useRef(0);
    const contentRef = useRef("");

    // Cargar documento inicial
    useEffect(() => {
        void (async () => {
            try {
                const doc: CollaborativeDoc = await lmsApi.getLessonCollaborativeDoc(lessonId);
                setContent(doc.content);
                setRevision(doc.revision);
                revisionRef.current = doc.revision;
                contentRef.current = doc.content;
            } catch {
                setStatus("error");
            }
        })();
    }, [lessonId]);

    // SSE: escuchar cambios remotos
    useEffect(() => {
        const token = typeof window !== "undefined"
            ? localStorage.getItem("lms_token") ?? sessionStorage.getItem("lms_token") ?? ""
            : "";
        const baseUrl = getLmsApiUrl();
        const url = `${baseUrl}/lessons/${lessonId}/collaborative-doc/stream?preview_token=${encodeURIComponent(token)}`;

        const es = new EventSource(url);
        sseRef.current = es;

        es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data as string) as {
                    content: string;
                    revision: number;
                };
                // Solo actualizar si no tenemos cambios locales pendientes
                if (!localDirtyRef.current && data.revision !== revisionRef.current) {
                    setContent(data.content);
                    setRevision(data.revision);
                    revisionRef.current = data.revision;
                    contentRef.current = data.content;
                }
                // Contar "editores activos" como señal de conexión SSE viva
                setActiveEditors((n) => Math.max(1, n));
            } catch { /* ignore */ }
        };

        es.onerror = () => {
            setActiveEditors(0);
        };

        return () => {
            es.close();
            sseRef.current = null;
        };
    }, [lessonId]);

    // Guardar con debounce 1.5s
    const save = useCallback(async (text: string, baseRevision: number) => {
        setSaving(true);
        setStatus("idle");
        try {
            const res: UpdateCollaborativeDocResponse = await lmsApi.updateLessonCollaborativeDoc(lessonId, {
                content: text,
                base_revision: baseRevision,
            });

            if (res.conflict) {
                setConflict({
                    localContent: text,
                    serverContent: res.server_content ?? "",
                    serverRevision: res.server_revision ?? baseRevision,
                });
                setStatus("conflict");
            } else {
                setRevision(res.revision);
                revisionRef.current = res.revision;
                contentRef.current = text;
                localDirtyRef.current = false;
                setStatus("saved");
                setTimeout(() => setStatus("idle"), 2000);
            }
        } catch {
            setStatus("error");
        } finally {
            setSaving(false);
        }
    }, [lessonId]);

    const handleChange = (value: string) => {
        setContent(value);
        contentRef.current = value;
        localDirtyRef.current = true;
        setStatus("idle");

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            void save(contentRef.current, revisionRef.current);
        }, 1500);
    };

    // Resolución de conflictos
    const resolveKeepMine = () => {
        if (!conflict) return;
        setConflict(null);
        setStatus("idle");
        // Forzar guardado con la revisión del servidor (sobreescribir)
        void save(conflict.localContent, conflict.serverRevision);
    };

    const resolveKeepServer = () => {
        if (!conflict) return;
        setContent(conflict.serverContent);
        setRevision(conflict.serverRevision);
        revisionRef.current = conflict.serverRevision;
        contentRef.current = conflict.serverContent;
        localDirtyRef.current = false;
        setConflict(null);
        setStatus("idle");
    };

    // Toolbar: aplicar formato HTML básico via execCommand (compatible con contenteditable)
    // Para mantener simpleza y no depender de librerías externas usamos un <textarea>
    // con soporte de Markdown ligero renderizado al vuelo.

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Barra de estado */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/40">
                    <Users className="w-3 h-3" />
                    <span>{activeEditors > 0 ? "Conexión en vivo" : "Sin conexión SSE"}</span>
                    <span className="opacity-50">· Rev. {revision}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                    {saving && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                    {status === "saved" && <CheckCircle className="w-3 h-3 text-green-500" />}
                    {status === "conflict" && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    {status === "error" && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    {saving && <span className="text-blue-500">Guardando…</span>}
                    {status === "saved" && <span className="text-green-500">Guardado</span>}
                    {status === "conflict" && <span className="text-amber-500">Conflicto detectado</span>}
                    {status === "error" && <span className="text-red-500">Error al guardar</span>}
                </div>
            </div>

            {/* Toolbar de formato */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-mono">
                {[
                    { label: "B", title: "Negrita: **texto**", insert: "**texto**" },
                    { label: "I", title: "Cursiva: _texto_", insert: "_texto_" },
                    { label: "H1", title: "Título: # Título", insert: "\n# Título\n" },
                    { label: "H2", title: "Subtítulo: ## Subtítulo", insert: "\n## Subtítulo\n" },
                    { label: "• Lista", title: "Lista: - ítem", insert: "\n- ítem\n" },
                    { label: "1. Lista", title: "Lista ordenada: 1. ítem", insert: "\n1. ítem\n" },
                    { label: "---", title: "Separador", insert: "\n---\n" },
                ].map((btn) => (
                    <button
                        key={btn.label}
                        title={btn.title}
                        className="px-2 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const newContent = contentRef.current + btn.insert;
                            setContent(newContent);
                            handleChange(newContent);
                        }}
                    >
                        {btn.label}
                    </button>
                ))}
                <div className="ml-auto">
                    <button
                        title="Guardar ahora"
                        className="px-2 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-1"
                        onClick={() => void save(contentRef.current, revisionRef.current)}
                    >
                        <Save className="w-3 h-3" /> Guardar
                    </button>
                </div>
            </div>

            {/* Área de edición */}
            <textarea
                className="w-full min-h-[320px] rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                value={content}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Empieza a escribir… Los cambios se sincronizan automáticamente con el grupo."
                spellCheck
            />

            {/* Panel de conflicto */}
            {conflict && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-black text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4" />
                        Conflicto de edición
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                        Otro usuario guardó cambios mientras editabas. ¿Qué versión deseas conservar?
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <div className="font-semibold mb-1 text-amber-700 dark:text-amber-300">Tu versión</div>
                            <pre className="rounded-lg bg-white dark:bg-black/30 p-2 overflow-auto max-h-32 whitespace-pre-wrap text-[11px]">
                                {conflict.localContent.slice(0, 300)}{conflict.localContent.length > 300 ? "…" : ""}
                            </pre>
                        </div>
                        <div>
                            <div className="font-semibold mb-1 text-amber-700 dark:text-amber-300">Versión del servidor (Rev. {conflict.serverRevision})</div>
                            <pre className="rounded-lg bg-white dark:bg-black/30 p-2 overflow-auto max-h-32 whitespace-pre-wrap text-[11px]">
                                {conflict.serverContent.slice(0, 300)}{conflict.serverContent.length > 300 ? "…" : ""}
                            </pre>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={resolveKeepMine}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                        >
                            Conservar la mía
                        </button>
                        <button
                            onClick={resolveKeepServer}
                            className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                        >
                            Usar la del servidor
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
