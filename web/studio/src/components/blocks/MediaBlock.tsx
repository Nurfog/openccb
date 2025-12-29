"use client";

import { useState } from "react";
import MediaPlayer from "../MediaPlayer";
import FileUpload from "../FileUpload";

interface MediaBlockProps {
    id: string;
    title?: string;
    url: string;
    type: 'video' | 'audio';
    config: {
        maxPlays?: number;
        currentPlays?: number;
    };
    editMode: boolean;
    onChange: (updates: { title?: string; url?: string; config?: { maxPlays?: number; currentPlays?: number } }) => void;
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
    const displayUrl = url.startsWith("/") ? `http://localhost:3001${url}` : url;

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
