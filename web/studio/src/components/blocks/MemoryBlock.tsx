"use client";

import { useState } from "react";
import { Brain, Plus, Trash2, HelpCircle } from "lucide-react";

interface MatchingPair {
    left: string;
    right: string;
    id?: string;
}

interface MemoryBlockProps {
    id: string;
    title?: string;
    pairs?: MatchingPair[];
    editMode: boolean;
    onChange: (updates: { title?: string; pairs?: MatchingPair[] }) => void;
}

export default function MemoryBlock({ id, title, pairs = [], editMode, onChange }: MemoryBlockProps) {
    const addPair = () => {
        const newPair: MatchingPair = {
            id: Math.random().toString(36).substr(2, 9),
            left: "",
            right: ""
        };
        onChange({ pairs: [...pairs, newPair] });
    };

    const updatePair = (index: number, updates: Partial<MatchingPair>) => {
        const newPairs = [...pairs];
        newPairs[index] = { ...newPairs[index], ...updates };
        onChange({ pairs: newPairs });
    };

    const removePair = (index: number) => {
        const newPairs = pairs.filter((_, i) => i !== index);
        onChange({ pairs: newPairs });
    };

    if (!editMode) {
        return (
            <div className="space-y-4" id={id}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <Brain size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight text-white uppercase tracking-[0.1em]">{title || "Memory Match"}</h3>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Brain Training Exercise</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Array.from({ length: Math.min(pairs.length * 2, 8) }).map((_, i) => (
                        <div key={i} className="h-24 rounded-2xl bg-white/5 border-2 border-dashed border-white/5 flex items-center justify-center">
                            <HelpCircle className="text-white/5" size={32} />
                        </div>
                    ))}
                </div>
                <div className="text-center py-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Memory Game with {pairs.length} pairs defined</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" id={id}>
            <div className="p-8 glass border-white/5 bg-white/5 space-y-8 rounded-3xl">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 pl-1">Game Description / Title</label>
                    <input
                        type="text"
                        value={title || ""}
                        onChange={(e) => onChange({ title: e.target.value })}
                        placeholder="e.g. Vocabulary Memory Match..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500/50 focus:outline-none transition-all"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between pl-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pairs to Match</label>
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md uppercase tracking-widest">{pairs.length} Pairs</span>
                    </div>

                    <div className="space-y-3">
                        {pairs.map((pair, idx) => (
                            <div key={pair.id || idx} className="grid grid-cols-1 sm:grid-cols-9 gap-4 p-4 bg-black/20 rounded-2xl border border-white/5 group animate-in slide-in-from-left-4 duration-300">
                                <div className="sm:col-span-4 space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-tight text-gray-600 pl-1">Card A</span>
                                    <input
                                        value={pair.left}
                                        onChange={(e) => updatePair(idx, { left: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500/50 focus:outline-none transition-all"
                                        placeholder="Term, Image URL, or Word..."
                                    />
                                </div>
                                <div className="sm:col-span-1 flex items-center justify-center pt-4 sm:pt-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                        <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                    </div>
                                </div>
                                <div className="sm:col-span-3 space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-tight text-gray-600 pl-1">Card B</span>
                                    <input
                                        value={pair.right}
                                        onChange={(e) => updatePair(idx, { right: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500/50 focus:outline-none transition-all"
                                        placeholder="Matching Item..."
                                    />
                                </div>
                                <div className="sm:col-span-1 flex items-end justify-end pb-1 pr-1">
                                    <button
                                        onClick={() => removePair(idx)}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addPair}
                            className="w-full py-6 border-dashed border-2 border-white/5 text-gray-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all font-black text-[10px] uppercase tracking-widest rounded-3xl flex flex-col items-center gap-2 group"
                        >
                            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 transition-all">
                                <Plus size={20} />
                            </div>
                            <span>Add New Memory Pair</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
