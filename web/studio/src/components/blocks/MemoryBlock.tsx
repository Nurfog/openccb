"use client";

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

// Generate unique ID for pairs
const generatePairId = () => {
    return `pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default function MemoryBlock({ id, title, pairs = [], editMode, onChange }: MemoryBlockProps) {
    const addPair = () => {
        const newPair: MatchingPair = {
            id: generatePairId(),
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
            <div className="space-y-8" id={id}>
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                        <Brain size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase leading-none">{title || "Synaptic Recall"}</h3>
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mt-2">Mnemonic Calibration Engine</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Array.from({ length: Math.min(pairs.length * 2, 8) }).map((_, i) => (
                        <div key={i} className="h-28 rounded-[2rem] bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center relative group/mcard">
                            <HelpCircle className="text-slate-200 dark:text-gray-800 group-hover/mcard:text-indigo-500/40 transition-colors" size={40} strokeWidth={1} />
                            <div className="absolute inset-2 border border-indigo-500/5 rounded-[1.5rem]"></div>
                        </div>
                    ))}
                </div>
                <div className="text-center py-6 bg-indigo-50 dark:bg-indigo-500/5 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-500/10 shadow-inner">
                    <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-[0.4em] italic">{pairs.length} Bilateral Nodes Configured</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" id={id}>
            <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-12 rounded-[3.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group/memeditor">
                <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2 group-hover/memeditor:bg-indigo-500/10 transition-colors"></div>

                <div className="space-y-4 relative z-10">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-gray-500 pl-2">System Designation (Title)</label>
                    <input
                        type="text"
                        value={title || ""}
                        onChange={(e) => onChange({ title: e.target.value })}
                        placeholder="e.g. Vocabulary Memory Match..."
                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-[2.5rem] px-8 py-5 text-lg font-black italic uppercase tracking-tight text-slate-800 dark:text-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none shadow-inner"
                    />
                </div>

                <div className="space-y-8 relative z-10">
                    <div className="flex items-center justify-between px-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 italic">Bilateral Pair Configuration</label>
                        <span className="text-[9px] font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-500/20 shadow-inner uppercase tracking-widest">{pairs.length} Pairs Synchronized</span>
                    </div>

                    <div className="space-y-6">
                        {pairs.map((pair, idx) => (
                            <div key={pair.id || idx} className="grid grid-cols-1 sm:grid-cols-10 gap-6 p-8 bg-slate-50/50 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/10 group animate-in slide-in-from-left-4 duration-500 hover:scale-[1.01] hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm">
                                <div className="sm:col-span-4 space-y-3">
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-600 pl-1 italic">Synapse Alpha</span>
                                    <input
                                        value={pair.left}
                                        onChange={(e) => updatePair(idx, { left: e.target.value })}
                                        className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-inner"
                                        placeholder="Term / ID A..."
                                    />
                                </div>
                                <div className="sm:col-span-2 flex items-center justify-center pt-8 sm:pt-6">
                                    <div className="w-12 h-12 rounded-full bg-white dark:bg-black/40 border border-slate-100 dark:border-white/10 flex items-center justify-center shadow-lg transform group-hover:rotate-180 transition-transform duration-700">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                    </div>
                                </div>
                                <div className="sm:col-span-4 space-y-3 relative">
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-600 pl-1 italic">Synapse Beta</span>
                                    <div className="flex items-center gap-4">
                                        <input
                                            value={pair.right}
                                            onChange={(e) => updatePair(idx, { right: e.target.value })}
                                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-inner"
                                            placeholder="Term / ID B..."
                                        />
                                        <button
                                            onClick={() => removePair(idx)}
                                            className="p-4 bg-red-50 dark:bg-red-500/5 hover:bg-red-500 hover:text-white rounded-2xl text-red-500 transition-all active:scale-90 opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addPair}
                            className="w-full py-12 border-dashed border-4 border-slate-100 dark:border-white/10 text-slate-300 dark:text-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-white/5 transition-all font-black text-[11px] uppercase tracking-[0.5em] rounded-[3rem] flex flex-col items-center gap-6 group/addbtn shadow-inner"
                        >
                            <div className="p-5 rounded-[1.5rem] bg-slate-50 dark:bg-white/5 group-hover/addbtn:bg-indigo-600 group-hover/addbtn:text-white group-hover/addbtn:rotate-90 transition-all duration-500 shadow-xl">
                                <Plus size={32} strokeWidth={3} />
                            </div>
                            <span>Initialize New Synaptic Link</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
