"use client";

import { useEffect, useMemo, useState } from "react";
import {
    cmsApi,
    OrganizationEmailTemplate,
    UpsertOrganizationEmailTemplatePayload,
} from "@/lib/api";

type EditableTemplate = {
    id?: string;
    template_key: string;
    display_name: string;
    subject_template: string;
    body_template: string;
    is_html: boolean;
    is_enabled: boolean;
};

function toEditable(template: OrganizationEmailTemplate): EditableTemplate {
    return {
        id: template.id,
        template_key: template.template_key,
        display_name: template.display_name,
        subject_template: template.subject_template,
        body_template: template.body_template,
        is_html: template.is_html,
        is_enabled: template.is_enabled,
    };
}

function newTemplateTemplate(): EditableTemplate {
    return {
        template_key: "",
        display_name: "Nueva plantilla",
        subject_template: "",
        body_template: "",
        is_html: false,
        is_enabled: true,
    };
}

export default function EmailTemplates() {
    const [templates, setTemplates] = useState<OrganizationEmailTemplate[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [form, setForm] = useState<EditableTemplate>(newTemplateTemplate());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selectedTemplate = useMemo(
        () => templates.find((t) => t.id === selectedId),
        [templates, selectedId],
    );

    const loadTemplates = async () => {
        const data = await cmsApi.listOrganizationEmailTemplates();
        setTemplates(data);
        if (data.length > 0 && !selectedId) {
            setSelectedId(data[0].id);
            setForm(toEditable(data[0]));
        }
    };

    useEffect(() => {
        const run = async () => {
            try {
                await loadTemplates();
            } catch (error) {
                console.error("Failed to load email templates:", error);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, []);

    const setField = <K extends keyof EditableTemplate>(key: K, value: EditableTemplate[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSelect = (id: string) => {
        const template = templates.find((t) => t.id === id);
        if (template) {
            setSelectedId(id);
            setForm(toEditable(template));
        }
    };

    const handleNew = () => {
        setSelectedId("");
        setForm(newTemplateTemplate());
    };

    const toPayload = (): UpsertOrganizationEmailTemplatePayload => ({
        template_key: form.template_key.trim(),
        display_name: form.display_name.trim(),
        subject_template: form.subject_template.trim(),
        body_template: form.body_template.trim(),
        is_html: form.is_html,
        is_enabled: form.is_enabled,
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = toPayload();
            if (form.id) {
                await cmsApi.updateOrganizationEmailTemplate(form.id, payload);
            } else {
                await cmsApi.createOrganizationEmailTemplate(payload);
            }
            await loadTemplates();
            alert("Plantilla guardada correctamente.");
        } catch (error) {
            console.error("Failed to save email template:", error);
            alert("No se pudo guardar la plantilla.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta plantilla?")) return;

        try {
            await cmsApi.deleteOrganizationEmailTemplate(id);
            await loadTemplates();
            if (selectedId === id) {
                setSelectedId("");
                setForm(newTemplateTemplate());
            }
            alert("Plantilla eliminada.");
        } catch (error) {
            console.error("Failed to delete email template:", error);
            alert("No se pudo eliminar la plantilla.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-400 animate-pulse">Cargando plantillas de correo...</div>;
    }

    return (
        <fieldset className="border border-slate-200 dark:border-white/10 rounded-2xl p-6 bg-white dark:bg-white/5 backdrop-blur-sm shadow-sm">
            <legend className="px-2 text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <span aria-hidden="true">📧</span> Plantillas de Correo Personalizadas
            </legend>

            <p className="text-sm text-slate-600 dark:text-gray-400 mt-4">
                Crea y personaliza plantillas de email para diferentes eventos del sistema.
                Usa variables como {"{{recipient_name}}"}, {"{{organization_name}}"}, etc.
            </p>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lista de plantillas */}
                <div className="lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Plantillas</h3>
                        <button
                            onClick={handleNew}
                            className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                            Nueva
                        </button>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                onClick={() => handleSelect(template.id)}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                    selectedId === template.id
                                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                                        : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20 hover:border-slate-300"
                                }`}
                            >
                                <h4 className="font-medium text-slate-900 dark:text-white">{template.display_name}</h4>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                                    {template.template_key} · {template.is_enabled ? "Activa" : "Inactiva"}
                                </p>
                            </div>
                        ))}
                        {templates.length === 0 && (
                            <div className="p-4 text-center text-slate-500 dark:text-gray-400">
                                No hay plantillas. Crea una nueva.
                            </div>
                        )}
                    </div>
                </div>

                {/* Formulario de edición */}
                <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        {form.id ? "Editar Plantilla" : "Nueva Plantilla"}
                    </h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="block">
                                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">
                                    Clave de plantilla
                                </span>
                                <input
                                    type="text"
                                    value={form.template_key}
                                    onChange={(e) => setField("template_key", e.target.value)}
                                    placeholder="forum_reply, welcome_student, etc."
                                    className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                />
                            </label>

                            <label className="block">
                                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">
                                    Nombre para mostrar
                                </span>
                                <input
                                    type="text"
                                    value={form.display_name}
                                    onChange={(e) => setField("display_name", e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">
                                Asunto
                            </span>
                            <input
                                type="text"
                                value={form.subject_template}
                                onChange={(e) => setField("subject_template", e.target.value)}
                                placeholder="Ej: Nueva respuesta en {{thread_title}}"
                                className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                            />
                        </label>

                        <label className="block">
                            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">
                                Cuerpo del mensaje
                            </span>
                            <textarea
                                value={form.body_template}
                                onChange={(e) => setField("body_template", e.target.value)}
                                rows={12}
                                placeholder="Usa variables como {{recipient_name}}, {{organization_name}}, etc."
                                className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm font-mono"
                            />
                        </label>

                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={form.is_enabled}
                                    onChange={(e) => setField("is_enabled", e.target.checked)}
                                />
                                <span className="text-sm text-slate-800 dark:text-gray-200">Habilitada</span>
                            </label>

                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={form.is_html}
                                    onChange={(e) => setField("is_html", e.target.checked)}
                                />
                                <span className="text-sm text-slate-800 dark:text-gray-200">HTML</span>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium"
                            >
                                {saving ? "Guardando..." : "Guardar"}
                            </button>

                            {form.id && (
                                <button
                                    onClick={() => handleDelete(form.id!)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                                >
                                    Eliminar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </fieldset>
    );
}