"use client";

import { useState, useMemo } from "react";

interface MatchingPair {
    left: string;
    right: string;
}

interface MatchingPlayerProps {
    id: string;
    title?: string;
    pairs: MatchingPair[];
}

export default function MatchingPlayer({ id, title, pairs }: MatchingPlayerProps) {
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    const [matches, setMatches] = useState<Record<number, number>>({});
    const [submitted, setSubmitted] = useState(false);

    const shuffledRight = useMemo(() => {
        return (pairs || [])
            .map((p, i) => ({ value: p.right, originalIdx: i }))
            .sort(() => Math.random() - 0.5);
    }, [pairs]);

    const handleMatch = (leftIdx: number, rightIdx: number) => {
        if (submitted) return;
        setMatches(prev => ({ ...prev, [leftIdx]: rightIdx }));
        setSelectedLeft(null);
    };

    const handleReset = () => {
        setSubmitted(false);
        setMatches({});
        setSelectedLeft(null);
    };

    return (
        <div className="space-y-8" id={id}>
            <div className="space-y-2">
                <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white uppercase tracking-widest text-[10px]">
                    {title || "Concept Matching"}
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 p-8 glass border-white/5 rounded-3xl relative">
                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 block">Term</label>
                    {(pairs || []).map((pair, i) => (
                        <button
                            key={i}
                            onClick={() => !submitted && setSelectedLeft(i)}
                            className={`w-full p-4 rounded-xl border text-left text-sm font-bold transition-all ${selectedLeft === i ? "border-blue-500 bg-blue-500/10 text-white shadow-lg" :
                                    matches[i] !== undefined ? "border-blue-500/20 bg-blue-500/5 text-blue-400" :
                                        "border-white/5 bg-white/5 text-gray-200 hover:border-white/20"
                                }`}
                        >
                            {pair.left}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 block">Definition</label>
                    {shuffledRight.map((item, i) => {
                        const matchedLeftIdx = Object.keys(matches).find(k => matches[parseInt(k)] === item.originalIdx);
                        const isCorrect = submitted && matchedLeftIdx !== undefined && parseInt(matchedLeftIdx) === item.originalIdx;
                        const isWrong = submitted && matchedLeftIdx !== undefined && parseInt(matchedLeftIdx) !== item.originalIdx;

                        return (
                            <button
                                key={i}
                                disabled={selectedLeft === null || submitted}
                                onClick={() => handleMatch(selectedLeft!, item.originalIdx)}
                                className={`w-full p-4 rounded-xl border text-left text-sm font-bold transition-all ${selectedLeft !== null && matchedLeftIdx === undefined ? "hover:border-blue-500/50 hover:bg-white/5" : ""
                                    } ${isCorrect ? "border-green-500 bg-green-500/20 text-green-400" :
                                        isWrong ? "border-red-500 bg-red-500/20 text-red-100" :
                                            matchedLeftIdx !== undefined ? "border-blue-500/30 bg-blue-500/5 text-blue-400" :
                                                "border-white/5 bg-white/5 text-gray-200"
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{item.value}</span>
                                    {isCorrect && <span>✅</span>}
                                    {isWrong && <span>❌</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="md:col-span-2 pt-8 border-t border-white/5">
                    {!submitted && Object.keys(matches).length === (pairs || []).length && (
                        <button
                            onClick={() => setSubmitted(true)}
                            className="btn-premium w-full py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20"
                        >
                            Validate Matching
                        </button>
                    )}
                    {submitted && (
                        <button
                            onClick={handleReset}
                            className="w-full py-5 glass text-blue-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-white/5 transition-all rounded-2xl border-white/5"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
