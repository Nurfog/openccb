"use client";

import { useState } from "react";
import { Block, cmsApi } from "@/lib/api";
import { Sparkles, MessageSquare, User, Bot, Target, Wand2, Loader2 } from "lucide-react";

interface RolePlayingBlockProps {
    block: Block;
    onUpdate: (updates: Partial<Block>) => void;
    lessonId: string;
    aiGenerationEnabled?: boolean;
}

export default function RolePlayingBlock({ block, onUpdate, lessonId, aiGenerationEnabled = true }: RolePlayingBlockProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateAI = async () => {
        if (!aiGenerationEnabled) {
            alert("Role Playing está desactivado para esta organización.");
            return;
        }
        setIsGenerating(true);
        try {
            const data = await cmsApi.generateRolePlay(lessonId, {});
            onUpdate({
                title: data.title,
                scenario: data.scenario,
                ai_persona: data.ai_persona,
                user_role: data.user_role,
                objectives: data.objectives,
                initial_message: data.initial_message
            });
        } catch (error) {
            console.error("AI Generation failed:", error);
            alert("No se pudo generar el escenario con IA. Por favor, intenta de nuevo.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <MessageSquare size={16} />
                        </div>
                        Simulación de Rol Interactiva
                    </h4>
                    <p className="text-xs text-muted-foreground">Configura un escenario para que el estudiante practique con la IA.</p>
                </div>
                <button
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !aiGenerationEnabled}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                >
                    {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                    Generar con IA
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título de la Simulación</label>
                        <input
                            type="text"
                            value={block.title || ""}
                            onChange={(e) => onUpdate({ title: e.target.value })}
                            placeholder="Ej: Negociación con un Cliente Difícil"
                            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Bot size={12} className="text-indigo-500" />
                            Persona de la IA
                        </label>
                        <input
                            type="text"
                            value={block.ai_persona || ""}
                            onChange={(e) => onUpdate({ ai_persona: e.target.value })}
                            placeholder="Ej: Un cliente frustrado que busca un reembolso"
                            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <User size={12} className="text-blue-500" />
                            Rol del Estudiante
                        </label>
                        <input
                            type="text"
                            value={block.user_role || ""}
                            onChange={(e) => onUpdate({ user_role: e.target.value })}
                            placeholder="Ej: Representante de soporte técnico"
                            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Sparkles size={12} className="text-amber-500" />
                            Escenario y Contexto
                        </label>
                        <textarea
                            value={block.scenario || ""}
                            onChange={(e) => onUpdate({ scenario: e.target.value })}
                            placeholder="Describe detalladamente dónde ocurre la acción y cuál es el problema..."
                            rows={4}
                            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Target size={12} className="text-green-500" />
                            Objetivos de Aprendizaje
                        </label>
                        <textarea
                            value={block.objectives || ""}
                            onChange={(e) => onUpdate({ objectives: e.target.value })}
                            placeholder="¿Qué debe conseguir el estudiante al final de la charla?"
                            rows={3}
                            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl border border-indigo-500/20 space-y-3 shadow-inner">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <MessageSquare size={12} />
                    </div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Mensaje Inicial de la IA</label>
                </div>
                <input
                    type="text"
                    value={block.initial_message || ""}
                    onChange={(e) => onUpdate({ initial_message: e.target.value })}
                    placeholder="Escribe la primera línea de la IA para romper el hielo..."
                    className="w-full bg-white/50 dark:bg-black/20 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                />
                <p className="text-[9px] text-muted-foreground italic">Este mensaje aparecerá automáticamente al iniciar la simulación para dar el primer paso.</p>
            </div>
        </div>
    );
}
