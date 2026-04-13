"use client";

import { useState } from "react";
import { Wand2, Loader2, Code2, Plus, Trash2 } from "lucide-react";
import { cmsApi } from "@/lib/api";

interface CodeLabBlockProps {
    id: string;
    title?: string;
    language?: string;
    instructions?: string;
    initial_code?: string;
    solution?: string;
    test_cases?: { description: string; expected: string }[];
    editMode: boolean;
    lessonId: string;
    aiGenerationEnabled?: boolean;
    onChange: (updates: {
        title?: string;
        language?: string;
        instructions?: string;
        initial_code?: string;
        solution?: string;
        test_cases?: { description: string; expected: string }[]
    }) => void;
}

export default function CodeLabBlock({
    id,
    title = "",
    language = "python",
    instructions = "",
    initial_code = "",
    solution = "",
    test_cases = [],
    editMode,
    lessonId,
    aiGenerationEnabled = true,
    onChange
}: CodeLabBlockProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [promptHint, setPromptHint] = useState("");

    const handleGenerateAI = async () => {
        if (!aiGenerationEnabled) {
            alert("Code Lab está desactivado para esta organización.");
            return;
        }
        setIsGenerating(true);
        try {
            const data = await cmsApi.generateCodeLab(lessonId, {
                language,
                prompt_hint: promptHint || undefined
            });
            onChange({
                title: data.title,
                instructions: data.instructions,
                initial_code: data.initial_code,
                solution: data.solution,
                test_cases: data.test_cases,
                language: data.language
            });
        } catch (error) {
            console.error("AI Code Lab Generation failed:", error);
            alert("No se pudo generar el laboratorio con IA. Por favor, intenta de nuevo.");
        } finally {
            setIsGenerating(false);
        }
    };

    const addTestCase = () => {
        const newTestCases = [...test_cases, { description: "", expected: "" }];
        onChange({ test_cases: newTestCases });
    };

    const updateTestCase = (index: number, field: "description" | "expected", value: string) => {
        const newTestCases = [...test_cases];
        newTestCases[index] = { ...newTestCases[index], [field]: value };
        onChange({ test_cases: newTestCases });
    };

    const removeTestCase = (index: number) => {
        const newTestCases = test_cases.filter((_, i) => i !== index);
        onChange({ test_cases: newTestCases });
    };

    if (!editMode) {
        return (
            <div className="space-y-6" id={id}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner">
                        <Code2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase">
                            {title || "Laboratorio de Código"}
                        </h3>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] font-black">
                            {language.toUpperCase()} • Ejercicio Interactivo
                        </p>
                    </div>
                </div>

                <div className="p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 bg-white dark:bg-black/20 shadow-xl">
                    <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-gray-300 mb-8">
                        {instructions || "Sigue las instrucciones del editor para completar el desafío."}
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-6 font-mono text-sm text-indigo-100 mb-6">
                        <pre className="whitespace-pre-wrap">{initial_code || "# El código inicial aparecerá aquí"}</pre>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Vista Previa del Estudiante activada
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" id={id}>
            <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-10 rounded-[3rem] shadow-xl relative overflow-hidden group/cleditor">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Título del Desafío</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => onChange({ title: e.target.value })}
                                placeholder="Ej. Calculadora de Factoriales..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black uppercase text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Lenguaje de Programación</label>
                            <select
                                value={language}
                                onChange={(e) => onChange({ language: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 dark:text-gray-300 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                            >
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                                <option value="sql">SQL</option>
                                <option value="bash">Bash</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Instrucciones</label>
                            <textarea
                                value={instructions}
                                onChange={(e) => onChange({ instructions: e.target.value })}
                                placeholder="Describe qué debe hacer el estudiante..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm text-slate-700 dark:text-gray-300 min-h-[150px] outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                            />
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-4">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Generación con IA</h4>
                            {!aiGenerationEnabled && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                    Code Lab está desactivado para esta organización. Puedes seguir editando el bloque manualmente.
                                </div>
                            )}
                            <textarea
                                value={promptHint}
                                onChange={(e) => setPromptHint(e.target.value)}
                                placeholder="Ej. Crea un ejercicio sobre bucles for que use una lista de tareas..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm text-slate-700 dark:text-gray-300 min-h-[80px] outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all disabled:opacity-60"
                                disabled={!aiGenerationEnabled}
                            />
                            <button
                                onClick={handleGenerateAI}
                                disabled={isGenerating || !aiGenerationEnabled}
                                className="flex w-full justify-center items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-500/20"
                            >
                                {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                                {isGenerating ? "Generando Laboratorio..." : "Auto-Generar con IA"}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8 flex flex-col">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Código Inicial (Para el estudiante)</label>
                            <textarea
                                value={initial_code}
                                onChange={(e) => onChange({ initial_code: e.target.value })}
                                placeholder="# Escribe el código base con TODOs..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 font-mono text-xs text-emerald-400 min-h-[200px] outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                spellCheck={false}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Solución (Oculta)</label>
                            <textarea
                                value={solution}
                                onChange={(e) => onChange({ solution: e.target.value })}
                                placeholder="# Escribe la solución completa..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 font-mono text-xs text-amber-400 min-h-[200px] outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Casos de Prueba</label>
                        <button
                            onClick={addTestCase}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <Plus size={14} /> Añadir Caso
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {test_cases.map((tc, index) => (
                            <div key={index} className="flex gap-4 items-start bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 group/tc">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-black uppercase text-slate-400">Descripción del Caso</span>
                                        <input
                                            type="text"
                                            value={tc.description}
                                            onChange={(e) => updateTestCase(index, "description", e.target.value)}
                                            placeholder="Ej. Entrada válida: 5"
                                            className="w-full bg-white dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-black uppercase text-slate-400">Resultado Esperado (Texto)</span>
                                        <input
                                            type="text"
                                            value={tc.expected}
                                            onChange={(e) => updateTestCase(index, "expected", e.target.value)}
                                            placeholder="Ej. 120"
                                            className="w-full bg-white dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeTestCase(index)}
                                    className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/tc:opacity-100 transition-all mt-6"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
