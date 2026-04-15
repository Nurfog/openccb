"use client";

import { useEffect, useMemo, useState } from "react";
import {
    cmsApi,
    OrganizationEmailService,
    UpsertOrganizationEmailServicePayload,
} from "@/lib/api";

type EditableService = {
    id?: string;
    display_name: string;
    provider_key: string;
    is_enabled: boolean;
    is_default: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_from: string;
    smtp_username: string;
    smtp_starttls: boolean;
    has_password: boolean;
};

function toEditable(service: OrganizationEmailService): EditableService {
    return {
        id: service.id,
        display_name: service.display_name,
        provider_key: service.provider_key,
        is_enabled: service.is_enabled,
        is_default: service.is_default,
        smtp_host: service.smtp_host || "",
        smtp_port: service.smtp_port || 587,
        smtp_from: service.smtp_from || "",
        smtp_username: service.smtp_username || "",
        smtp_starttls: service.smtp_starttls,
        has_password: service.has_password,
    };
}

function newServiceTemplate(): EditableService {
    return {
        display_name: "Nuevo servicio SMTP",
        provider_key: "custom",
        is_enabled: true,
        is_default: false,
        smtp_host: "",
        smtp_port: 587,
        smtp_from: "",
        smtp_username: "",
        smtp_starttls: true,
        has_password: false,
    };
}

