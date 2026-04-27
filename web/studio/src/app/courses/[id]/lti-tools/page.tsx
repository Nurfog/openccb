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
    KeyRound,
    Copy,
    CheckCheck,
    ChevronDown,
    ChevronRight,
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
    const [showAgs, setShowAgs] = useState(false);

    // Rotación de secreto
    const [rotateModal, setRotateModal] = useState<{ toolId: string; toolName: string } | null>(null);
    const [rotatingId, setRotatingId] = useState<string | null>(null);
    const [newSecret, setNewSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

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
            setShowAgs(false);
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

    const confirmRotate = async () => {
        if (!rotateModal) return;
        setRotatingId(rotateModal.toolId);
        setNewSecret(null);
        setCopied(false);
        try {
            const result = await lmsApi.rotateCourseLtiToolSecret(id, rotateModal.toolId);
            setNewSecret(result.new_secret);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo rotar el secreto");
            setRotateModal(null);
        } finally {
            setRotatingId(null);
        }
    };

    const closeRotateModal = () => {
        setRotateModal(null);
        setNewSecret(null);
        setCopied(false);
    };

    const copySecret = () => {
        if (!newSecret) return;
        void navigator.clipboard.writeText(newSecret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <CourseEditorLayout activeTab="lti-tools" pageTitle="Herramientas LTI" pageDescription="Configura laboratorios externos y su passback de notas.">
            {/* Modal de rotación de secreto */}
            {rotateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-4">
                        <h2 className="text-sm font-black flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-amber-600" />
                            Rotar secreto — {rotateModal.toolName}
                        </h2>

                        {!newSecret ? (
                            <>
                                <p className="text-xs text-black/60 dark:text-white/60">
                                    Se generará un nuevo secreto aleatorio de 32 caracteres. El secreto actual dejará de funcionar inmediatamente. <strong>Actualiza tu herramienta LTI antes de confirmar.</strong>
                                </p>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={closeRotateModal}
                                        className="px-4 py-2 rounded-lg text-sm border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => void confirmRotate()}
                                        disabled={rotatingId !== null}
                                        className="px-4 py-2 rounded-lg text-sm bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50"
                                    >
                                        {rotatingId ? "Rotando..." : "Confirmar rotación"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-4 space-y-2">
                                    <p className="text-xs font-black text-green-800 dark:text-green-300">¡Secreto rotado exitosamente!</p>
                                    <p className="text-[11px] text-green-700 dark:text-green-400">
                                        Copia este secreto ahora. <strong>No se volverá a mostrar.</strong>
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <code className="flex-1 rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10 px-3 py-2 text-xs font-mono break-all">
                                            {newSecret}
                                        </code>
                                        <button
                                            onClick={copySecret}
                                            className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                                            title="Copiar"
                                        >
                                            {copied ? (
                                                <CheckCheck className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={closeRotateModal}
                                        className="px-4 py-2 rounded-lg text-sm bg-black text-white dark:bg-white dark:text-black font-semibold"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
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
                    {/* Configuración AGS (OAuth2) — colapsable */}
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={() => setShowAgs((v) => !v)}
                            className="flex items-center gap-1 text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                        >
                            {showAgs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            Configuración AGS / OAuth2 (opcional)
                        </button>
                        {showAgs && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                                <p className="md:col-span-2 text-xs text-blue-700 dark:text-blue-300">
                                    LTI AGS (Assignment and Grade Services) — permite passback de notas sin HMAC, usando OAuth2 client_credentials. Endpoint: <span className="font-mono">/lti/tools/{'{tool_id}'}/ags-score</span>
                                </p>
                                <input
                                    className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                                    placeholder="AGS Client ID"
                                    value={form.ags_client_id ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, ags_client_id: e.target.value || undefined }))}
                                />
                                <input
                                    type="password"
                                    className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                                    placeholder="AGS Client Secret"
                                    value={form.ags_client_secret ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, ags_client_secret: e.target.value || undefined }))}
                                />
                                <input
                                    className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                                    placeholder="Token URL (https://lms.example/oauth/token)"
                                    value={form.ags_token_url ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, ags_token_url: e.target.value || undefined }))}
                                />
                                <input
                                    className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                                    placeholder="LineItem URL (https://lms.example/lineitems/123)"
                                    value={form.ags_lineitem_url ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, ags_lineitem_url: e.target.value || undefined }))}
                                />
                            </div>
                        )}
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
                            Passback HMAC: <span className="font-mono">/lti/tools/{'{tool_id}'}/grade-passback</span>. Passback AGS: <span className="font-mono">/lti/tools/{'{tool_id}'}/ags-score</span>.
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
                                        onClick={() => setRotateModal({ toolId: tool.id, toolName: tool.name })}
                                        className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                        title="Rotar secreto"
                                    >
                                        <KeyRound className="w-4 h-4 text-amber-600" />
                                    </button>
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
