"use client";

import { useEffect, useState } from "react";
import { cmsApi, OrganizationExerciseSettings } from "@/lib/api";

const featureCards: Array<{
    key: keyof Omit<OrganizationExerciseSettings, "organization_id">;
    title: string;
    description: string;
}> = [
    {
        key: "audio_response_enabled",
        title: "Audio Response",
        description: "Permite ejercicios donde el alumno responde grabando audio.",
    },
    {
        key: "hotspot_enabled",
        title: "Hotspot",
        description: "Permite actividades visuales con puntos interactivos sobre imágenes.",
    },
    {
        key: "memory_match_enabled",
        title: "Memory Match",
        description: "Permite juegos de memoria y emparejamiento visual.",
    },
    {
        key: "peer_review_enabled",
        title: "Peer Review",
        description: "Permite actividades donde estudiantes revisan entregas de otros.",
    },
    {
        key: "role_playing_enabled",
        title: "Role Playing",
        description: "Permite simulaciones de conversación con IA.",
    },
    {
        key: "mermaid_enabled",
        title: "Mermaid Diagram",
        description: "Permite diagramas Mermaid y su generación asistida.",
    },
    {
        key: "code_lab_enabled",
        title: "Code Lab",
        description: "Permite laboratorios de código generados o editados manualmente.",
    },
    {
        key: "certificates_enabled",
        title: "Generación de Certificados",
        description: "Habilita la emisión automática de certificados al completar cursos.",
    },
];

const defaultSettings: OrganizationExerciseSettings = {
    organization_id: "",
    audio_response_enabled: true,
    hotspot_enabled: true,
    memory_match_enabled: true,
    peer_review_enabled: true,
    role_playing_enabled: true,
    mermaid_enabled: false,
    code_lab_enabled: true,
    certificates_enabled: true,
};

export default function ExerciseFeatureSettings() {
    const [settings, setSettings] = useState<OrganizationExerciseSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await cmsApi.getOrganizationExerciseSettings();
                setSettings(data);
            } catch (error) {
                console.error("Failed to load exercise settings:", error);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, []);

    const toggleFeature = (key: keyof Omit<OrganizationExerciseSettings, "organization_id">) => {
        setSettings((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                audio_response_enabled: settings.audio_response_enabled,
                hotspot_enabled: settings.hotspot_enabled,
                memory_match_enabled: settings.memory_match_enabled,
                peer_review_enabled: settings.peer_review_enabled,
                role_playing_enabled: settings.role_playing_enabled,
                mermaid_enabled: settings.mermaid_enabled,
                code_lab_enabled: settings.code_lab_enabled,
                certificates_enabled: settings.certificates_enabled,
            };
            const updated = await cmsApi.updateOrganizationExerciseSettings(payload);
            setSettings(updated);
            alert("Disponibilidad de ejercicios actualizada correctamente.");
        } catch (error) {
            console.error("Failed to update exercise settings:", error);
            alert("No se pudo guardar la disponibilidad de ejercicios.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-400 animate-pulse">Cargando disponibilidad de ejercicios...</div>;
    }

    return (
        <fieldset className="border border-slate-200 dark:border-white/10 rounded-2xl p-6 bg-white dark:bg-white/5 backdrop-blur-sm shadow-sm">
            <legend className="px-2 text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <span aria-hidden="true">🧩</span> Ejercicios Disponibles
            </legend>

            <div className="space-y-3 mt-4">
                <p className="text-sm text-slate-600 dark:text-gray-400">
                    Activa o desactiva por organización qué tipos de ejercicios pueden usarse en el constructor de lecciones y en sus generadores asociados.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {featureCards.map((feature) => {
                    const enabled = settings[feature.key];
                    return (
                        <button
                            key={feature.key}
                            type="button"
                            onClick={() => toggleFeature(feature.key)}
                            className={`rounded-xl border p-4 text-left transition-all ${
                                enabled
                                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                                    : "bg-slate-50 border-slate-200 dark:bg-black/20 dark:border-white/10"
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{feature.title}</h3>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{feature.description}</p>
                                </div>
                                <div className={`h-7 w-12 rounded-full p-1 transition-all ${enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}>
                                    <div className={`h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                                </div>
                            </div>
                            <div className="mt-3 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400">
                                {enabled ? "Activo" : "Inactivo"}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex justify-end mt-8">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                    {saving ? "Guardando..." : "Guardar disponibilidad"}
                </button>
            </div>
        </fieldset>
    );
}
