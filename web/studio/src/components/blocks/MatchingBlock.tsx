"use client";

import { useState, useMemo } from "react";

interface MatchingPair {
    left: string;
    right: string;
}

interface MatchingBlockProps {
    id: string;
    title?: string;
    pairs: MatchingPair[];
    editMode: boolean;
    onChange: (updates: { title?: string; pairs?: MatchingPair[] }) => void;
}

export default function MatchingBlock({ id, title, pairs, editMode, onChange }: MatchingBlockProps) {
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    const [matches, setMatches] = useState<Record<number, number>>({}); // leftIdx -> rightIdx
    const [submitted, setSubmitted] = useState(false);

    // Shuffled right items for the game
    const shuffledRight = useMemo(() => {
        return pairs
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
                {editMode ? (
                    <div className="space-y-2 p-6 glass border-white/5 bg-white/5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Match the concepts..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">
                        {title || "Concept Matching"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-4">
                    {pairs.map((pair, idx) => (
                        <div key={idx} className="flex gap-4 items-center animate-in slide-in-from-left-4 duration-300">
                            <input
                                value={pair.left}
                                onChange={(e) => {
                                    const newPairs = [...pairs];
                                    newPairs[idx].left = e.target.value;
                                    onChange({ pairs: newPairs });
                                }}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 focus:outline-none"
                                placeholder="Term A"
                            />
                            <span className="text-gray-500 font-bold">↔</span>
                            <input
                                value={pair.right}
                                onChange={(e) => {
                                    const newPairs = [...pairs];
                                    newPairs[idx].right = e.target.value;
                                    onChange({ pairs: newPairs });
                                }}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 focus:outline-none"
                                placeholder="Definition B"
                            />
                            <button
                                onClick={() => {
                                    const newPairs = pairs.filter((_, i) => i !== idx);
                                    onChange({ pairs: newPairs });
                                }}
                                className="p-2 text-gray-500 hover:text-red-400"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => onChange({ pairs: [...pairs, { left: "", right: "" }] })}
                        className="w-full py-4 border-dashed border-2 border-white/10 text-gray-400 hover:text-white hover:border-blue-500/30 transition-all font-bold text-xs uppercase tracking-widest rounded-xl"
                    >
                        + Add Pair
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 p-8 glass border-white/5 rounded-3xl relative">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 block">Term</label>
                        {pairs.map((pair, i) => (
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
                        {!submitted && Object.keys(matches).length === pairs.length && (
                            <button
                                onClick={() => setSubmitted(true)}
                                className="btn-premium w-full py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20"
                            >
                                Validate Matching
                            </button>
                        )}
                        {submitted && (
                            <button
                                onClick={handleReset}
                                className="w-full py-4 glass text-blue-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-white/5 transition-all rounded-xl border-white/5"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
