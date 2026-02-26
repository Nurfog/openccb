"use client";

import { useState, useMemo } from "react";

interface OrderingPlayerProps {
    id: string;
    title?: string;
    items: string[];
    allowRetry?: boolean;
}

export default function OrderingPlayer({ id, title, items, allowRetry = true }: OrderingPlayerProps) {
    const [userOrder, setUserOrder] = useState<number[]>([]);
    const [submitted, setSubmitted] = useState(false);

    const shuffledItems = useMemo(() => {
        return (items || [])
            .map((item, i) => ({ value: item, originalIdx: i }))
            .sort(() => Math.random() - 0.5);
    }, [items]);

    const handlePick = (originalIdx: number) => {
        if (submitted) return;
        if (userOrder.includes(originalIdx)) {
            setUserOrder(userOrder.filter(i => i !== originalIdx));
        } else {
            setUserOrder([...userOrder, originalIdx]);
        }
    };

    const handleReset = () => {
        setSubmitted(false);
        setUserOrder([]);
    };

    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                <h3 className="text-xl font-bold border-l-4 border-blue-600 dark:border-blue-500 pl-4 py-1 tracking-tight text-gray-900 dark:text-white uppercase tracking-widest text-[10px]">
                    {title || "Ordenamiento de Secuencia"}
                </h3>
            </div>

            <div className="space-y-8 p-8 glass border-black/5 dark:border-white/5 rounded-3xl bg-black/[0.02] dark:bg-black/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4 block">Elementos Disponibles</label>
                        <div className="flex flex-wrap gap-3">
                            {shuffledItems.map((item, i) => {
                                const isPicked = userOrder.includes(item.originalIdx);
                                return (
                                    <button
                                        key={i}
                                        disabled={isPicked || submitted}
                                        onClick={() => handlePick(item.originalIdx)}
                                        className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${isPicked ? "opacity-20 grayscale border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5" :
                                            "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200 hover:border-blue-600/50 dark:hover:border-blue-500/50 hover:bg-blue-600/5 dark:hover:bg-blue-500/5"
                                            }`}
                                    >
                                        {item.value}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4 block">Tu Secuencia</label>
                        <div className="space-y-3">
                            {userOrder.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-600 italic py-4">Haz clic en los elementos para construir la secuencia...</p>}
                            {userOrder.map((idx, i) => {
                                const isItemCorrect = submitted && idx === i;
                                const isItemWrong = submitted && idx !== i;

                                return (
                                    <div
                                        key={i}
                                        onClick={() => !submitted && handlePick(idx)}
                                        className={`flex items-center gap-4 p-4 rounded-xl border text-sm font-bold transition-all cursor-pointer ${isItemCorrect ? "border-green-600 dark:border-green-500 bg-green-500/20 text-green-700 dark:text-green-400" :
                                            isItemWrong ? "border-red-600 dark:border-red-500 bg-red-500/20 text-red-700 dark:text-red-100" :
                                                "border-blue-600/30 dark:border-blue-500/30 bg-blue-600/5 dark:bg-blue-500/5 text-blue-700 dark:text-blue-400 hover:bg-blue-600/10 dark:hover:bg-blue-500/10"
                                            }`}
                                    >
                                        <span className="opacity-50 text-xs">{i + 1}.</span>
                                        <span className="flex-1">{(items || [])[idx]}</span>
                                        {!submitted && <span className="text-xs opacity-50">×</span>}
                                        {isItemCorrect && <span>✅</span>}
                                        {isItemWrong && <span>❌</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {allowRetry && (
                    <div className="pt-8 border-t border-white/5">
                        {!submitted && userOrder.length === (items || []).length && (
                            <button
                                onClick={() => setSubmitted(true)}
                                className="btn-premium w-full py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20"
                            >
                                Validar Secuencia
                            </button>
                        )}
                        {submitted && (
                            <button
                                onClick={handleReset}
                                className="w-full py-5 glass text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-2xl border-black/5 dark:border-white/5"
                            >
                                Intentar de Nuevo
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
