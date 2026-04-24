"use client";

import { useEffect, useMemo, useState } from "react";
import { lmsApi, OfflineSyncStatus } from "@/lib/api";

const initialStatus: OfflineSyncStatus = {
    pending: 0,
    isFlushing: false,
    lastSyncAt: null,
    lastFlushedCount: 0,
    lastError: null,
};

export default function OfflineSyncPanel() {
    const [status, setStatus] = useState<OfflineSyncStatus>(initialStatus);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setStatus(lmsApi.getOfflineSyncStatus());
        const unsubscribe = lmsApi.subscribeOfflineSync((next) => setStatus(next));
        return unsubscribe;
    }, []);

    const lastSyncLabel = useMemo(() => {
        if (!status.lastSyncAt) return "Aun sin sincronizacion";
        const date = new Date(status.lastSyncAt);
        return date.toLocaleString();
    }, [status.lastSyncAt]);

    const shouldShow = status.pending > 0 || status.isFlushing || expanded;
    if (!shouldShow) return null;

    return (
        <section
            className="fixed bottom-6 left-6 z-[290] w-[min(360px,92vw)] rounded-2xl border border-slate-300/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-2xl"
            aria-label="Estado de sincronizacion offline"
        >
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 rounded-2xl"
                aria-expanded={expanded}
            >
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Sync Offline
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {status.isFlushing
                            ? "Sincronizando..."
                            : `${status.pending} pendiente${status.pending === 1 ? "" : "s"}`}
                    </p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                    {status.pending}
                </span>
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-3">
                        Ultimo sync: <span className="font-semibold">{lastSyncLabel}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                        Ultimo lote enviado: <span className="font-semibold">{status.lastFlushedCount}</span>
                    </p>
                    {status.lastError && status.lastError !== "offline" && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                            Quedaron eventos pendientes; se reintentara automaticamente.
                        </p>
                    )}
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => lmsApi.flushOfflineQueue()}
                            disabled={status.isFlushing}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                        >
                            {status.isFlushing ? "Sincronizando..." : "Sincronizar ahora"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setExpanded(false)}
                            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                        >
                            Ocultar
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}