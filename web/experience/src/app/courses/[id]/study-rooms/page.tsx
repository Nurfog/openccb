"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, StudyRoom, BbbRecording } from "@/lib/api";
import { Video, Users, Clock, ExternalLink, ArrowLeft, RefreshCw, Film, ChevronDown, ChevronRight } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
    pending: "Programada",
    active: "En curso",
    ended: "Finalizada",
};
const STATUS_COLOR: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    ended: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/40",
};

export default function StudyRoomsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [rooms, setRooms] = useState<StudyRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [recordings, setRecordings] = useState<Record<string, BbbRecording[]>>({});
    const [loadingRec, setLoadingRec] = useState<Record<string, boolean>>({});
    const [expandedRec, setExpandedRec] = useState<Record<string, boolean>>({});

    const loadRooms = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await lmsApi.listCourseStudyRooms(id);
            setRooms(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudieron cargar las salas");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void loadRooms();
    }, [loadRooms]);

    const join = async (room: StudyRoom) => {
        setJoiningId(room.id);
        setError(null);
        try {
            const result = await lmsApi.joinStudyRoom(id, room.id);
            window.open(result.join_url, "_blank", "noopener,noreferrer");
            void loadRooms();
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo unir a la sala");
        } finally {
            setJoiningId(null);
        }
    };

    const activeRooms = rooms.filter((r) => r.status !== "ended");
    const endedRooms = rooms.filter((r) => r.status === "ended");

    const toggleRecordings = async (room: StudyRoom) => {
        const isExpanded = expandedRec[room.id];
        setExpandedRec((prev) => ({ ...prev, [room.id]: !isExpanded }));
        if (!isExpanded && !recordings[room.id]) {
            setLoadingRec((prev) => ({ ...prev, [room.id]: true }));
            try {
                const recs = await lmsApi.getStudyRoomRecordings(id, room.id);
                setRecordings((prev) => ({ ...prev, [room.id]: recs }));
            } catch {
                setRecordings((prev) => ({ ...prev, [room.id]: [] }));
            } finally {
                setLoadingRec((prev) => ({ ...prev, [room.id]: false }));
            }
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 px-4 py-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <h1 className="text-lg font-black flex items-center gap-2">
                        <Video className="w-5 h-5" /> Salas de Estudio
                    </h1>
                    <p className="text-xs text-black/50 dark:text-white/50">Únete a sesiones en vivo con tu grupo</p>
                </div>
                <button
                    onClick={() => void loadRooms()}
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

            {loading && rooms.length === 0 && (
                <div className="flex justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />
                </div>
            )}

            {!loading && rooms.length === 0 && (
                <div className="text-center py-16 text-black/40 dark:text-white/40">
                    <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No hay salas de estudio activas para este curso.</p>
                </div>
            )}

            {activeRooms.length > 0 && (
                <section className="space-y-3 mb-6">
                    <h2 className="text-xs font-black uppercase tracking-wider text-black/40 dark:text-white/40">
                        Salas disponibles
                    </h2>
                    {activeRooms.map((room) => (
                        <div
                            key={room.id}
                            className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 flex flex-wrap items-center justify-between gap-4"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="font-semibold text-sm">{room.title}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[room.status]}`}>
                                        {STATUS_LABEL[room.status]}
                                    </span>
                                </div>
                                {room.description && (
                                    <p className="text-xs text-black/50 dark:text-white/50 mb-2">{room.description}</p>
                                )}
                                <div className="flex items-center gap-3 text-[11px] text-black/40 dark:text-white/40">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Máx. {room.max_participants} participantes
                                    </span>
                                    {room.started_at && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(room.started_at).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => void join(room)}
                                disabled={joiningId === room.id}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                            >
                                {joiningId === room.id ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    <ExternalLink className="w-4 h-4" />
                                )}
                                {joiningId === room.id ? "Conectando..." : "Unirse"}
                            </button>
                        </div>
                    ))}
                </section>
            )}

            {endedRooms.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-xs font-black uppercase tracking-wider text-black/30 dark:text-white/30">
                        Salas finalizadas
                    </h2>
                    {endedRooms.map((room) => (
                        <div key={room.id} className="rounded-xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/5">
                            <div className="px-4 py-3 flex items-center justify-between gap-3">
                                <div>
                                    <span className="text-sm font-medium">{room.title}</span>
                                    {room.ended_at && (
                                        <span className="ml-2 text-[11px] text-black/40 dark:text-white/40">
                                            Finalizada {new Date(room.ended_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => void toggleRecordings(room)}
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100"
                                    >
                                        {expandedRec[room.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        <Film className="w-3 h-3" /> Grabaciones
                                    </button>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR.ended}`}>
                                        {STATUS_LABEL.ended}
                                    </span>
                                </div>
                            </div>
                            {expandedRec[room.id] && (
                                <div className="px-4 pb-3">
                                    {loadingRec[room.id] ? (
                                        <p className="text-xs text-black/50 dark:text-white/50">Cargando grabaciones…</p>
                                    ) : recordings[room.id]?.length ? (
                                        <div className="space-y-2">
                                            {recordings[room.id].map((rec) => (
                                                <div key={rec.record_id} className="flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                                                    <div>
                                                        <span className="font-semibold">{rec.name}</span>
                                                        <span className="ml-2 text-black/40 dark:text-white/40">{rec.duration_minutes} min</span>
                                                    </div>
                                                    <a
                                                        href={rec.playback_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                                                    >
                                                        <ExternalLink className="w-3 h-3" /> Ver grabación
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-black/40 dark:text-white/40">No hay grabaciones disponibles.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            )}
        </main>
    );
}
