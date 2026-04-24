'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Database, Eye, RefreshCw, ShieldCheck } from 'lucide-react';
import { AiDataEthicsSummaryResponse, lmsApi } from '@/lib/api';

const RANGE_OPTIONS = [7, 30, 90] as const;

function formatNumber(value: number) {
    return new Intl.NumberFormat('es-ES').format(value);
}

function formatDate(value: string) {
    return new Date(value).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function AdminDataEthicsPage() {
    const [days, setDays] = useState<number>(30);
    const [data, setData] = useState<AiDataEthicsSummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async (nextDays = days) => {
        setLoading(true);
        try {
            const response = await lmsApi.getAiDataEthicsSummary(nextDays, 60);
            setData(response);
        } catch (err) {
            console.error('Error loading AI data ethics summary', err);
            alert('No se pudo cargar la transparencia de datos IA.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(30);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ragPercentage = useMemo(() => {
        if (!data || data.events.length === 0) return 0;
        const withRag = data.events.filter((e) => e.has_rag_context).length;
        return Math.round((withRag / data.events.length) * 100);
    }, [data]);

    return (
        <div className="space-y-6">
            <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-teal-600 p-2 text-white">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                Ética de Datos IA
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Transparencia de qué datos se usan en inferencia y por cuánto tiempo se retienen.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => loadData(days)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                        <RefreshCw size={16} /> Refrescar
                    </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Ventana
                    </span>
                    {RANGE_OPTIONS.map((option) => (
                        <button
                            key={option}
                            onClick={() => {
                                setDays(option);
                                loadData(option);
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                                option === days
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            {option} días
                        </button>
                    ))}
                </div>
            </header>

            {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                    Cargando resumen de transparencia...
                </div>
            ) : !data ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 dark:border-white/20 dark:bg-slate-900 dark:text-slate-300">
                    No hay datos disponibles.
                </div>
            ) : (
                <>
                    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Requests IA</p>
                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatNumber(data.summary.total_requests)}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tokens Totales</p>
                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatNumber(data.summary.total_tokens)}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Promedio / Request</p>
                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatNumber(data.summary.average_tokens_per_request)}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Con Contexto RAG</p>
                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{ragPercentage}%</p>
                        </article>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                            <Database size={16} /> Campos almacenados
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {data.summary.stored_fields.map((field) => (
                                <span
                                    key={field}
                                    className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                                >
                                    {field}
                                </span>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Retención objetivo actual: {data.summary.retention_days} días.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                            <Eye size={16} /> Eventos recientes
                        </div>
                        {data.events.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Sin eventos en la ventana seleccionada.</p>
                        ) : (
                            <div className="space-y-3">
                                {data.events.map((event) => (
                                    <article key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800">
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="rounded-full bg-teal-100 px-2 py-1 font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                                                <Brain size={12} className="mr-1 inline" /> {event.request_type}
                                            </span>
                                            <span className="text-slate-600 dark:text-slate-300">{event.endpoint}</span>
                                            <span className="text-slate-500 dark:text-slate-400">Modelo: {event.model}</span>
                                            <span className="text-slate-500 dark:text-slate-400">{formatDate(event.created_at)}</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                            <span className="rounded-md bg-slate-200 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                Tokens: {formatNumber(event.tokens_used)}
                                            </span>
                                            <span className="rounded-md bg-slate-200 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                In: {formatNumber(event.input_tokens)}
                                            </span>
                                            <span className="rounded-md bg-slate-200 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                Out: {formatNumber(event.output_tokens)}
                                            </span>
                                            <span className={`rounded-md px-2 py-1 font-semibold ${
                                                event.has_rag_context
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                            }`}>
                                                {event.has_rag_context ? 'Con RAG' : 'Sin RAG'}
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
