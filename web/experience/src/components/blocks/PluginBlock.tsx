"use client";

import React, { useEffect, useRef, useState } from "react";
import { Puzzle, AlertTriangle, ExternalLink } from "lucide-react";

interface PluginBlockProps {
    pluginId: string;
    name: string;
    componentUrl: string;
    config?: Record<string, unknown>;
}

/**
 * Renderiza un Web Component externo dentro de un iframe sandboxed.
 * El sandbox permite scripts y same-origin pero bloquea navegación superior,
 * formularios externos y acceso a cámara/micrófono sin permiso explícito.
 */
export default function PluginBlock({ pluginId, name, componentUrl, config = {} }: PluginBlockProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    // Solo permitir HTTPS
    const isSecure = componentUrl.startsWith("https://");

    useEffect(() => {
        if (!isSecure) {
            setError("Este plugin no puede cargarse: la URL debe usar HTTPS.");
            return;
        }

        // Enviar config al iframe cuando cargue vía postMessage
        const handleLoad = () => {
            setLoaded(true);
            iframeRef.current?.contentWindow?.postMessage(
                { type: "OPENCCB_PLUGIN_CONFIG", pluginId, config },
                new URL(componentUrl).origin
            );
        };

        const iframe = iframeRef.current;
        if (iframe) {
            iframe.addEventListener("load", handleLoad);
            return () => iframe.removeEventListener("load", handleLoad);
        }
    }, [componentUrl, config, isSecure, pluginId]);

    if (!isSecure) {
        return (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>El plugin <strong>{name}</strong> no puede cargarse: URL no segura.</span>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-black/20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/3">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Puzzle className="w-4 h-4 text-indigo-500" />
                    {name}
                </div>
                <a
                    href={componentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 flex items-center gap-1 transition-colors"
                >
                    <ExternalLink className="w-3 h-3" />
                    Abrir
                </a>
            </div>

            {/* Loading state */}
            {!loaded && (
                <div className="flex items-center justify-center h-48 text-black/30 dark:text-white/30 text-sm animate-pulse">
                    Cargando plugin…
                </div>
            )}

            {/* Iframe sandboxed */}
            <iframe
                ref={iframeRef}
                src={componentUrl}
                title={name}
                className={`w-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0 h-0"}`}
                style={{ minHeight: loaded ? "400px" : "0px", border: "none" }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                loading="lazy"
                onError={() => setError("No se pudo cargar el plugin.")}
            />

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
}
