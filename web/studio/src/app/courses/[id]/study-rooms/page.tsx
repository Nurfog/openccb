"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import { lmsApi, StudyRoom, CreateStudyRoomPayload } from "@/lib/api";
import {
    Video,
    Plus,
    RefreshCw,
    Trash2,
    Play,
    Square,
    Clock,
    Users,
    ExternalLink,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
    pending: "Programada",
    active: "En curso",
    ended: "Finalizada",
};
const STATUS_COLOR: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    ended: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50",
};

export default function CourseStudyRoomsPage() {
    const { id } = useParams() as { id: string };
    const [rooms, setRooms] = useState<StudyRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<CreateStudyRoomPayload>({
        title: "",
        description: "",
        max_participants: 50,
    });

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

    const createRoom = async () => {
        if (!form.title.trim()) {
            setError("El título es requerido.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const created = await lmsApi.createStudyRoom(id, form);
            setRooms((prev) => [created, ...prev]);
            setForm({ title: "", description: "", max_participants: 50 });
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo crear la sala");
        } finally {
            setSaving(false);
        }
    };

    const joinRoom = async (room: StudyRoom) => {
        try {
            const result = await lmsApi.joinStudyRoom(id, room.id);
            window.open(result.join_url, "_blank", "noopener,noreferrer");
            // Refrescar para mostrar estado activo
            void loadRooms();
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo unir a la sala");
        }
    };

    const endRoom = async (room: StudyRoom) => {
        const ok = confirm(`¿Finalizar la sala "${room.title}"? Los participantes serán desconectados.`);
        if (!ok) return;
        try {
            await lmsApi.endStudyRoom(id, room.id);
            setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, status: "ended" as const } : r));
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo finalizar la sala");
        }
    };

    const deleteRoom = async (room: StudyRoom) => {
        const ok = confirm(`¿Eliminar la sala "${room.title}"?`);
        if (!ok) return;
        try {
            await lmsApi.deleteStudyRoom(id, room.id);
            setRooms((prev) => prev.filter((r) => r.id !== room.id));
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo eliminar la sala");
        }
    };

    return (
        <CourseEditorLayout
            activeTab="study-rooms"
            pageTitle="Salas de Estudio"
            pageDescription="Crea y gestiona salas de video grupales con BigBlueButton."
        >
            <div className="space-y-6">
                {/* Formulario nueva sala */}
                <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
                    <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                        <Plus className="w-4 h-4" />
                        Nueva Sala de Estudio
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                            placeholder="Título (ej: Resolución de dudas cap. 3)"
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        />
                        <input
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                            placeholder="Descripción (opcional)"
                            value={form.description ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        />
                        <input
                            type="number"
                            min={2}
                            max={200}
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                            placeholder="Máx. participantes"
                            value={form.max_participants ?? 50}
                            onChange={(e) => setForm((f) => ({ ...f, max_participants: parseInt(e.target.value) || 50 }))}
                        />
                    </div>
                    {error && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
                    )}
                    <div className="mt-3">
                        <button
                            onClick={() => void createRoom()}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-semibold disabled:opacity-50"
                        >
                            {saving ? "Creando..." : "Crear sala"}
                        </button>
                    </div>
                </section>

                {/* Lista de salas */}
                <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Salas ({rooms.length})
                        </h2>
                        <button
                            onClick={() => void loadRooms()}
                            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                            title="Recargar"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold truncate">{room.title}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[room.status]}`}>
                                            {STATUS_LABEL[room.status]}
                                        </span>
                                    </div>
                                    {room.description && (
                                        <p className="text-xs text-black/50 dark:text-white/50 mt-0.5 truncate">{room.description}</p>
                                    )}
                                    <div className="mt-1 flex items-center gap-3 text-[11px] text-black/40 dark:text-white/40">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" /> Máx. {room.max_participants}
                                        </span>
                                        {room.started_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Inicio: {new Date(room.started_at).toLocaleString()}
                                            </span>
                                        )}
                                        <span className="font-mono opacity-60">ID: {room.id.slice(0, 8)}…</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {room.status !== "ended" && (
                                        <button
                                            onClick={() => void joinRoom(room)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                        >
                                            <ExternalLink className="w-3 h-3" /> Unirse (BBB)
                                        </button>
                                    )}
                                    {room.status === "active" && (
                                        <button
                                            onClick={() => void endRoom(room)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-xs font-semibold hover:bg-orange-100"
                                        >
                                            <Square className="w-3 h-3" /> Finalizar
                                        </button>
                                    )}
                                    {room.status === "pending" && (
                                        <button
                                            onClick={() => void joinRoom(room)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-semibold hover:bg-green-100"
                                        >
                                            <Play className="w-3 h-3" /> Iniciar
                                        </button>
                                    )}
                                    {room.status === "ended" && (
                                        <button
                                            onClick={() => void deleteRoom(room)}
                                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {!loading && rooms.length === 0 && (
                            <p className="text-sm text-black/50 dark:text-white/50">No hay salas creadas para este curso.</p>
                        )}
                    </div>
                </section>

                {/* Instrucciones de configuración BBB */}
                <section className="rounded-2xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-5">
                    <h3 className="text-xs font-black text-blue-800 dark:text-blue-300 mb-2">Configuración de BigBlueButton</h3>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                        Para conectar con tu servidor BBB, define las siguientes variables de entorno en el backend:
                    </p>
                    <div className="space-y-1">
                        <code className="block text-xs font-mono bg-white dark:bg-black/30 rounded px-3 py-1.5 border border-blue-200 dark:border-blue-700">
                            BBB_URL=https://tu-servidor-bbb.com/bigbluebutton/api
                        </code>
                        <code className="block text-xs font-mono bg-white dark:bg-black/30 rounded px-3 py-1.5 border border-blue-200 dark:border-blue-700">
                            BBB_SECRET=tu_shared_secret_bbb
                        </code>
                    </div>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-2">
                        Puedes obtener estos valores desde la consola de tu servidor BBB con: <code className="font-mono">bbb-conf --secret</code>
                    </p>
                </section>
            </div>
        </CourseEditorLayout>
    );
}
