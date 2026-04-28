"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import DOMPurify from "isomorphic-dompurify";
import { Block } from "@/lib/api";

interface MermaidViewerProps {
    block: Block;
}

export default function MermaidViewer({ block }: MermaidViewerProps) {
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [renderError, setRenderError] = useState<string | null>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            securityLevel: "loose",
            fontFamily: "inherit",
        });
    }, []);

    useEffect(() => {
        const renderDiagram = async () => {
            if (!mermaidRef.current || !block.mermaid_code) return;
            try {
                setRenderError(null);
                mermaidRef.current.innerHTML = "";
                const { svg } = await mermaid.render(`mermaid-exp-${block.id}`, block.mermaid_code);
                if (mermaidRef.current) {
                    // Sanitizar SVG antes de inyectar
                    mermaidRef.current.innerHTML = DOMPurify.sanitize(svg);
                }
            } catch (error: any) {
                console.error("Mermaid parsing error:", error);
                setRenderError("Error al cargar el diagrama conceptual.");
            }
        };

        renderDiagram();
    }, [block.mermaid_code, block.id]);

    return (
        <div className="bg-white dark:bg-black/20 rounded-[3rem] p-8 md:p-12 mb-8 shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden group/msview">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/msview:bg-indigo-500/10 transition-colors"></div>

            <div className="relative z-10 flex flex-col gap-6">
                <div>
                    <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase mb-2">
                        {block.title || "Diagrama Interactivo"}
                    </h3>
                    <p className="text-sm font-bold text-slate-500 dark:text-gray-400">
                        {block.description || "Explora el mapa visual a continuación."}
                    </p>
                </div>

                <div className="overflow-x-auto min-h-[200px] flex items-center justify-center bg-slate-50 dark:bg-black/40 rounded-3xl border border-slate-100 dark:border-white/10 p-6 custom-scrollbar">
                    {renderError ? (
                        <div className="text-red-500 text-sm font-bold bg-red-50 dark:bg-red-500/10 px-6 py-4 rounded-2xl border border-red-100 dark:border-red-500/20">
                            {renderError}
                        </div>
                    ) : (
                        <div ref={mermaidRef} className="mermaid flex justify-center w-full min-w-max" />
                    )}
                </div>
            </div>
        </div>
    );
}
