"use client";

import React from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";

interface LtiToolPlayerProps {
    title: string;
    launchUrl: string;
}

export default function LtiToolPlayer({ title, launchUrl }: LtiToolPlayerProps) {
    if (!launchUrl || !launchUrl.startsWith("https://")) {
        return (
            <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
                La herramienta LTI no tiene una URL segura (HTTPS) válida.
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-black/20">
            <header className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    {title || "Herramienta Externa"}
                </div>
                <a
                    href={launchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 inline-flex items-center gap-1"
                >
                    <ExternalLink className="w-3 h-3" />
                    Abrir en pestaña nueva
                </a>
            </header>
            <iframe
                src={launchUrl}
                title={title || "Herramienta LTI"}
                className="w-full"
                style={{ minHeight: "560px", border: "none" }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
            />
        </section>
    );
}
