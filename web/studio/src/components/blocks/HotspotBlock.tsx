"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Search, MapPin, Plus, Trash2, Image as ImageIcon, Crosshair, Wand2, Loader2 } from "lucide-react";
import AssetPickerModal from "../AssetPickerModal";
import { Asset, getImageUrl, cmsApi, generateUUID } from "@/lib/api";

interface Hotspot {
    id: string;
    x: number;
    y: number;
    radius: number;
    label: string;
}

interface HotspotBlockProps {
    id: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    hotspots?: Hotspot[];
    editMode: boolean;
    courseId: string;
    lessonId: string;
    aiGenerationEnabled?: boolean;
    onChange: (updates: { title?: string; description?: string; imageUrl?: string; hotspots?: Hotspot[] }) => void;
}

export default function HotspotBlock({
    id,
    title,
    description,
    imageUrl,
    hotspots = [],
    editMode,
    courseId,
    lessonId,
    aiGenerationEnabled = true,
    onChange
}: HotspotBlockProps) {
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleGenerateAI = async () => {
        if (!aiGenerationEnabled) {
            alert("Hotspot está desactivado para esta organización.");
            return;
        }
        if (!imageUrl) return;
        setIsGenerating(true);
        try {
            const data = await cmsApi.generateHotspots(lessonId, { image_url: getImageUrl(imageUrl) });
            // Handle different response formats from AI
            const raw: any = data;
            let hotspotsArray = Array.isArray(raw) ? raw : (raw.hotspots || raw.items || []);
            
            if (!Array.isArray(hotspotsArray)) {
                throw new Error("La respuesta de la IA no es un array válido");
            }
            
            const newHotspots = hotspotsArray.map((h: any) => ({
                id: generateUUID(),
                x: typeof h.x === 'number' ? h.x : 50,
                y: typeof h.y === 'number' ? h.y : 50,
                radius: 5,
                label: h.label || 'Punto de interés'
            }));
            onChange({ hotspots: [...hotspots, ...newHotspots] });
        } catch (error) {
            console.error("AI Hotspot Generation failed:", error);
            alert("No se pudieron generar los puntos de interés con IA. Por favor, intenta de nuevo.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImageSelect = (asset: Asset) => {
        const url = asset.storage_path.replace('uploads/', '/assets/');
        onChange({ imageUrl: url });
        setIsAssetPickerOpen(false);
    };

    const handleImageClick = (e: React.MouseEvent) => {
        if (!editMode || !containerRef.current || !imageUrl) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newHotspot: Hotspot = {
            id: generateUUID(),
            x,
            y,
            radius: 5,
            label: "New Hotspot"
        };

        onChange({ hotspots: [...hotspots, newHotspot] });
    };

    const updateHotspot = (index: number, updates: Partial<Hotspot>) => {
        const newHotspots = [...hotspots];
        newHotspots[index] = { ...newHotspots[index], ...updates };
        onChange({ hotspots: newHotspots });
    };

    const removeHotspot = (index: number) => {
        const newHotspots = hotspots.filter((_, i) => i !== index);
        onChange({ hotspots: newHotspots });
    };

    if (!editMode) {
        return (
            <div className="space-y-6" id={id}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 shadow-inner">
                        <Search size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase transition-colors">{title || "Visual Scrutiny"}</h3>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] font-black">{description || "Identify the hidden visual nodes"}</p>
                    </div>
                </div>
                <div className="relative aspect-video rounded-[3rem] overflow-hidden border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/40 shadow-xl group/hsview">
                    {imageUrl ? (
                        <Image src={getImageUrl(imageUrl)} alt={title || ""} fill unoptimized className="object-cover opacity-60 grayscale group-hover/hsview:grayscale-0 transition-all duration-700" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 dark:text-gray-700 gap-4">
                            <ImageIcon size={48} className="opacity-20" />
                            <p className="text-[9px] font-black uppercase tracking-widest italic">Temporal image stream offline.</p>
                        </div>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-[4px] bg-slate-900/10 dark:bg-black/40 p-8 text-center group-hover/hsview:backdrop-blur-0 transition-all duration-700">
                        <div className="space-y-4 max-w-sm">
                            <Crosshair className="w-16 h-16 text-white/40 mx-auto animate-pulse" />
                            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] leading-relaxed">Structural Game Synchronization Pending<br /><span className="text-white/40 italic">(Activate Simulation Mode to Initialize)</span></p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" id={id}>
            <div className="p-10 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-10 rounded-[3rem] shadow-sm relative overflow-hidden group/hseditor shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover/hseditor:bg-amber-500/10 transition-colors"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Operational Protocol (Title)</label>
                            <input
                                type="text"
                                value={title || ""}
                                onChange={(e) => onChange({ title: e.target.value })}
                                placeholder="e.g. Parts of the Body..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                            />
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Tactical Instructions</label>
                                {imageUrl && (
                                    <button
                                        onClick={handleGenerateAI}
                                        disabled={isGenerating || !aiGenerationEnabled}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20 active:scale-95"
                                    >
                                        {isGenerating ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                                        {isGenerating ? "Analyzing..." : "Auto-Detect with AI"}
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                value={description || ""}
                                onChange={(e) => onChange({ description: e.target.value })}
                                placeholder="e.g. Find and click on the following items..."
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-slate-600 dark:text-gray-300 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 pl-1">Visual Baseline (Main Image)</label>
                        {!imageUrl ? (
                            <button
                                onClick={() => setIsAssetPickerOpen(true)}
                                className="w-full aspect-video rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-amber-500/50 hover:bg-white dark:hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center gap-4 group/imgup"
                            >
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 group-hover/imgup:bg-amber-500/10 transition-colors">
                                    <ImageIcon className="text-slate-300 dark:text-gray-600 group-hover/imgup:text-amber-600 transition-colors" size={32} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest group-hover/imgup:text-amber-700">Initialize Visual Stream</span>
                            </button>
                        ) : (
                            <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-slate-100 dark:border-white/10 group/imgpreview shadow-inner">
                                <Image src={getImageUrl(imageUrl)} alt="Hotspot base" fill unoptimized className="object-cover select-none" />
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/imgpreview:opacity-100 transition-all duration-500 flex items-center justify-center gap-4 backdrop-blur-sm">
                                    <button onClick={() => setIsAssetPickerOpen(true)} className="p-4 bg-white/10 hover:bg-white hover:text-slate-900 rounded-2xl text-white transition-all transform hover:scale-110"><ImageIcon size={20} /></button>
                                    <button onClick={() => onChange({ imageUrl: undefined })} className="p-4 bg-red-500/20 hover:bg-red-500 rounded-2xl text-white transition-all transform hover:scale-110"><Trash2 size={20} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {imageUrl && (
                    <div className="space-y-8 pt-10 border-t border-slate-50 dark:border-white/5">
                        <div className="flex items-center justify-between px-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 italic">Structural Node Mapping (Click Image Area)</label>
                            <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-100 dark:border-amber-500/20 shadow-inner uppercase tracking-widest">{hotspots.length} Nodes Synchronized</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-2">
                                <div
                                    ref={containerRef}
                                    onClick={handleImageClick}
                                    className="relative aspect-video rounded-[2.5rem] overflow-hidden border-2 border-slate-100 dark:border-white/10 cursor-crosshair bg-slate-50 dark:bg-black group/mpro shadow-2xl transition-all duration-500 hover:shadow-amber-500/10"
                                >
                                    <Image src={getImageUrl(imageUrl)} alt="Define Hotspots" fill unoptimized className="object-cover select-none group-hover/mpro:opacity-80 transition-opacity" />
                                    {hotspots.map((h, hidx) => (
                                        <div
                                            key={h.id}
                                            className="absolute group/pin z-20"
                                            style={{
                                                left: `${h.x}%`,
                                                top: `${h.y}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        >
                                            <div
                                                className="bg-amber-500/20 border-2 border-amber-500 dark:border-amber-400 rounded-full flex items-center justify-center relative transition-all duration-500 hover:scale-125 hover:bg-amber-500/40"
                                                style={{
                                                    width: `${h.radius * 2.5}vw`,
                                                    height: `${h.radius * 2.5}vw`,
                                                    maxWidth: '120px',
                                                    maxHeight: '120px',
                                                    minWidth: '40px',
                                                    minHeight: '40px'
                                                }}
                                            >
                                                <div className="bg-amber-600 dark:bg-amber-500 rounded-full p-2 text-white shadow-2xl ring-4 ring-amber-500/20">
                                                    <Crosshair size={14} strokeWidth={3} className="group-hover/pin:rotate-90 transition-transform duration-500" />
                                                </div>
                                                <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-tight whitespace-nowrap opacity-0 group-hover/pin:opacity-100 transition-all transform translate-y-2 group-hover/pin:translate-y-0 shadow-2xl z-50">
                                                    NODE #{hidx + 1}: {h.label}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-3">
                                {hotspots.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] space-y-4">
                                        <div className="p-4 bg-white dark:bg-white/5 rounded-2xl shadow-inner italic">
                                            <Plus className="text-slate-300 dark:text-gray-700" size={32} />
                                        </div>
                                        <p className="text-[10px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-widest">Execute visual contact on the map area to generate nodes.</p>
                                    </div>
                                ) : (
                                    hotspots.map((h, idx) => (
                                        <div key={h.id} className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[1.5rem] space-y-5 animate-in fade-in slide-in-from-right-4 duration-500 group/hscard hover:border-amber-500/30 transition-all shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg">#{idx + 1}</span>
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] italic">Structural Node</span>
                                                </div>
                                                <button onClick={() => removeHotspot(idx)} className="p-2 bg-red-50 dark:bg-red-500/5 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all active:scale-90"><Trash2 size={14} /></button>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-gray-600 pl-1">Identification Label</label>
                                                    <input
                                                        type="text"
                                                        value={h.label}
                                                        onChange={(e) => updateHotspot(idx, { label: e.target.value })}
                                                        placeholder="Item name..."
                                                        className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-tight text-slate-800 dark:text-white focus:ring-4 focus:ring-amber-500/10 outline-none transition-all shadow-inner"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between pl-1">
                                                        <label className="text-[9px] font-black uppercase text-slate-400 dark:text-gray-600">Influence Radius</label>
                                                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 font-mono">{h.radius}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="2"
                                                        max="15"
                                                        value={h.radius}
                                                        onChange={(e) => updateHotspot(idx, { radius: parseInt(e.target.value) })}
                                                        className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AssetPickerModal
                isOpen={isAssetPickerOpen}
                onClose={() => setIsAssetPickerOpen(false)}
                courseId={courseId}
                filterType="image"
                onSelect={handleImageSelect}
            />
        </div >
    );
}
