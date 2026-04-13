"use client";

import { useState, useEffect, useRef } from "react";
import { Wand2, Loader2, Code2, Play } from "lucide-react";
import { cmsApi } from "@/lib/api";
import mermaid from "mermaid";

interface MermaidBlockProps {
    id: string;
    title?: string;
    description?: string;
    mermaid_code?: string;
    editMode: boolean;
    courseId: string;
    lessonId: string;
    aiGenerationEnabled?: boolean;
    onChange: (updates: { title?: string; description?: string; mermaid_code?: string }) => void;
}

export default function MermaidBlock({
    id,
    title,
    description,
    mermaid_code = "",
    editMode,
    lessonId,
    aiGenerationEnabled = true,
    onChange
}: MermaidBlockProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [promptHint, setPromptHint] = useState("");
    const [renderError, setRenderError] = useState<string | null>(null);
    const mermaidRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            securityLevel: "loose",
            fontFamily: "inherit"
        });
    }, []);

    const renderMermaid = async () => {
        if (!mermaidRef.current || !mermaid_code.trim()) return;
        try {
            setRenderError(null);
            mermaidRef.current.innerHTML = "";
            const { svg } = await mermaid.render(`mermaid-${id}`, mermaid_code);
            if (mermaidRef.current) {
                mermaidRef.current.innerHTML = svg;
            }
        } catch (error: any) {
            console.error("Mermaid parsing error:", error);
            setRenderError(error?.message || "Error al renderizar el diagrama.");
        }
    };

    useEffect(() => {
        renderMermaid();
    }, [mermaid_code, editMode]);

    const handleGenerateAI = async () => {
        if (!aiGenerationEnabled) {
            alert("La generación de diagramas Mermaid está desactivada para esta organización.");
            return;
        }
        setIsGenerating(true);
        try {
            const data = await cmsApi.generateMermaidDiagram(lessonId, { prompt_hint: promptHint || undefined });
            onChange({ mermaid_code: data.mermaid_code });
        } catch (error) {
            console.error("AI Mermaid Generation failed:", error);
            alert("No se pudo generar el diagrama con IA. Por favor, intenta de nuevo.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!editMode) {
        return (
            <div className="space-y-6" id={id}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner">
                        <Code2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase transition-colors">{title || "Diagrama Interactivo"}</h3>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] font-black">{description || "Procesos y flujos visuales"}</p>
                    </div>
                </div>

                <div className="p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 bg-white dark:bg-black/20 shadow-xl overflow-x-auto custom-scrollbar">
                    {mermaid_code.trim() ? (
                        <>
                            {renderError && (
                                <div className="p-4 mb-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 dark:bg-red-500/10 dark:border-red-500/20">
                                    {renderError}
                                </div>
                            )}
                            <div ref={mermaidRef} className="mermaid flex justify-center" />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-300 dark:text-gray-700 py-12 gap-4">
                            <Code2 size={48} className="opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest italic">Diagrama no configurado.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" id={id}>
            <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-10 rounded-[3rem] shadow-sm relative overflow-hidden group/mseditor shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/mseditor:bg-indigo-500/10 transition-colors"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Título del Diagrama</label>
                            <input
                                type="text"
                                value={title || ""}
                                onChange={(e) => onChange({ title: e.target.value })}
                                placeholder="Ej. Arquitectura del Sistema..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Descripción</label>
                            <input
                                type="text"
                                value={description || ""}
                                onChange={(e) => onChange({ description: e.target.value })}
                                placeholder="Ej. Representación visual de los flujos de datos..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-slate-600 dark:text-gray-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Generación con IA</h4>
                            {!aiGenerationEnabled && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                    Mermaid está desactivado para esta organización. Puedes conservar o editar código existente manualmente.
                                </div>
                            )}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Instrucciones extra (Opcional)</label>
                                <textarea
                                    value={promptHint}
                                    onChange={(e) => setPromptHint(e.target.value)}
                                    placeholder="Ej. Crea un mapa mental sobre los conceptos clave..."
                                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 dark:text-gray-300 min-h-[100px] resize-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none disabled:opacity-60"
                                    disabled={!aiGenerationEnabled}
                                />
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating || !aiGenerationEnabled}
                                    className="flex w-full justify-center items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-500/20 active:scale-95"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                                    {isGenerating ? "Generando Diagrama..." : "Auto-Generar Código Mermaid"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 flex flex-col h-full">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Código Mermaid</label>
                            <button
                                onClick={renderMermaid}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-gray-300 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors"
                            >
                                <Play size={10} /> Actualizar Vista Previa
                            </button>
                        </div>
                        <textarea
                            value={mermaid_code}
                            onChange={(e) => onChange({ mermaid_code: e.target.value })}
                            placeholder="graph TD;\nA-->B;"
                            className="w-full h-full min-h-[300px] font-mono text-xs bg-slate-900 border border-slate-800 dark:border-white/10 rounded-2xl p-6 text-emerald-400 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none custom-scrollbar"
                            spellCheck={false}
                        />
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-white/5 space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Vista Previa del Renderizado</label>
                    <div className="p-8 rounded-3xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/40 overflow-x-auto min-h-[200px] flex items-center justify-center relative">
                        {renderError ? (
                            <div className="text-red-500 text-sm bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-xl border border-red-100 dark:border-red-500/20">
                                {renderError}
                            </div>
                        ) : mermaid_code.trim() ? (
                            <div ref={mermaidRef} className="mermaid flex justify-center w-full" />
                        ) : (
                            <p className="text-xs text-slate-400 dark:text-gray-600 font-bold uppercase tracking-widest italic">Esperando código...</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
