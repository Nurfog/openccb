"use client";

import { useState } from "react";
import MediaPlayer from "../MediaPlayer";
import FileUpload from "../FileUpload";
import { getImageUrl } from "@/lib/api";

export interface Marker {
    timestamp: number;
    question: string;
    options: string[];
    correctIndex: number;
}

interface MediaBlockProps {
    id: string;
    title?: string;
    url: string;
    type: 'video' | 'audio';
    config: {
        maxPlays?: number;
        currentPlays?: number;
        show_transcript?: boolean;
        markers?: Marker[];
    };
    editMode: boolean;
    onChange: (updates: {
        title?: string;
        url?: string;
        config?: {
            maxPlays?: number;
            currentPlays?: number;
            show_transcript?: boolean;
            markers?: Marker[];
        }
    }) => void;
    transcription?: {
        en?: string;
        es?: string;
        cues?: { start: number; end: number; text: string }[];
    } | null;
}

export default function MediaBlock({ title, url, type, config, editMode, onChange, transcription }: MediaBlockProps) {
    const [localPlays, setLocalPlays] = useState(config.currentPlays || 0);
    const [sourceType, setSourceType] = useState<"url" | "upload">(url.startsWith("/assets/") ? "upload" : "url");
    const maxPlays = config.maxPlays || 0;
    const isLocked = maxPlays > 0 && localPlays >= maxPlays;

    const handleEnded = () => {
        if (maxPlays > 0) {
            const nextPlays = localPlays + 1;
            setLocalPlays(nextPlays);
            onChange({ config: { ...config, currentPlays: nextPlays } });
        }
    };

    // Full URL for display (handles relative paths from server)
    const displayUrl = getImageUrl(url);

    return (
        <div className="space-y-6">
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-2 p-6 glass border-white/5 bg-white/5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Activity Title (Optional)</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Explainer Video, Audio Guide..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    title && <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-4 py-1 tracking-tight text-white">{title}</h3>
                )}
            </div>

            {editMode && (
                <div className="space-y-6 p-6 glass border-blue-500/10 mb-8 bg-blue-500/5">
                    <div className="flex items-center gap-4 mb-2">
                        <button
                            onClick={() => setSourceType("url")}
                            className={`px-4 py-2 text-[10px] uppercase font-black tracking-widest rounded-lg transition-all ${sourceType === "url" ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                        >
                            External URL
                        </button>
                        <button
                            onClick={() => setSourceType("upload")}
                            className={`px-4 py-2 text-[10px] uppercase font-black tracking-widest rounded-lg transition-all ${sourceType === "upload" ? "bg-blue-500 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                        >
                            Upload File
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sourceType === "url" ? (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Media URL</label>
                                <input
                                    type="text"
                                    value={url.startsWith("/") ? "" : url}
                                    onChange={(e) => onChange({ url: e.target.value })}
                                    placeholder="YouTube, Vimeo or static link"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500/50 focus:outline-none"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">File Manager</label>
                                <FileUpload
                                    currentUrl={url.startsWith("/") ? url : undefined}
                                    onUploadComplete={(newUrl) => onChange({ url: newUrl })}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Playback Limit (0 = Unlimited)</label>
                            <input
                                type="number"
                                value={maxPlays}
                                onChange={(e) => onChange({ config: { ...config, maxPlays: parseInt(e.target.value) || 0 } })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500/50 focus:outline-none h-11"
                            />
                            <p className="text-[10px] text-gray-500 uppercase leading-relaxed mt-2">Prevent content fatigue by limiting how many times a student can watch/listen.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Additional Options</label>
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2 h-11">
                                <input
                                    type="checkbox"
                                    id={`show-transcript-${title}`} // Unique ID
                                    checked={config.show_transcript !== false} // Default to true
                                    onChange={(e) => onChange({ config: { ...config, show_transcript: e.target.checked } })}
                                    className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                                />
                                <label htmlFor={`show-transcript-${title}`} className="text-sm text-gray-300 font-medium select-none cursor-pointer">
                                    Show Interactive Transcript
                                </label>
                            </div>
                            <p className="text-[10px] text-gray-500 uppercase leading-relaxed mt-2">Uncheck to hide transcription text (e.g. for listening tests).</p>
                        </div>
                    </div>

                    {/* Markers Editor */}
                    <div className="space-y-4 pt-6 border-t border-white/10">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Interactive Questions (Timestamps)</label>

                        <div className="space-y-2">
                            {(config.markers || []).map((marker, idx) => (
                                <div key={idx} className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                            {Math.floor(marker.timestamp / 60)}:{String(marker.timestamp % 60).padStart(2, '0')}
                                        </span>
                                        <input
                                            value={marker.question}
                                            onChange={(e) => {
                                                const newMarkers = [...(config.markers || [])];
                                                newMarkers[idx].question = e.target.value;
                                                onChange({ config: { ...config, markers: newMarkers } });
                                            }}
                                            className="text-sm bg-transparent border-b border-white/10 flex-1 focus:border-blue-500 outline-none"
                                        />
                                        <button
                                            onClick={() => {
                                                const newMarkers = [...(config.markers || [])];
                                                // Change order safely
                                                if (idx > 0) {
                                                    [newMarkers[idx], newMarkers[idx - 1]] = [newMarkers[idx - 1], newMarkers[idx]];
                                                    newMarkers[idx].timestamp = newMarkers[idx - 1].timestamp; // Keep timestamp (?) No, we sort by timestamp usually.
                                                    // Simpler delete logic only for now. Reordering happens automatically by sort on Add.
                                                }
                                            }}
                                            className="text-gray-500 hover:text-white hidden"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newMarkers = [...(config.markers || [])];
                                                newMarkers.splice(idx, 1);
                                                onChange({ config: { ...config, markers: newMarkers } });
                                            }}
                                            className="text-red-400 hover:text-red-300 p-1"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    {/* Options Management */}
                                    <div className="pl-14 space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Options</label>
                                        {marker.options.map((opt, optIdx) => (
                                            <div key={optIdx} className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name={`correct-${idx}`}
                                                    checked={marker.correctIndex === optIdx}
                                                    onChange={() => {
                                                        const newMarkers = [...(config.markers || [])];
                                                        newMarkers[idx].correctIndex = optIdx;
                                                        onChange({ config: { ...config, markers: newMarkers } });
                                                    }}
                                                    className="accent-green-500"
                                                />
                                                <input
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newMarkers = [...(config.markers || [])];
                                                        newMarkers[idx].options[optIdx] = e.target.value;
                                                        onChange({ config: { ...config, markers: newMarkers } });
                                                    }}
                                                    className={`text-xs bg-transparent border border-white/10 rounded px-2 py-1 flex-1 ${marker.correctIndex === optIdx ? 'text-green-400 border-green-500/30' : ''}`}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newMarkers = [...(config.markers || [])];
                                                        newMarkers[idx].options.splice(optIdx, 1);
                                                        if (newMarkers[idx].correctIndex >= optIdx) {
                                                            newMarkers[idx].correctIndex = Math.max(0, newMarkers[idx].correctIndex - 1);
                                                        }
                                                        onChange({ config: { ...config, markers: newMarkers } });
                                                    }}
                                                    className="text-gray-600 hover:text-red-400 px-2"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newMarkers = [...(config.markers || [])];
                                                newMarkers[idx].options.push(`Option ${newMarkers[idx].options.length + 1}`);
                                                onChange({ config: { ...config, markers: newMarkers } });
                                            }}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 uppercase font-bold tracking-widest mt-1"
                                        >
                                            + Add Option
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            <input
                                code-type="number"
                                placeholder="Sec"
                                id="new-marker-time"
                                className="col-span-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Question?"
                                id="new-marker-question"
                                className="col-span-2 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                            />
                            <button
                                onClick={() => {
                                    const timeInput = document.getElementById('new-marker-time') as HTMLInputElement;
                                    const questionInput = document.getElementById('new-marker-question') as HTMLInputElement;
                                    const time = parseInt(timeInput.value);
                                    const question = questionInput.value;

                                    if (time >= 0 && question) {
                                        const newMarker: Marker = {
                                            timestamp: time,
                                            question,
                                            options: ["Yes", "No"], // Default options
                                            correctIndex: 0
                                        };
                                        const newMarkers = [...(config.markers || []), newMarker].sort((a, b) => a.timestamp - b.timestamp);
                                        onChange({ config: { ...config, markers: newMarkers } });
                                        timeInput.value = "";
                                        questionInput.value = "";
                                    }
                                }}
                                className="col-span-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold uppercase"
                            >
                                Add
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500 uppercase leading-relaxed">
                            Questions will pause the video at the specified second. Only simple Yes/No questions supported currently.
                        </p>
                    </div>
                </div>
            )}

            <div className="relative">
                <MediaPlayer
                    src={displayUrl}
                    type={type}
                    transcription={transcription}
                    locked={isLocked}
                    onEnded={handleEnded}
                />

                {!editMode && maxPlays > 0 && (
                    <div className="mt-4 flex items-center justify-between px-4 py-2 glass bg-white/5 border-white/5 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase font-medium">Plays Remaining</span>
                        <span className={`text-sm font-bold ${maxPlays - localPlays <= 1 ? 'text-orange-400' : 'text-blue-400'}`}>
                            {Math.max(0, maxPlays - localPlays)} / {maxPlays}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
