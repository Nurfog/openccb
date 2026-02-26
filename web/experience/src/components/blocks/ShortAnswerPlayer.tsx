"use client";

import { useState } from "react";

interface ShortAnswerPlayerProps {
    id: string;
    title?: string;
    prompt: string;
    correctAnswers: string[];
    allowRetry?: boolean;
}

export default function ShortAnswerPlayer({ id, title, prompt, correctAnswers, allowRetry = true }: ShortAnswerPlayerProps) {
    const [userAnswer, setUserAnswer] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleReset = () => {
        setSubmitted(false);
        setUserAnswer("");
    };

    const isCorrect = (correctAnswers || []).some(ans => ans.trim().toLowerCase() === userAnswer.trim().toLowerCase());

    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                <h3 className="text-xl font-bold border-l-4 border-blue-600 dark:border-blue-500 pl-4 py-1 tracking-tight text-gray-900 dark:text-white uppercase tracking-widest text-[10px]">
                    {title || "Respuesta Corta"}
                </h3>
            </div>

            <div className="p-8 glass border-black/5 dark:border-white/5 rounded-3xl space-y-8 bg-black/[0.02] dark:bg-black/20">
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{prompt || "Por favor, introduce tu respuesta a continuación:"}</p>

                <div className="space-y-4">
                    <input
                        type="text"
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        disabled={submitted}
                        className={`w-full bg-black/5 dark:bg-white/5 border-2 rounded-2xl px-6 py-4 text-lg transition-all focus:outline-none ${submitted
                            ? (isCorrect ? "border-green-600 dark:border-green-500 bg-green-500/10 text-green-700 dark:text-green-400" : "border-red-600 dark:border-red-500 bg-red-500/10 text-red-700 dark:text-red-100")
                            : "border-black/10 dark:border-white/10 focus:border-blue-600 dark:focus:border-blue-500 text-gray-900 dark:text-white"
                            }`}
                        placeholder="Escribe tu respuesta..."
                    />

                    {submitted && !isCorrect && (
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl animate-in fade-in duration-500">
                            <p className="text-[10px] text-orange-400 uppercase font-black tracking-widest">Respuesta(s) Sugerida(s):</p>
                            <p className="text-sm text-gray-400 mt-1">{(correctAnswers || [])[0]}</p>
                        </div>
                    )}
                </div>

                {allowRetry && (
                    <>
                        {!submitted && (
                            <button
                                onClick={() => setSubmitted(true)}
                                disabled={!userAnswer.trim()}
                                className="btn-premium w-full py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:grayscale"
                            >
                                Enviar Respuesta
                            </button>
                        )}

                        {submitted && (
                            <button
                                onClick={handleReset}
                                className="w-full py-5 glass text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-3xl border-black/5 dark:border-white/5"
                            >
                                Intentar de Nuevo
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
