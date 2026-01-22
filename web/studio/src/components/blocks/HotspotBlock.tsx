"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Search, MapPin, Plus, Trash2, Image as ImageIcon, Crosshair } from "lucide-react";
import AssetPickerModal from "../AssetPickerModal";
import { Asset, getImageUrl } from "@/lib/api";

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
    onChange
}: HotspotBlockProps) {
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

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
            id: Math.random().toString(36).substr(2, 9),
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
            <div className="space-y-4" id={id}>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
                        <Search size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white transition-colors">{title || "Image Hunt"}</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-black">{description || "Find the hidden spots!"}</p>
                    </div>
                </div>
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/5 bg-black/40">
                    {imageUrl ? (
                        <Image src={getImageUrl(imageUrl)} alt={title || ""} fill unoptimized className="object-cover opacity-50" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600 italic text-sm">No image provided.</div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="text-center space-y-2">
                            <Crosshair className="w-12 h-12 text-white/20 mx-auto" />
                            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Interactive Game Preview (Switch to Student View to Play)</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" id={id}>
            <div className="p-6 glass border-white/5 bg-white/5 space-y-6 rounded-3xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Game Title</label>
                            <input
                                type="text"
                                value={title || ""}
                                onChange={(e) => onChange({ title: e.target.value })}
                                placeholder="e.g. Parts of the Body..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold focus:border-amber-500/50 focus:outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Student Instructions</label>
                            <input
                                type="text"
                                value={description || ""}
                                onChange={(e) => onChange({ description: e.target.value })}
                                placeholder="e.g. Find and click on the following items..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-amber-500/50 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Game Image</label>
                        {!imageUrl ? (
                            <button
                                onClick={() => setIsAssetPickerOpen(true)}
                                className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center gap-2 group"
                            >
                                <ImageIcon className="text-gray-600 group-hover:text-amber-500 transition-colors" size={32} />
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-amber-300">Choose Image</span>
                            </button>
                        ) : (
                            <div className="relative aspect-video rounded-2xl overflow-hidden group">
                                <Image src={getImageUrl(imageUrl)} alt="Hotspot base" fill unoptimized className="object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <button onClick={() => setIsAssetPickerOpen(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"><ImageIcon size={18} /></button>
                                    <button onClick={() => onChange({ imageUrl: undefined })} className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-400 transition-all"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {imageUrl && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Define Hotspots (Click on the image below)</label>
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded uppercase tracking-widest">{hotspots.length} Defined</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <div
                                    ref={containerRef}
                                    onClick={handleImageClick}
                                    className="relative aspect-video rounded-2xl overflow-hidden border-2 border-white/10 cursor-crosshair shadow-2xl"
                                >
                                    <Image src={getImageUrl(imageUrl)} alt="Define Hotspots" fill unoptimized className="object-cover select-none" />
                                    {hotspots.map((h) => (
                                        <div
                                            key={h.id}
                                            className="absolute group/pin"
                                            style={{
                                                left: `${h.x}%`,
                                                top: `${h.y}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        >
                                            <div
                                                className="bg-amber-500/30 border-2 border-amber-400 rounded-full flex items-center justify-center relative transition-transform hover:scale-110"
                                                style={{
                                                    width: `${h.radius * 2}vw`,
                                                    height: `${h.radius * 2}vw`,
                                                    maxWidth: '100px',
                                                    maxHeight: '100px'
                                                }}
                                            >
                                                <div className="bg-amber-500 rounded-full p-1 text-black shadow-lg">
                                                    <MapPin size={12} strokeWidth={3} />
                                                </div>
                                                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover/pin:opacity-100 transition-opacity">
                                                    {h.label}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {hotspots.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-white/5 rounded-2xl">
                                        <Plus className="text-gray-700 mb-2" size={24} />
                                        <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Click on the image to add hotspots</p>
                                    </div>
                                ) : (
                                    hotspots.map((h, idx) => (
                                        <div key={h.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Hotspot #{idx + 1}</span>
                                                <button onClick={() => removeHotspot(idx)} className="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors"><Trash2 size={12} /></button>
                                            </div>
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={h.label}
                                                    onChange={(e) => updateHotspot(idx, { label: e.target.value })}
                                                    placeholder="Item name..."
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-amber-500/50 focus:outline-none"
                                                />
                                                <div className="flex items-center gap-3">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Radius</label>
                                                    <input
                                                        type="range"
                                                        min="2"
                                                        max="15"
                                                        value={h.radius}
                                                        onChange={(e) => updateHotspot(idx, { radius: parseInt(e.target.value) })}
                                                        className="flex-1 accent-amber-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <span className="text-[10px] font-bold text-gray-400 w-6">{h.radius}%</span>
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