export default function EmailSettings() {
    const [services, setServices] = useState<OrganizationEmailService[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [form, setForm] = useState<EditableService>(newServiceTemplate());
    const [smtpPassword, setSmtpPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selectedService = useMemo(
        () => services.find((svc) => svc.id === selectedId),
        [services, selectedId],
    );

    const loadServices = async () => {
        const data = await cmsApi.listOrganizationEmailServices();
        setServices(data);
        const defaultService = data.find((svc) => svc.is_default) || data[0];
        if (defaultService) {
            setSelectedId(defaultService.id);
            setForm(toEditable(defaultService));
        } else {
            setSelectedId("");
            setForm(newServiceTemplate());
        }
    };

    useEffect(() => {
        const run = async () => {
            try {
                await loadServices();
            } catch (error) {
                console.error("Failed to load email services:", error);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, []);

    const setField = <K extends keyof EditableService>(key: K, value: EditableService[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSelect = async (id: string) => {
        try {
            await cmsApi.selectOrganizationEmailService(id);
            await loadServices();
            alert("Servicio por defecto actualizado.");
        } catch (error) {
            console.error("Failed to select email service:", error);
            alert("No se pudo seleccionar el servicio por defecto.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este servicio SMTP?")) return;

        try {
            await cmsApi.deleteOrganizationEmailService(id);
            await loadServices();
            setSmtpPassword("");
            alert("Servicio eliminado.");
        } catch (error) {
            console.error("Failed to delete email service:", error);
            alert("No se pudo eliminar el servicio.");
        }
    };

    const handleNew = () => {
        setSelectedId("");
        setForm(newServiceTemplate());
        setSmtpPassword("");
    };

    const toPayload = (): UpsertOrganizationEmailServicePayload => ({
        service_type: "smtp",
        provider_key: (form.provider_key || "custom").trim().toLowerCase(),
        display_name: form.display_name.trim() || "Servicio SMTP",
        is_enabled: form.is_enabled,
        is_default: form.is_default,
        smtp_host: form.smtp_host.trim() || undefined,
        smtp_port: Number(form.smtp_port) || 587,
        smtp_from: form.smtp_from.trim() || undefined,
        smtp_username: form.smtp_username.trim() || undefined,
        smtp_starttls: form.smtp_starttls,
        ...(smtpPassword.trim() ? { smtp_password: smtpPassword.trim() } : {}),
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = toPayload();
            if (form.id) {
                await cmsApi.updateOrganizationEmailService(form.id, payload);
            } else {
                await cmsApi.createOrganizationEmailService(payload);
            }
            await loadServices();
            setSmtpPassword("");
            alert("Servicio SMTP guardado correctamente.");
        } catch (error) {
            console.error("Failed to save email service:", error);
            alert("No se pudo guardar el servicio SMTP.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-400 animate-pulse">Cargando servicios de correo...</div>;
    }

    return (
        <fieldset className="border border-slate-200 dark:border-white/10 rounded-2xl p-6 bg-white dark:bg-white/5 backdrop-blur-sm shadow-sm">
            <legend className="px-2 text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <span aria-hidden="true">✉️</span> Servicios de Correo por Empresa
            </legend>

            <p className="text-sm text-slate-600 dark:text-gray-400 mt-4">
                Cada empresa puede registrar varios servicios de correo (SMTP) y seleccionar cuál usar como predeterminado.
                Si no hay registros, se crea uno automáticamente con valores de entorno.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((svc) => (
                    <div
                        key={svc.id}
                        className={`rounded-xl border p-4 ${svc.is_default ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20"}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{svc.display_name}</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                                    provider: {svc.provider_key} · {svc.is_enabled ? "Activo" : "Inactivo"}
                                </p>
                            </div>
                            {svc.is_default && (
                                <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-1 bg-emerald-600 text-white">
                                    Predeterminado
                                </span>
                            )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                onClick={() => {
                                    setSelectedId(svc.id);
                                    setForm(toEditable(svc));
                                    setSmtpPassword("");
                                }}
                            >
                                Editar
                            </button>
                            {!svc.is_default && (
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                    onClick={() => handleSelect(svc.id)}
                                >
                                    Usar este
                                </button>
                            )}
                            {!svc.is_default && services.length > 1 && (
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                    onClick={() => handleDelete(svc.id)}
                                >
                                    Eliminar
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-5 flex justify-end">
                <button
                    type="button"
                    onClick={handleNew}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                    Nuevo servicio
                </button>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50 dark:bg-black/20">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {form.id ? "Editar servicio" : "Crear servicio"}
                </h4>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block md:col-span-2">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Nombre del servicio</span>
                        <input
                            type="text"
                            value={form.display_name}
                            onChange={(e) => setField("display_name", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="block">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Provider</span>
                        <input
                            type="text"
                            value={form.provider_key}
                            onChange={(e) => setField("provider_key", e.target.value)}
                            placeholder="gmail, sendgrid, ses, mailpit..."
                            className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex items-center gap-3 mt-6">
                        <input
                            type="checkbox"
                            checked={form.is_enabled}
                            onChange={(e) => setField("is_enabled", e.target.checked)}
                        />
                        <span className="text-sm text-slate-800 dark:text-gray-200">Habilitado</span>
                    </label>

                    <label className="block">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Servidor SMTP</span>
                        <input
                            type="text"
                            value={form.smtp_host}
                            onChange={(e) => setField("smtp_host", e.target.value)}
                            placeholder="smtp.gmail.com"
                            className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="block">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Puerto</span>
                        <input
                            type="number"
                            min={1}
                            max={65535}
                            value={form.smtp_port}
                            onChange={(e) => setField("smtp_port", Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="block md:col-span-2">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Remitente</span>
                        <input
                            type="text"
                            value={form.smtp_from}
                            onChange={(e) => setField("smtp_from", e.target.value)}
                            placeholder="OpenCCB <no-reply@dominio.com>"
                            className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="block">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Usuario SMTP</span>
                        <input
                            type="text"
                            value={form.smtp_username}
                            onChange={(e) => setField("smtp_username", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="block">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">
                            Contraseña SMTP {form.has_password ? "(guardada)" : ""}
                        </span>
                        <input
                            type="password"
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                            placeholder={form.has_password ? "•••••••• (dejar vacío para mantener)" : "Nueva contraseña"}
                            className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={form.smtp_starttls}
                            onChange={(e) => setField("smtp_starttls", e.target.checked)}
                        />
                        <span className="text-sm text-slate-800 dark:text-gray-200">Usar STARTTLS</span>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={form.is_default}
                            onChange={(e) => setField("is_default", e.target.checked)}
                        />
                        <span className="text-sm text-slate-800 dark:text-gray-200">Marcar como predeterminado</span>
                    </label>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                        {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear servicio"}
                    </button>
                </div>
            </div>

            {selectedService && (
                <p className="mt-4 text-xs text-slate-500 dark:text-gray-400">
                    Editando: <strong>{selectedService.display_name}</strong>
                </p>
            )}
        </fieldset>
    );
}
