"use client";

import React, { useState, useEffect, useCallback } from "react";
import { lmsApi, OrgPlugin, CreatePluginPayload } from "@/lib/api";
import {
    Puzzle,
    Plus,
    Trash2,
    ToggleLeft,
    ToggleRight,
    ExternalLink,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Crear plugin
// ─────────────────────────────────────────────────────────────────────────────

function CreatePluginModal({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (p: OrgPlugin) => void;
}) {
    const [form, setForm] = useState<CreatePluginPayload>({
        name: "",
        description: "",
        component_url: "",
        icon_url: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.component_url.startsWith("https://")) {
            setError("La URL del componente debe comenzar con https://");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const plugin = await lmsApi.createPlugin({
                name: form.name,
                description: form.description || undefined,
                component_url: form.component_url,
                icon_url: form.icon_url || undefined,
            });
            onCreated(plugin);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error al crear plugin");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg border border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Puzzle className="w-5 h-5 text-indigo-500" />
                        Registrar Plugin
                    </h2>
                    <button onClick={onClose} className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Nombre *</label>
                        <input
                            required
                            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Mi Plugin Interactivo"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Descripción</label>
                        <input
                            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Descripción breve del plugin"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">URL del Web Component *</label>
                        <input
                            required
                            type="url"
                            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                            value={form.component_url}
                            onChange={e => setForm(f => ({ ...f, component_url: e.target.value }))}
                            placeholder="https://mi-plugin.ejemplo.com/component"
                        />
                        <p className="text-xs text-black/40 dark:text-white/40">Solo se permiten URLs HTTPS. El componente se cargará en un iframe sandboxed.</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">URL del Icono</label>
                        <input
                            type="url"
                            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                            value={form.icon_url}
                            onChange={e => setForm(f => ({ ...f, icon_url: e.target.value }))}
                            placeholder="https://…/icon.svg (opcional)"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
                            Registrar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de Plugin
// ─────────────────────────────────────────────────────────────────────────────

function PluginCard({
    plugin,
    onToggle,
    onDelete,
}: {
    plugin: OrgPlugin;
    onToggle: (id: string, enabled: boolean) => void;
    onDelete: (id: string) => void;
}) {
    const [deleting, setDeleting] = useState(false);
    const [toggling, setToggling] = useState(false);

    const handleToggle = async () => {
        setToggling(true);
        await onToggle(plugin.id, !plugin.enabled);
        setToggling(false);
    };

    const handleDelete = async () => {
        if (!confirm(`¿Eliminar el plugin "${plugin.name}"? Esta acción no se puede deshacer.`)) return;
        setDeleting(true);
        await onDelete(plugin.id);
        setDeleting(false);
    };

    return (
        <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${plugin.enabled ? "border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5" : "border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 opacity-60"}`}>
            {/* Icono */}
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                {plugin.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={plugin.icon_url} alt="" className="w-6 h-6 object-contain" />
                ) : (
                    <Puzzle className="w-5 h-5 text-indigo-500" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{plugin.name}</span>
                    {plugin.enabled ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Activo</span>
                    ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40">Inactivo</span>
                    )}
                </div>
                {plugin.description && (
                    <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">{plugin.description}</p>
                )}
                <a
                    href={plugin.component_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1 transition-colors font-mono truncate max-w-xs"
                >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {plugin.component_url}
                </a>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={() => void handleToggle()}
                    disabled={toggling}
                    title={plugin.enabled ? "Deshabilitar" : "Habilitar"}
                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                    {plugin.enabled
                        ? <ToggleRight className="w-5 h-5 text-green-500" />
                        : <ToggleLeft className="w-5 h-5 text-black/30 dark:text-white/30" />
                    }
                </button>
                <button
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    title="Eliminar"
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-black/30 dark:text-white/30 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function PluginsPage() {
    const [plugins, setPlugins] = useState<OrgPlugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await lmsApi.listPlugins();
            setPlugins(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al cargar plugins");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            const updated = await lmsApi.updatePlugin(id, { enabled });
            setPlugins(prev => prev.map(p => p.id === id ? updated : p));
        } catch {
            setError("Error al actualizar el plugin");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await lmsApi.deletePlugin(id);
            setPlugins(prev => prev.filter(p => p.id !== id));
        } catch {
            setError("Error al eliminar el plugin");
        }
    };

    const handleCreated = (plugin: OrgPlugin) => {
        setPlugins(prev => [...prev, plugin]);
        setShowModal(false);
    };

    const active = plugins.filter(p => p.enabled);
    const inactive = plugins.filter(p => !p.enabled);

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Puzzle className="w-6 h-6 text-indigo-500" />
                        Ecosistema de Plugins
                    </h1>
                    <p className="text-sm text-black/40 dark:text-white/40 mt-1">
                        Registra y gestiona Web Components externos que se muestran como bloques en las lecciones.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => void load()}
                        disabled={loading}
                        className="p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Registrar Plugin
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Vacío */}
            {!loading && plugins.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-black/30 dark:text-white/30">
                    <Puzzle className="w-12 h-12" />
                    <p className="text-sm text-center">Aún no hay plugins registrados.<br />Haz clic en <strong>Registrar Plugin</strong> para añadir el primero.</p>
                </div>
            )}

            {/* Plugins activos */}
            {active.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        Activos ({active.length})
                    </h2>
                    {active.map(p => (
                        <PluginCard
                            key={p.id}
                            plugin={p}
                            onToggle={(id, en) => void handleToggle(id, en)}
                            onDelete={(id) => void handleDelete(id)}
                        />
                    ))}
                </div>
            )}

            {/* Plugins inactivos */}
            {inactive.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                        Inactivos ({inactive.length})
                    </h2>
                    {inactive.map(p => (
                        <PluginCard
                            key={p.id}
                            plugin={p}
                            onToggle={(id, en) => void handleToggle(id, en)}
                            onDelete={(id) => void handleDelete(id)}
                        />
                    ))}
                </div>
            )}

            {/* Info */}
            <div className="rounded-xl border border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 p-4 text-xs text-black/40 dark:text-white/40 space-y-1">
                <p className="font-semibold text-black/50 dark:text-white/50">¿Cómo funciona?</p>
                <p>1. Registra la URL HTTPS del Web Component externo.</p>
                <p>2. En el Editor de Lecciones añade un bloque de tipo <code className="font-mono bg-black/5 dark:bg-white/5 px-1 rounded">plugin</code> y selecciona el plugin.</p>
                <p>3. El componente se carga en un <code className="font-mono bg-black/5 dark:bg-white/5 px-1 rounded">iframe sandbox</code> — los scripts externos nunca acceden al DOM de OpenCCB.</p>
            </div>

            {showModal && (
                <CreatePluginModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
            )}
        </div>
    );
}
