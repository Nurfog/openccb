"use client";

import { Mic, Clock, Tag } from "lucide-react";

interface AudioResponseBlockProps {
    id: string;
    title?: string;
    prompt: string;
    keywords?: string[];
    timeLimit?: number; // in seconds
    editMode: boolean;
    onChange: (updates: { title?: string; prompt?: string; keywords?: string[]; timeLimit?: number }) => void;
}

export default function AudioResponseBlock({
    id,
    title,
    prompt,
    keywords = [],
    timeLimit,
    editMode,
    onChange
}: AudioResponseBlockProps) {
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
                            placeholder="e.g. Speaking Practice, Pronunciation Test..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    <h3 className="text-xl font-bold border-l-4 border-purple-500 pl-4 py-1 tracking-tight text-white">
                        {title || "Audio Response"}
                    </h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-6">
                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Mic className="w-4 h-4" />
                            Question Prompt
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onChange({ prompt: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-lg font-medium focus:outline-none focus:border-purple-500/50 transition-all"
                            placeholder="What question should the student answer? (e.g. 'Describe your daily routine in English')"
                        />
                    </div>

                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            Expected Keywords (Optional)
                        </label>
                        <textarea
                            value={keywords.join("\n")}
                            onChange={(e) => onChange({ keywords: e.target.value.split("\n").filter(k => k.trim() !== "") })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-sm font-medium focus:outline-none focus:border-purple-500/50 transition-all"
                            placeholder="breakfast&#10;morning&#10;routine&#10;work"
                        />
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                            One keyword per line. Used for automatic evaluation of speech content.
                        </p>
                    </div>

                    <div className="p-6 glass border-white/5 space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Time Limit (Optional)
                        </label>
                        <input
                            type="number"
                            value={timeLimit || ""}
                            onChange={(e) => onChange({ timeLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                            placeholder="60"
                            min="10"
                            max="300"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-medium focus:border-purple-500/50 focus:outline-none"
                        />
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                            Maximum recording time in seconds (10-300). Leave empty for no limit.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="p-8 glass border-white/5 rounded-3xl space-y-8">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <Mic className="w-6 h-6 text-purple-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xl font-bold text-gray-100 mb-2">{prompt || "Record your audio response:"}</p>
                            {keywords.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Expected topics:</span>
                                    {keywords.slice(0, 5).map((kw, i) => (
                                        <span key={i} className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {timeLimit && (
                                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Maximum {timeLimit} seconds
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-purple-500/5 border-2 border-dashed border-purple-500/20 rounded-2xl text-center">
                        <p className="text-sm text-gray-400">
                            🎤 Audio recording will be available in the Experience player
                        </p>
                        <p className="text-xs text-gray-600 mt-2">
                            Students will use their microphone to record their response
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
