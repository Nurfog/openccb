"use client";

import { useState, useMemo } from "react";

interface OrderingBlockProps {
    id: string;
    title?: string;
    items: string[];
    editMode: boolean;
    onChange: (updates: { title?: string; items?: string[] }) => void;
}

export default function OrderingBlock({ id, title, items, editMode, onChange }: OrderingBlockProps) {
    const [userOrder, setUserOrder] = useState<number[]>([]); // Array of original indices in user-selected order
    const [submitted, setSubmitted] = useState(false);

    // Shuffled items for the start
    const shuffledItems = useMemo(() => {
        return items
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
                {editMode ? (
                    <div className="space-y-2 p-6 glass border-white/5 bg-white/5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Sequence of Events..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">
                        {title || "Sequence Ordering"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-4">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Define items in their CORRECT order:</p>
                    {items.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-center animate-in slide-in-from-left-4 duration-300">
                            <span className="text-blue-500 font-black w-6">{idx + 1}.</span>
                            <input
                                value={item}
                                onChange={(e) => {
                                    const newItems = [...items];
                                    newItems[idx] = e.target.value;
                                    onChange({ items: newItems });
                                }}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 focus:outline-none"
                                placeholder={`Step ${idx + 1}`}
                            />
                            <div className="flex gap-2">
                                <button
                                    disabled={idx === 0}
                                    onClick={() => {
                                        const newItems = [...items];
                                        [newItems[idx], newItems[idx - 1]] = [newItems[idx - 1], newItems[idx]];
                                        onChange({ items: newItems });
                                    }}
                                    className="p-2 text-gray-500 hover:text-white disabled:opacity-20"
                                >
                                    ↑
                                </button>
                                <button
                                    disabled={idx === items.length - 1}
                                    onClick={() => {
                                        const newItems = [...items];
                                        [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
                                        onChange({ items: newItems });
                                    }}
                                    className="p-2 text-gray-500 hover:text-white disabled:opacity-20"
                                >
                                    ↓
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    const newItems = items.filter((_, i) => i !== idx);
                                    onChange({ items: newItems });
                                }}
                                className="p-2 text-gray-500 hover:text-red-400"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => onChange({ items: [...items, ""] })}
                        className="w-full py-4 border-dashed border-2 border-white/10 text-gray-400 hover:text-white hover:border-blue-500/30 transition-all font-bold text-xs uppercase tracking-widest rounded-xl"
                    >
                        + Add Step
                    </button>
                </div>
            ) : (
                <div className="space-y-8 p-8 glass border-white/5 rounded-3xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 block">Available Items</label>
                            <div className="flex flex-wrap gap-3">
                                {shuffledItems.map((item, i) => {
                                    const isPicked = userOrder.includes(item.originalIdx);
                                    return (
                                        <button
                                            key={i}
                                            disabled={isPicked || submitted}
                                            onClick={() => handlePick(item.originalIdx)}
                                            className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${isPicked ? "opacity-20 grayscale border-white/5 bg-white/5" :
                                                "border-white/10 bg-white/5 text-gray-200 hover:border-blue-500/50 hover:bg-blue-500/5"
                                                }`}
                                        >
                                            {item.value}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 block">Your Sequence</label>
                            <div className="space-y-3">
                                {userOrder.length === 0 && <p className="text-xs text-gray-600 italic py-4">Click items to build the sequence...</p>}
                                {userOrder.map((idx, i) => {
                                    const isItemCorrect = submitted && idx === i;
                                    const isItemWrong = submitted && idx !== i;

                                    return (
                                        <div
                                            key={i}
                                            onClick={() => !submitted && handlePick(idx)}
                                            className={`flex items-center gap-4 p-4 rounded-xl border text-sm font-bold transition-all cursor-pointer ${isItemCorrect ? "border-green-500 bg-green-500/20 text-green-400" :
                                                isItemWrong ? "border-red-500 bg-red-500/20 text-red-100" :
                                                    "border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10"
                                                }`}
                                        >
                                            <span className="opacity-50 text-xs">{i + 1}.</span>
                                            <span className="flex-1">{items[idx]}</span>
                                            {!submitted && <span className="text-xs opacity-50">×</span>}
                                            {isItemCorrect && <span>✅</span>}
                                            {isItemWrong && <span>❌</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5">
                        {!submitted && userOrder.length === items.length && (
                            <button
                                onClick={() => setSubmitted(true)}
                                className="btn-premium w-full py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20"
                            >
                                Validate Sequence
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
