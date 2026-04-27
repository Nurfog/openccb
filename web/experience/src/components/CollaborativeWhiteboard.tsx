"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { lmsApi, getLmsApiUrl, getToken, CollaborativeCanvasState } from "@/lib/api";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";

type ConflictInfo = {
    localStrokes: Stroke[];
    remoteStrokes: Stroke[];
    remoteRevision: number;
    remoteUpdatedAt: string;
};

type Point = { x: number; y: number };
type Stroke = {
    points: Point[];
    color: string;
    width: number;
};

type Props = {
    lessonId: string;
};

const DEFAULT_CANVAS: CollaborativeCanvasState = { strokes: [] };

function toStrokeArray(state: CollaborativeCanvasState): Stroke[] {
    if (!Array.isArray(state.strokes)) {
        return [];
    }

    return state.strokes
        .map((stroke) => {
            const points = Array.isArray(stroke.points)
                ? stroke.points
                      .filter((p): p is Point => typeof p?.x === "number" && typeof p?.y === "number")
                      .map((p) => ({ x: p.x, y: p.y }))
                : [];

            return {
                points,
                color: typeof stroke.color === "string" ? stroke.color : "#1f2937",
                width: typeof stroke.width === "number" ? stroke.width : 2,
            };
        })
        .filter((stroke) => stroke.points.length > 1);
}

