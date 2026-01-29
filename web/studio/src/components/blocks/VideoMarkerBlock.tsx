"use client";

import { useState } from "react";
import { Clock, Plus, Trash2, Play, AlertCircle } from "lucide-react";
import MediaPlayer from "../MediaPlayer";

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
    onChange: (updates: { title?: string; markers?: VideoMarker[] }) => void;
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
            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                    {title || "Video con Marcadores"}
                </h3>
                <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Video Interactivo</p>
                            <p className="text-xs text-gray-500">{markers.length} marcadores configurados</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {markers.map((marker, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="font-mono text-indigo-400">{formatTime(marker.timestamp)}</span>
                                <span>→</span>
                                <span className="truncate">{marker.question}</span>
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
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Título del Bloque</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ej: Video Tutorial - Introducción"
                />
            </div>

            {/* Video Preview with Timeline */}
            <div className="glass-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Play size={16} className="text-indigo-400" />
                        Vista Previa del Video
                    </h4>
                    <span className="text-xs font-mono text-gray-500">{formatTime(currentTime)}</span>
                </div>

                <div className="rounded-lg overflow-hidden">
                    <MediaPlayer
                        src={videoUrl}
                        type="video"
                        isGraded={isGraded}
                        showInteractive={false} // Interactive markers are separate here
                    />
                </div>

                <button
                    onClick={addMarker}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                >
                    <Plus size={16} />
                    Agregar Marcador en {formatTime(currentTime)}
                </button>
            </div>

            {/* Markers List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Clock size={16} className="text-amber-400" />
                        Marcadores ({markers.length})
                    </h4>
                </div>

                {markers.length === 0 && (
                    <div className="glass-card p-8 text-center border-dashed">
                        <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No hay marcadores configurados.</p>
                        <p className="text-xs text-gray-600 mt-1">Reproduce el video y haz clic en &quot;Agregar Marcador&quot;</p>
                    </div>
                )}

                {markers.map((marker, idx) => (
                    <div key={idx} className="glass-card p-4 space-y-3 border-l-4 border-indigo-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                                    {formatTime(marker.timestamp)}
                                </span>
                                <button
                                    onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                                    className="text-xs text-gray-500 hover:text-white transition-colors"
                                >
                                    {editingIndex === idx ? "Colapsar" : "Editar"}
                                </button>
                            </div>
                            <button
                                onClick={() => deleteMarker(idx)}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {editingIndex === idx ? (
                            <div className="space-y-3 pt-2 border-t border-white/5">
                                {/* Timestamp Editor */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Timestamp (MM:SS)</label>
                                    <input
                                        type="text"
                                        value={formatTime(marker.timestamp)}
                                        onChange={(e) => updateMarker(idx, { timestamp: parseTime(e.target.value) })}
                                        className="w-full bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Question Editor */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Pregunta</label>
                                    <input
                                        type="text"
                                        value={marker.question}
                                        onChange={(e) => updateMarker(idx, { question: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="¿Qué concepto se explicó?"
                                    />
                                </div>

                                {/* Options Editor */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Opciones de Respuesta</label>
                                    {marker.options.map((option, optIdx) => (
                                        <div key={optIdx} className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name={`correct-${idx}`}
                                                checked={marker.correctIndex === optIdx}
                                                onChange={() => updateMarker(idx, { correctIndex: optIdx })}
                                                className="w-4 h-4 text-green-500"
                                            />
                                            <input
                                                type="text"
                                                value={option}
                                                onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                                                className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                                placeholder={`Opción ${optIdx + 1}`}
                                            />
                                        </div>
                                    ))}
                                    <p className="text-[10px] text-gray-600 italic">Selecciona el radio button de la respuesta correcta</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 truncate">{marker.question}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
