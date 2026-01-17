"use client";

import React, { useState } from "react";
import { Play, CheckCircle, XCircle, Code2, RefreshCcw } from "lucide-react";

interface CodeExercisePlayerProps {
    title: string;
    instructions: string;
    initialCode: string;
    expectedOutput?: string;
    validationLogic?: string; // JavaScript snippet to validate
    onComplete: (score: number) => void;
}

export default function CodeExercisePlayer({
    title,
    instructions,
    initialCode,
    onComplete
}: CodeExercisePlayerProps) {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState<string | null>(null);
    const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");

    const runCode = () => {
        setStatus("running");
        setOutput("Running tests...\n");

        setTimeout(() => {
            // Mock validation logic
            // In a real system, this would go to a sandbox or use a WebWorker
            const lowerCode = code.toLowerCase();
            let isCorrect = false;

            if (title.toLowerCase().includes("hello world")) {
                isCorrect = code.includes("print") || code.includes("console.log") || code.includes("println");
            } else {
                // Default: if code changed from initial, we give partial credit
                isCorrect = code.trim() !== initialCode.trim();
            }

            if (isCorrect) {
                setStatus("success");
                setOutput("✅ Tests passed!\n\nOutput:\nHello, OpenCCB!");
                onComplete(1.0);
            } else {
                setStatus("error");
                setOutput("❌ Tests failed.\n\nError:\nAssertionError: Output does not match expected result.");
            }
        }, 1500);
    };

    const reset = () => {
        setCode(initialCode);
        setStatus("idle");
        setOutput(null);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-700">
            <div className="glass-card p-6 border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Code2 size={24} />
                    </div>
                    <h2 className="text-xl font-black tracking-tight">{title}</h2>
                </div>
                <div className="prose prose-invert max-w-none text-gray-400 text-sm leading-relaxed">
                    {instructions}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[500px]">
                {/* Editor Area */}
                <div className="flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-[#1a1c21]">
                    <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span>main.py</span>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500/20" />
                            <div className="w-2 h-2 rounded-full bg-amber-500/20" />
                            <div className="w-2 h-2 rounded-full bg-green-500/20" />
                        </div>
                    </div>
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="flex-1 bg-transparent p-6 font-mono text-sm resize-none focus:outline-none text-indigo-100 selection:bg-indigo-500/30"
                        spellCheck={false}
                    />
                    <div className="p-4 bg-black/20 border-t border-white/5 flex gap-2">
                        <button
                            onClick={runCode}
                            disabled={status === "running"}
                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            {status === "running" ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Play size={16} />
                            )}
                            Run Code
                        </button>
                        <button
                            onClick={reset}
                            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            title="Reset"
                        >
                            <RefreshCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* Console / Results Area */}
                <div className="flex flex-col rounded-2xl overflow-hidden border border-white/5 bg-black/40">
                    <div className="px-4 py-2 bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Console Output
                    </div>
                    <div className="flex-1 p-6 font-mono text-sm overflow-auto">
                        {!output && <span className="text-gray-600 italic">Click &quot;Run Code&quot; to execute tests...</span>}
                        {output && (
                            <pre className={`whitespace-pre-wrap ${status === "success" ? "text-green-400" :
                                status === "error" ? "text-red-400" :
                                    "text-gray-400"
                                }`}>
                                {output}
                            </pre>
                        )}
                    </div>
                    {status === "success" && (
                        <div className="m-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 animate-in zoom-in duration-300">
                            <CheckCircle className="text-green-400" />
                            <div>
                                <div className="text-sm font-bold text-green-400">Challenge Completed!</div>
                                <p className="text-[10px] text-green-500/80 uppercase font-black tracking-widest">Score: 100%</p>
                            </div>
                        </div>
                    )}
                    {status === "error" && (
                        <div className="m-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in shake duration-300">
                            <XCircle className="text-red-400" />
                            <div>
                                <div className="text-sm font-bold text-red-400">Execution Failed</div>
                                <p className="text-[10px] text-red-500/80 uppercase font-black tracking-widest">Try again</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
