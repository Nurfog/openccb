'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BrainCircuit, Calendar, CheckCircle2, Filter, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { AiAuditItem, lmsApi } from '@/lib/api';

type ReviewFilter = 'all' | 'pending' | 'reviewed';

// Todas las señales que el backend puede emitir
const ALL_SIGNALS = [
    'missing_rag_context',
    'high_output_tokens',
    'long_response',
    'absolute_claim_language',
    'citation_without_rag',
] as const;

type RiskSignal = (typeof ALL_SIGNALS)[number];

function formatSignal(signal: string) {
    return signal
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function todayMinus(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

export default function AdminAiAuditPage() {
    const [items, setItems] = useState<AiAuditItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    // Filtros de estado
    const [filter, setFilter] = useState<ReviewFilter>('pending');

    // Filtros avanzados (aplicados en cliente)
    const [signalFilter, setSignalFilter] = useState<RiskSignal | ''>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [minRisk, setMinRisk] = useState<number>(1);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const loadData = async (nextFilter: ReviewFilter = filter) => {
        setLoading(true);
        try {
            const reviewed = nextFilter === 'all' ? undefined : nextFilter === 'reviewed';
            const response = await lmsApi.getAiAuditLogs(reviewed, 200, 0);
            setItems(response.items);
        } catch (err) {
            console.error('Error loading AI audit logs', err);
            alert('No se pudieron cargar los casos de auditoría IA.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const markReview = async (item: AiAuditItem, reviewed: boolean) => {
        setWorkingId(item.id);
        try {
            await lmsApi.reviewAiAuditLog(item.id, {
                reviewed,
                reviewer_note: notes[item.id]?.trim() || undefined,
            });
            await loadData();
        } catch (err) {
            console.error('Error updating AI audit review', err);
            alert('No se pudo actualizar el estado de revisión.');
        } finally {
            setWorkingId(null);
        }
    };

    const resetAdvancedFilters = () => {
        setSignalFilter('');
        setDateFrom('');
        setDateTo('');
        setMinRisk(1);
    };

    const filtered = useMemo(() => {
        return items.filter((item) => {
            if (signalFilter && !item.risk_signals.includes(signalFilter)) return false;
            if (item.risk_score < minRisk) return false;
            if (dateFrom && item.created_at < dateFrom) return false;
            if (dateTo && item.created_at > dateTo + 'T23:59:59Z') return false;
            return true;
        });
    }, [items, signalFilter, minRisk, dateFrom, dateTo]);

    const pendingCount = useMemo(() => filtered.filter((i) => !i.reviewed).length, [filtered]);
    const reviewedCount = useMemo(() => filtered.filter((i) => i.reviewed).length, [filtered]);
    const activeFilterCount = [signalFilter, dateFrom, dateTo, minRisk > 1].filter(Boolean).length;

    return (
        <div className="space-y-6">
            <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-indigo-600 p-2 text-white">
                            <BrainCircuit size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Auditoría IA</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Detección temprana de posibles alucinaciones en respuestas del tutor.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFiltersOpen((o) => !o)}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                filtersOpen || activeFilterCount > 0
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-300'
                                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10'
                            }`}
                        >
                            <Filter size={16} />
                            Filtros
                            {activeFilterCount > 0 && (
                                <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => loadData()}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                            <RefreshCw size={16} /> Refrescar
                        </button>
                    </div>
                </div>

                {/* Panel de filtros avanzados */}
                {filtersOpen && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Filtros avanzados
                            </span>
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={resetAdvancedFilters}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
                                >
                                    <X size={13} /> Limpiar filtros
                                </button>
                            )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Señal de riesgo */}
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Señal de riesgo
                                </label>
                                <select
                                    value={signalFilter}
                                    onChange={(e) => setSignalFilter(e.target.value as RiskSignal | '')}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-700"
                                >
                                    <option value="">Todas</option>
                                    {ALL_SIGNALS.map((s) => (
                                        <option key={s} value={s}>{formatSignal(s)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Score mínimo */}
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Riesgo mínimo: <strong>{minRisk}</strong>
                                </label>
                                <input
                                    type="range"
                                    min={1}
                                    max={5}
                                    value={minRisk}
                                    onChange={(e) => setMinRisk(Number(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>1</span><span>5</span>
                                </div>
                            </div>

                            {/* Fecha desde */}
                            <div>
                                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    <Calendar size={12} /> Desde
                                </label>
                                <div className="relative flex items-center gap-1">
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        max={dateTo || todayMinus(0)}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-700"
                                    />
                                    {dateFrom && (
                                        <button onClick={() => setDateFrom('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-1 flex gap-1">
                                    {[7, 30, 90].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDateFrom(todayMinus(d))}
                                            className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-slate-600 dark:text-slate-300"
                                        >
                                            -{d}d
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fecha hasta */}
                            <div>
                                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    <Calendar size={12} /> Hasta
                                </label>
                                <div className="relative flex items-center gap-1">
                                    <input
                                        type="date"
                                        value={dateTo}
                                        min={dateFrom || undefined}
                                        max={todayMinus(0)}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-700"
                                    />
                                    {dateTo && (
                                        <button onClick={() => setDateTo('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-1 flex gap-1">
                                    <button
                                        onClick={() => setDateTo(todayMinus(0))}
                                        className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-slate-600 dark:text-slate-300"
                                    >
                                        Hoy
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <AlertCircle size={14} /> Pendientes: {pendingCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 size={14} /> Revisados: {reviewedCount}
                    </span>
                    {activeFilterCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            <Filter size={12} /> Mostrando {filtered.length} de {items.length}
                        </span>
                    )}

                    <select
                        value={filter}
                        onChange={(e) => {
                            const next = e.target.value as ReviewFilter;
                            setFilter(next);
                            loadData(next);
                        }}
                        className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-800"
                    >
                        <option value="pending">Pendientes</option>
                        <option value="reviewed">Revisados</option>
                        <option value="all">Todos</option>
                    </select>
                </div>
            </header>

            {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                    Cargando casos de auditoría...
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 dark:border-white/20 dark:bg-slate-900 dark:text-slate-300">
                    {items.length === 0
                        ? 'No hay casos de riesgo con el filtro de estado actual.'
                        : `Los filtros avanzados no arrojaron resultados. ${items.length} caso(s) excluidos.`}
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((item) => {
                        const isWorking = workingId === item.id;
                        const noteValue = notes[item.id] ?? item.reviewer_note ?? '';

                        return (
                            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-full bg-slate-100 px-2 py-1 font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        Riesgo: {item.risk_score}
                                    </span>
                                    <span className={`rounded-full px-2 py-1 font-bold uppercase tracking-wide ${
                                        item.reviewed
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    }`}>
                                        {item.reviewed ? 'Revisado' : 'Pendiente'}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Alumno: {item.student_name || 'N/D'}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Modelo: {item.model}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Tokens salida: {item.output_tokens}
                                    </span>
                                </div>

                                <div className="mb-3 flex flex-wrap gap-2">
                                    {item.risk_signals.map((signal) => (
                                        <span
                                            key={signal}
                                            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/30 dark:text-rose-300"
                                        >
                                            {formatSignal(signal)}
                                        </span>
                                    ))}
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                                    {item.response_excerpt || 'Sin extracto de respuesta'}
                                </div>

                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <input
                                        value={noteValue}
                                        onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-800"
                                        placeholder="Nota del revisor"
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => markReview(item, true)}
                                            disabled={isWorking}
                                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={15} /> Marcar revisado
                                        </button>
                                        <button
                                            onClick={() => markReview(item, false)}
                                            disabled={isWorking}
                                            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/40 dark:text-amber-300 dark:hover:bg-amber-900/20"
                                        >
                                            <ShieldAlert size={15} /> Dejar pendiente
                                        </button>
                                    </div>
                                </div>

                                {item.reviewed && item.reviewed_by_name && (
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Revisado por: {item.reviewed_by_name}
                                    </p>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
