"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
    lmsApi,
    CourseQualityMetrics,
    CourseDiscriminationReport,
    CurricularSuggestionsReport,
    CurricularSuggestion,
    LessonQualityMetric,
    QuizDiscriminationItem,
} from "@/lib/api";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import {
    BarChart3,
    TrendingDown,
    TrendingUp,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    Info,
    Star,
    RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────────────────────

function pct(v: number) {
    return `${(v * 100).toFixed(1)}%`;
}

function discriminationLabel(d: number): { label: string; color: string } {
    if (d >= 0.4) return { label: "Excelente", color: "text-green-600 dark:text-green-400" };
    if (d >= 0.3) return { label: "Buena", color: "text-blue-600 dark:text-blue-400" };
    if (d >= 0.2) return { label: "Aceptable", color: "text-yellow-600 dark:text-yellow-400" };
    return { label: "Revisar", color: "text-red-600 dark:text-red-400" };
}

function severityIcon(severity: string) {
    switch (severity) {
        case "high": return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
        case "medium": return <Info className="w-4 h-4 text-yellow-500 shrink-0" />;
        case "positive": return <Star className="w-4 h-4 text-green-500 shrink-0" />;
        default: return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
}

function severityBadge(severity: string) {
    const map: Record<string, string> = {
        high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
        medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
        info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        positive: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    };
    const labels: Record<string, string> = {
        high: "Alta prioridad",
        medium: "Atención",
        info: "Información",
        positive: "Destacado",
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[severity] ?? map.info}`}>
            {labels[severity] ?? severity}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Barra horizontal proporcional
// ─────────────────────────────────────────────────────────────────────────────

function Bar({ value, max = 1, colorClass = "bg-indigo-500" }: { value: number; max?: number; colorClass?: string }) {
    const pctVal = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pctVal}%` }} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "quality" | "discrimination" | "suggestions";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "quality", label: "Métricas de Calidad", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "discrimination", label: "Índice de Discriminación", icon: <TrendingDown className="w-4 h-4" /> },
    { id: "suggestions", label: "Sugerencias Curriculares", icon: <Lightbulb className="w-4 h-4" /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sección: Métricas de Calidad
// ─────────────────────────────────────────────────────────────────────────────

function QualityPanel({ data }: { data: CourseQualityMetrics }) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-black/50 dark:text-white/50">
                {data.enrolled} alumno{data.enrolled !== 1 ? "s" : ""} inscrito{data.enrolled !== 1 ? "s" : ""} · {data.lessons.length} lección{data.lessons.length !== 1 ? "es" : ""}
            </p>

            {data.lessons.length === 0 && (
                <p className="text-sm text-black/40 dark:text-white/40 italic">Sin datos de entregas todavía.</p>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-y-1">
                    <thead>
                        <tr className="text-left text-xs text-black/40 dark:text-white/40 uppercase tracking-wider">
                            <th className="pb-2 pr-4">#</th>
                            <th className="pb-2 pr-4">Lección</th>
                            <th className="pb-2 pr-4">Completitud</th>
                            <th className="pb-2 pr-4">Puntaje Medio</th>
                            <th className="pb-2 pr-4">Fallo</th>
                            <th className="pb-2 pr-4">Intentos Prom.</th>
                            <th className="pb-2">Sin entregar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.lessons.map((l: LessonQualityMetric) => (
                            <tr key={l.lesson_id} className="bg-white/50 dark:bg-white/5 rounded-lg">
                                <td className="py-3 px-3 rounded-l-lg text-black/30 dark:text-white/30 w-8">{l.position}</td>
                                <td className="py-3 pr-4 font-medium max-w-[200px] truncate" title={l.lesson_title}>{l.lesson_title}</td>
                                <td className="py-3 pr-4">
                                    <div className="space-y-1">
                                        <span className="font-mono">{pct(l.completion_rate)}</span>
                                        <Bar value={l.completion_rate} colorClass={l.completion_rate < 0.4 ? "bg-red-400" : "bg-indigo-500"} />
                                    </div>
                                </td>
                                <td className="py-3 pr-4">
                                    <div className="space-y-1">
                                        <span className="font-mono">{pct(l.avg_score)}</span>
                                        <Bar value={l.avg_score} colorClass={l.avg_score < 0.5 ? "bg-orange-400" : l.avg_score > 0.9 ? "bg-green-400" : "bg-sky-500"} />
                                    </div>
                                </td>
                                <td className="py-3 pr-4 font-mono">
                                    <span className={l.failure_rate > 0.4 ? "text-red-500 font-semibold" : ""}>{pct(l.failure_rate)}</span>
                                </td>
                                <td className="py-3 pr-4 font-mono">{l.avg_attempts.toFixed(1)}</td>
                                <td className="py-3 px-3 rounded-r-lg font-mono">
                                    <span className={l.abandonment_count > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-black/30 dark:text-white/30"}>{l.abandonment_count}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección: Índice de Discriminación
// ─────────────────────────────────────────────────────────────────────────────

function DiscriminationPanel({ data }: { data: CourseDiscriminationReport }) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-black/50 dark:text-white/50">
                El índice mide si los alumnos con mejor rendimiento global aciertan más esta pregunta. Un índice ≥ 0.4 es excelente.
            </p>

            {data.items.length === 0 && (
                <p className="text-sm text-black/40 dark:text-white/40 italic">
                    No hay datos de <code>block_scores</code> en los metadatos de entregas todavía.
                </p>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-y-1">
                    <thead>
                        <tr className="text-left text-xs text-black/40 dark:text-white/40 uppercase tracking-wider">
                            <th className="pb-2 pr-4">Lección</th>
                            <th className="pb-2 pr-4">Bloque</th>
                            <th className="pb-2 pr-4">Índice Discriminación</th>
                            <th className="pb-2 pr-4">Facilidad</th>
                            <th className="pb-2">Muestra</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item: QuizDiscriminationItem) => {
                            const { label, color } = discriminationLabel(item.discrimination_index);
                            return (
                                <tr key={`${item.lesson_id}-${item.block_id}`} className="bg-white/50 dark:bg-white/5 rounded-lg">
                                    <td className="py-3 px-3 rounded-l-lg font-medium max-w-[180px] truncate" title={item.lesson_title}>{item.lesson_title}</td>
                                    <td className="py-3 pr-4 font-mono text-xs text-black/50 dark:text-white/50 max-w-[120px] truncate">{item.block_id}</td>
                                    <td className="py-3 pr-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono">{item.discrimination_index.toFixed(2)}</span>
                                                <span className={`text-xs font-semibold ${color}`}>{label}</span>
                                            </div>
                                            <Bar value={item.discrimination_index} max={1} colorClass={item.discrimination_index >= 0.3 ? "bg-green-500" : item.discrimination_index >= 0.2 ? "bg-yellow-400" : "bg-red-400"} />
                                        </div>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <div className="space-y-1">
                                            <span className="font-mono">{pct(item.facility_index)}</span>
                                            <Bar value={item.facility_index} colorClass="bg-sky-500" />
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 rounded-r-lg font-mono text-black/40 dark:text-white/40">{item.sample_size}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección: Sugerencias Curriculares
// ─────────────────────────────────────────────────────────────────────────────

function SuggestionsPanel({ data }: { data: CurricularSuggestionsReport }) {
    if (data.suggestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-black/30 dark:text-white/30">
                <CheckCircle2 className="w-10 h-10" />
                <p className="text-sm">No hay sugerencias en este momento. El curso tiene métricas saludables o aún pocos datos.</p>
            </div>
        );
    }

    const high = data.suggestions.filter(s => s.severity === "high");
    const medium = data.suggestions.filter(s => s.severity === "medium");
    const others = data.suggestions.filter(s => s.severity !== "high" && s.severity !== "medium");

    const groups = [
        { label: "Alta prioridad", items: high },
        { label: "Atención", items: medium },
        { label: "Otras observaciones", items: others },
    ].filter(g => g.items.length > 0);

    return (
        <div className="space-y-6">
            {groups.map(group => (
                <div key={group.label} className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{group.label}</h3>
                    {group.items.map((s: CurricularSuggestion, i: number) => (
                        <div key={i} className="flex gap-3 p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                            {severityIcon(s.severity)}
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium truncate">{s.lesson_title}</span>
                                    {severityBadge(s.severity)}
                                </div>
                                <p className="text-sm text-black/60 dark:text-white/60">{s.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function PedagogicalAnalyticsPage() {
    const { id } = useParams() as { id: string };

    const [activeTab, setActiveTab] = useState<Tab>("quality");
    const [quality, setQuality] = useState<CourseQualityMetrics | null>(null);
    const [discrimination, setDiscrimination] = useState<CourseDiscriminationReport | null>(null);
    const [suggestions, setSuggestions] = useState<CurricularSuggestionsReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [q, d, s] = await Promise.all([
                lmsApi.getCourseQualityMetrics(id),
                lmsApi.getCourseDiscriminationIndex(id),
                lmsApi.getCourseSuggestions(id),
            ]);
            setQuality(q);
            setDiscrimination(d);
            setSuggestions(s);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al cargar análisis pedagógico");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { void load(); }, [load]);

    return (
        <CourseEditorLayout activeTab="pedagogical">
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-indigo-500" />
                            Análisis Pedagógico Profundo
                        </h1>
                        <p className="text-sm text-black/40 dark:text-white/40 mt-1">
                            Métricas de calidad, índice de discriminación y sugerencias de mejora curricular.
                        </p>
                    </div>
                    <button
                        onClick={() => void load()}
                        disabled={loading}
                        className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Actualizar
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? "bg-white dark:bg-white/10 shadow-sm text-indigo-600 dark:text-indigo-400"
                                    : "text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/5 p-6">
                    {loading && (
                        <div className="flex items-center justify-center py-20 text-black/30 dark:text-white/30">
                            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                            Cargando análisis...
                        </div>
                    )}

                    {!loading && activeTab === "quality" && quality && (
                        <QualityPanel data={quality} />
                    )}
                    {!loading && activeTab === "discrimination" && discrimination && (
                        <DiscriminationPanel data={discrimination} />
                    )}
                    {!loading && activeTab === "suggestions" && suggestions && (
                        <SuggestionsPanel data={suggestions} />
                    )}
                </div>
            </div>
        </CourseEditorLayout>
    );
}