export default function CollaborativeWhiteboard({ lessonId }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [conflict, setConflict] = useState<ConflictInfo | null>(null);

    const isDrawing = useRef(false);
    const dirtyRef = useRef(false);
    const revisionRef = useRef(0);

    useEffect(() => {
        dirtyRef.current = dirty;
    }, [dirty]);

    useEffect(() => {
        revisionRef.current = revision;
    }, [revision]);

    const allStrokes = useMemo(() => {
        return draftStroke ? [...strokes, draftStroke] : strokes;
    }, [strokes, draftStroke]);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (!canvas || !wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const scale = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(rect.width * scale));
        canvas.height = Math.max(1, Math.floor(340 * scale));
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = "340px";

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(scale, scale);
    }, []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (const stroke of allStrokes) {
            if (stroke.points.length < 2) continue;
            ctx.beginPath();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i += 1) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }
    }, [allStrokes]);

    useEffect(() => {
        resizeCanvas();
        draw();
    }, [resizeCanvas, draw]);

    useEffect(() => {
        const onResize = () => {
            resizeCanvas();
            draw();
        };

        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [draw, resizeCanvas]);

    const getPoint = (event: PointerEvent<HTMLCanvasElement>): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return { x, y };
    };

    const loadCanvas = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await lmsApi.getLessonCollaborativeCanvas(lessonId);
            const loadedStrokes = toStrokeArray(data.canvas_state || DEFAULT_CANVAS);
            setStrokes(loadedStrokes);
            setDraftStroke(null);
            setLastSavedAt(data.updated_at || null);
            setRevision(data.revision || 0);
            setDirty(false);
        } catch (e) {
            console.error("Error loading collaborative canvas", e);
            setError("No se pudo cargar la pizarra colaborativa.");
        } finally {
            setLoading(false);
        }
    }, [lessonId]);

    const saveCanvas = useCallback(async (force = false) => {
        if (saving || loading || isDrawing.current) return;
        setSaving(true);
        setError(null);
        const expectedRev = force ? undefined : revision;
        try {
            const result = await lmsApi.updateLessonCollaborativeCanvas(lessonId, { strokes }, expectedRev);
            setLastSavedAt(result.updated_at);
            setRevision(result.revision);
            setDirty(false);
            setConflict(null);
        } catch (e) {
            console.error("Error saving collaborative canvas", e);
            if (e instanceof Error && e.message.toLowerCase().includes("conflicto")) {
                // Fetch remote state to show diff panel
                try {
                    const remote = await lmsApi.getLessonCollaborativeCanvas(lessonId);
                    setConflict({
                        localStrokes: strokes,
                        remoteStrokes: toStrokeArray(remote.canvas_state || DEFAULT_CANVAS),
                        remoteRevision: remote.revision || 0,
                        remoteUpdatedAt: remote.updated_at ?? new Date().toISOString(),
                    });
                } catch {
                    setError("Conflicto detectado y no se pudo obtener el estado remoto. Recarga manualmente.");
                }
                return;
            }
            setError("No se pudo guardar la pizarra. Intenta nuevamente.");
        } finally {
            setSaving(false);
        }
    }, [lessonId, loading, revision, saving, strokes]);

    useEffect(() => {
        loadCanvas();
    }, [loadCanvas]);

    const acceptRemote = useCallback(() => {
        if (!conflict) return;
        setStrokes(conflict.remoteStrokes);
        setRevision(conflict.remoteRevision);
        setLastSavedAt(conflict.remoteUpdatedAt);
        setDirty(false);
        setConflict(null);
        setError(null);
    }, [conflict]);

    const forceLocal = useCallback(() => {
        setConflict(null);
        void saveCanvas(true);
    }, [saveCanvas]);

    useEffect(() => {
        if (!dirty || loading || saving || isDrawing.current) {
            return;
        }

        const timeoutId = setTimeout(() => {
            void saveCanvas();
        }, 1500);

        return () => clearTimeout(timeoutId);
    }, [dirty, loading, saveCanvas, saving, strokes]);

    useEffect(() => {
        const base = getLmsApiUrl();
        const token = getToken() || "";

        const url = `${base}/lessons/${lessonId}/collaborative-canvas/stream${token ? `?preview_token=${encodeURIComponent(token)}` : ""}`;
        const es = new EventSource(url);

        es.onmessage = (ev) => {
            if (dirtyRef.current || isDrawing.current) return;
            try {
                const data = JSON.parse(ev.data as string) as {
                    revision: number;
                    canvas_state: CollaborativeCanvasState;
                    updated_at: string;
                };
                if (data.revision !== revisionRef.current) {
                    setStrokes(toStrokeArray(data.canvas_state || DEFAULT_CANVAS));
                    setRevision(data.revision);
                    setLastSavedAt(data.updated_at);
                }
            } catch {
                // Ignorar eventos malformados
            }
        };

        es.onerror = () => {
            // EventSource reintenta automáticamente; no mostramos error al usuario
        };

        return () => {
            es.close();
        };
    }, [lessonId]);

    return (
        <section className="space-y-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">Pizarra colaborativa (MVP)</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dibuja ideas rápidas de la lección y compártelas con tu grupo.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setStrokes([]);
                            setDraftStroke(null);
                            setDirty(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                        <Trash2 className="h-3 w-3" /> Limpiar
                    </button>
                    <button
                        type="button"
                        onClick={() => void saveCanvas()}
                        disabled={saving || (!dirty && !loading)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
                    </button>
                    <button
                        type="button"
                        onClick={loadCanvas}
                        disabled={loading}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recargar
                    </button>
                </div>
            </div>

            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

            {conflict && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-black text-amber-800 dark:text-amber-300">
                                Conflicto de edición detectado
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                Otro usuario guardó mientras editabas. Elige qué versión conservar:
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-3">
                            <p className="font-black text-blue-800 dark:text-blue-300 mb-1">Tu versión (local)</p>
                            <p className="text-blue-700 dark:text-blue-400">
                                {conflict.localStrokes.length} trazos
                            </p>
                            <p className="text-blue-500 dark:text-blue-500 mt-1">No guardada</p>
                        </div>
                        <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/20 p-3">
                            <p className="font-black text-green-800 dark:text-green-300 mb-1">Versión del servidor</p>
                            <p className="text-green-700 dark:text-green-400">
                                {conflict.remoteStrokes.length} trazos · rev. {conflict.remoteRevision}
                            </p>
                            <p className="text-green-500 dark:text-green-500 mt-1">
                                {new Date(conflict.remoteUpdatedAt).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={forceLocal}
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Guardar mi versión
                        </button>
                        <button
                            type="button"
                            onClick={acceptRemote}
                            className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200"
                        >
                            <CheckCircle className="h-3 w-3" />
                            Usar versión del servidor
                        </button>
                    </div>
                </div>
            )}

            <div ref={wrapperRef} className="w-full overflow-hidden rounded-2xl border border-black/10 bg-white">
                <canvas
                    ref={canvasRef}
                    className="touch-none"
                    onPointerDown={(event) => {
                        const point = getPoint(event);
                        if (!point) return;
                        isDrawing.current = true;
                        setDraftStroke({ points: [point], color: "#1f2937", width: 2 });
                    }}
                    onPointerMove={(event) => {
                        if (!isDrawing.current) return;
                        const point = getPoint(event);
                        if (!point) return;
                        setDraftStroke((prev) => {
                            if (!prev) return prev;
                            return { ...prev, points: [...prev.points, point] };
                        });
                    }}
                    onPointerUp={() => {
                        if (!isDrawing.current) return;
                        isDrawing.current = false;
                        setDraftStroke((prev) => {
                            if (!prev || prev.points.length < 2) return null;
                            setStrokes((current) => [...current, prev]);
                            setDirty(true);
                            return null;
                        });
                    }}
                    onPointerLeave={() => {
                        if (!isDrawing.current) return;
                        isDrawing.current = false;
                        setDraftStroke((prev) => {
                            if (!prev || prev.points.length < 2) return null;
                            setStrokes((current) => [...current, prev]);
                            setDirty(true);
                            return null;
                        });
                    }}
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <span>Trazos: {strokes.length}</span>
                <span>
                    {saving
                        ? "Guardando..."
                        : dirty
                            ? "Cambios sin guardar (autosave en 1.5s)"
                            : "Sin cambios pendientes"}
                </span>
                <span>Revision: {revision}</span>
                <span>Última sincronización: {lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : "nunca"}</span>
            </div>
        </section>
    );
}
