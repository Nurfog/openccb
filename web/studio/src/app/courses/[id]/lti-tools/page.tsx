"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import {
    lmsApi,
    LtiExternalTool,
    CreateLtiExternalToolPayload,
} from "@/lib/api";
import {
    Link2,
    Plus,
    RefreshCw,
    Trash2,
    ToggleLeft,
    ToggleRight,
    ExternalLink,
} from "lucide-react";

export default function CourseLtiToolsPage() {
    const { id } = useParams() as { id: string };
    const [tools, setTools] = useState<LtiExternalTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<CreateLtiExternalToolPayload>({
        name: "",
        launch_url: "",
        shared_secret: "",
        enabled: true,
    });

    const loadTools = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await lmsApi.listCourseLtiTools(id);
            setTools(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudieron cargar herramientas LTI");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void loadTools();
    }, [loadTools]);

    const createTool = async () => {
        if (!form.name.trim() || !form.launch_url.trim() || !form.shared_secret.trim()) {
            setError("Completa nombre, launch_url y shared_secret.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const created = await lmsApi.createCourseLtiTool(id, form);
            setTools((prev) => [...prev, created]);
            setForm({ name: "", launch_url: "", shared_secret: "", enabled: true });
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo crear la herramienta");
        } finally {
            setSaving(false);
        }
    };

    const toggleTool = async (tool: LtiExternalTool) => {
        try {
            const updated = await lmsApi.updateCourseLtiTool(id, tool.id, { enabled: !tool.enabled });
            setTools((prev) => prev.map((t) => (t.id === tool.id ? updated : t)));
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo actualizar la herramienta");
        }
    };

    const deleteTool = async (tool: LtiExternalTool) => {
        const ok = confirm(`¿Eliminar la herramienta LTI "${tool.name}"?`);
        if (!ok) return;
        try {
            await lmsApi.deleteCourseLtiTool(id, tool.id);
            setTools((prev) => prev.filter((t) => t.id !== tool.id));
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo eliminar la herramienta");
        }
    };

    return (
        <CourseEditorLayout activeTab="lti-tools" pageTitle="Herramientas LTI" pageDescription="Configura laboratorios externos y su passback de notas.">
            <div className="space-y-6">
                <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Registrar Herramienta
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                            placeholder="Nombre"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        />
                        <input
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                            placeholder="https://tool.example/launch"
                            value={form.launch_url}
                            onChange={(e) => setForm((f) => ({ ...f, launch_url: e.target.value }))}
                        />
                        <input
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                            placeholder="Shared secret (>=16)"
                            value={form.shared_secret}
                            onChange={(e) => setForm((f) => ({ ...f, shared_secret: e.target.value }))}
                        />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                        <button
                            onClick={() => void createTool()}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm disabled:opacity-50"
                        >
                            {saving ? "Guardando..." : "Crear herramienta"}
                        </button>
                        <p className="text-xs text-black/50 dark:text-white/50">
                            Passback endpoint: <span className="font-mono">/lti/tools/{'{tool_id}'}/grade-passback</span>. Headers requeridos: <span className="font-mono">x-openccb-lti-timestamp</span> y <span className="font-mono">x-openccb-lti-signature</span> (HMAC-SHA256).
                        </p>
                    </div>
                </section>

                <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Link2 className="w-4 h-4" />
                            Herramientas registradas
                        </h2>
                        <button
                            onClick={() => void loadTools()}
                            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                            title="Recargar"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
                    )}

                    <div className="space-y-3">
                        {tools.map((tool) => (
                            <div
                                key={tool.id}
                                className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-3 flex items-center justify-between gap-4"
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate">{tool.name}</div>
                                    <a
                                        href={tool.launch_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        {tool.launch_url}
                                    </a>
                                    <div className="text-[11px] text-black/50 dark:text-white/50 mt-1 font-mono">
                                        tool_id: {tool.id}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => void toggleTool(tool)}
                                        className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                                        title={tool.enabled ? "Deshabilitar" : "Habilitar"}
                                    >
                                        {tool.enabled ? (
                                            <ToggleRight className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5 text-black/40 dark:text-white/40" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => void deleteTool(tool)}
                                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {!loading && tools.length === 0 && (
                            <div className="text-sm text-black/50 dark:text-white/50">No hay herramientas LTI registradas para este curso.</div>
                        )}
                    </div>
                </section>
            </div>
        </CourseEditorLayout>
    );
}
