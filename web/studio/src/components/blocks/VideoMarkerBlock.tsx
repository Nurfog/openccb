"use client";

import { useState } from "react";
import { Clock, Plus, Trash2, Play, AlertCircle } from "lucide-react";
import MediaPlayer from "../MediaPlayer";
import FileUpload from "../FileUpload";
import { getImageUrl } from "@/lib/api";

interface VideoMarker {
    timestamp: number;
    question: string;
    options: string[];
    correctIndex: number;
}

interface VideoMarkerBlockProps {
    title: string;
    videoUrl: string;
    markers: VideoMarker[];
    onChange: (updates: { title?: string; url?: string; markers?: VideoMarker[] }) => void;
    editMode: boolean;
    isGraded?: boolean;
}

export default function VideoMarkerBlock({
    title,
    videoUrl,
    markers,
    onChange,
    editMode,
    isGraded
}: VideoMarkerBlockProps) {
    const [currentTime, setCurrentTime] = useState(0);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [sourceType, setSourceType] = useState<"url" | "upload">(
        (videoUrl.startsWith("/assets/") || videoUrl.includes("/assets/") || videoUrl.startsWith("s3://") || /^org\/.+/.test(videoUrl))
            ? "upload"
            : "url"
    );

    const displayVideoUrl = getImageUrl(videoUrl);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const parseTime = (timeStr: string): number => {
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return 0;
    };

    const addMarker = () => {
        if (!videoUrl) {
            alert("Primero agrega o sube un video para poder insertar marcadores.");
            return;
        }

        const newMarker: VideoMarker = {
            timestamp: currentTime,
            question: "Nueva pregunta",
            options: ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
            correctIndex: 0
        };
        onChange({ markers: [...markers, newMarker] });
        setEditingIndex(markers.length);
    };

    const updateMarker = (index: number, updates: Partial<VideoMarker>) => {
        const updated = markers.map((m, i) => i === index ? { ...m, ...updates } : m);
        onChange({ markers: updated });
    };

    const deleteMarker = (index: number) => {
        onChange({ markers: markers.filter((_, i) => i !== index) });
        if (editingIndex === index) setEditingIndex(null);
    };

    const updateOption = (markerIndex: number, optionIndex: number, value: string) => {
        const marker = markers[markerIndex];
        const newOptions = [...marker.options];
        newOptions[optionIndex] = value;
        updateMarker(markerIndex, { options: newOptions });
    };

    if (!editMode) {
        return (
            <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">
                    {title || "Interactive Temporal Nodes"}
                </h3>
                <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden group/vm">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover/vm:bg-indigo-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 mb-8 relative z-10">
                        <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Interactive Stream</p>
                            <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-widest">{markers.length} SYNC MARKERS DETECTED</p>
                        </div>
                    </div>
                    <div className="space-y-3 relative z-10">
                        {markers.map((marker, idx) => (
                            <div key={idx} className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-gray-400 font-black uppercase tracking-wider bg-slate-50/50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-black/40 px-2 py-1 rounded-lg border border-slate-100 dark:border-white/10 shadow-sm">{formatTime(marker.timestamp)}</span>
                                <span className="opacity-20">/</span>
                                <span className="truncate italic">{marker.question}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Title Editor */}
            <div className="space-y-4 p-8 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] mb-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40"></div>
                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Activity Title (Optional)</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-tight focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm"
                    placeholder="e.g. Masterclass Stream, Acoustic Analysis..."
                />
            </div>

            <div className="space-y-6 p-8 bg-white dark:bg-white/5 border border-indigo-500/10 dark:border-indigo-500/20 rounded-[2rem] shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSourceType("url")}
                        className={`px-6 py-2 text-[10px] uppercase font-black tracking-[0.2em] rounded-xl transition-all border ${sourceType === "url" ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30" : "bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 border-slate-100 hover:border-slate-200"}`}
                    >
                        External Stream
                    </button>
                    <button
                        onClick={() => setSourceType("upload")}
                        className={`px-6 py-2 text-[10px] uppercase font-black tracking-[0.2em] rounded-xl transition-all border ${sourceType === "upload" ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30" : "bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 border-slate-100 hover:border-slate-200"}`}
                    >
                        Direct Asset
                    </button>
                </div>

                {sourceType === "url" ? (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Video Source</label>
                        <input
                            type="text"
                            value={videoUrl.startsWith("/") ? "" : videoUrl}
                            onChange={(e) => onChange({ url: e.target.value })}
                            placeholder="YouTube, Vimeo or direct video URL"
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-inner"
                        />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Video Upload</label>
                        <FileUpload
                            currentUrl={videoUrl.startsWith("/") ? videoUrl : undefined}
                            accept="video/*"
                            onUploadComplete={(newUrl) => onChange({ url: newUrl })}
                        />
                    </div>
                )}
            </div>

            {/* Video Preview with Timeline */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-[3rem] space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex items-center justify-between relative z-10 px-2">
                    <h4 className="text-[10px] font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-widest italic">
                        <Play size={16} className="text-indigo-600 dark:text-indigo-400" />
                        Temporal Scrutiny
                    </h4>
                    <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-black/40 px-3 py-1 rounded-full border border-indigo-100 dark:border-white/10">{formatTime(currentTime)}</span>
                </div>

                <div className="rounded-[2rem] overflow-hidden border border-slate-100 dark:border-white/10 shadow-2xl relative z-10">
                    <MediaPlayer
                        src={displayVideoUrl}
                        type="video"
                        isGraded={isGraded}
                        showInteractive={false}
                        onTimeUpdate={setCurrentTime}
                    />
                </div>

                <button
                    onClick={addMarker}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-500/40 active:scale-95 group relative z-10"
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                    Inject Marker at {formatTime(currentTime)}
                </button>
            </div>

            {/* Markers List */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-gray-500 flex items-center gap-3 uppercase tracking-[0.2em]">
                        <Clock size={16} className="text-amber-500" />
                        Interactive Sequence ({markers.length})
                    </h4>
                </div>

                {markers.length === 0 && (
                    <div className="bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 p-16 rounded-[3rem] text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-slate-300 dark:text-gray-700 mx-auto opacity-40" />
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">No interactive nodes detected</p>
                            <p className="text-[9px] text-slate-300 dark:text-gray-600 uppercase font-black italic">Initiate playback and execute &quot;Inject Marker&quot;</p>
                        </div>
                    </div>
                )}

                {markers.map((marker, idx) => (
                    <div key={idx} className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] shadow-sm overflow-hidden group/mkr transition-all duration-500 hover:shadow-xl hover:border-indigo-500/20">
                        <div className="p-6 border-l-[6px] border-indigo-600 flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-500/20 shadow-inner italic">
                                        SYNC {formatTime(marker.timestamp)}
                                    </span>
                                    <button
                                        onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                                        className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {editingIndex === idx ? "COLLAPSE" : "SCRUTINIZE"}
                                    </button>
                                </div>
                                <button
                                    onClick={() => deleteMarker(idx)}
                                    className="p-3 bg-red-50 dark:bg-red-500/5 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all active:scale-90"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {editingIndex === idx ? (
                                <div className="space-y-6 pt-6 border-t border-slate-50 dark:border-white/5 animate-in slide-in-from-top-2 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Timestamp Editor */}
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Temporal Alignment (MM:SS)</label>
                                            <input
                                                type="text"
                                                value={formatTime(marker.timestamp)}
                                                onChange={(e) => updateMarker(idx, { timestamp: parseTime(e.target.value) })}
                                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-black font-mono text-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                            />
                                        </div>

                                        {/* Question Editor */}
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Inquiry Scoped Prompt</label>
                                            <input
                                                type="text"
                                                value={marker.question}
                                                onChange={(e) => updateMarker(idx, { question: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                                placeholder="¿Critical concept?"
                                            />
                                        </div>
                                    </div>

                                    {/* Options Editor */}
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest pl-1">Probability Vectors (Options)</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {marker.options.map((option, optIdx) => (
                                                <div key={optIdx} className="flex items-center gap-3 bg-slate-50 dark:bg-black/20 p-3 rounded-[1.5rem] border border-slate-100 dark:border-white/10 group/opt">
                                                    <input
                                                        type="radio"
                                                        name={`correct-${idx}`}
                                                        checked={marker.correctIndex === optIdx}
                                                        onChange={() => updateMarker(idx, { correctIndex: optIdx })}
                                                        className="w-5 h-5 text-green-600 dark:text-green-500 bg-white dark:bg-black/40 border-slate-300 dark:border-white/10 focus:ring-green-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={option}
                                                        onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                                                        className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-slate-700 dark:text-white focus:ring-0 outline-none"
                                                        placeholder={`Vector ${optIdx + 1}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[9px] text-slate-400 dark:text-gray-600 uppercase font-black italic pl-1 italic">Identify the absolute truth vector via the terminal radio toggle.</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xl font-black text-slate-800 dark:text-gray-200 tracking-tight uppercase italic">{marker.question}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
