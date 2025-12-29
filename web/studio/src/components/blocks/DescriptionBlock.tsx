"use client";

import { useState } from "react";

interface DescriptionBlockProps {
    id: string;
    title?: string;
    content: string;
    editMode: boolean;
    onChange: (updates: { title?: string; content?: string }) => void;
}

export default function DescriptionBlock({ title, content, editMode, onChange }: DescriptionBlockProps) {
    const [showPreview, setShowPreview] = useState(false);
    return (
        <div className="space-y-6">
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Introduction, Context..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    title && <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">{title}</h3>
                )}
            </div>

            {editMode ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instructional Content</label>
                        <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                            <button
                                onClick={() => setShowPreview(false)}
                                className={`px-4 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-md transition-all ${!showPreview ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                            >
                                Write
                            </button>
                            <button
                                onClick={() => setShowPreview(true)}
                                className={`px-4 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-md transition-all ${showPreview ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                            >
                                Preview
                            </button>
                        </div>
                    </div>

                    {showPreview ? (
                        <div className="min-h-[200px] p-6 rounded-xl glass border-white/5 bg-white/5">
                            <div className="prose prose-invert max-w-none">
                                <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                                    {content || "Nothing to preview..."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => onChange({ content: e.target.value })}
                            placeholder="Explain the activity to the students (Markdown supported)..."
                            className="w-full h-60 bg-white/5 border border-white/10 rounded-xl p-6 text-lg tracking-tight focus:border-blue-500/50 focus:outline-none transition-all resize-none shadow-inner"
                        />
                    )}
                </div>
            ) : (
                <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                        {content || "No description provided."}
                    </p>
                </div>
            )}
        </div>
    );
}
