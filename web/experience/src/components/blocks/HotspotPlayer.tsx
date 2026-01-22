"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Search, CheckCircle, XCircle, MousePointer2 } from "lucide-react";
import { getImageUrl } from "@/lib/api";

interface Hotspot {
    id: string;
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    radius: number; // Percentage radius
    label: string;
}

interface HotspotPlayerProps {
    title: string;
    description: string;
    imageUrl: string;
    hotspots: Hotspot[];
    onComplete: (score: number) => void;
}

export default function HotspotPlayer({
    title,
    description,
    imageUrl,
    hotspots,
    onComplete
}: HotspotPlayerProps) {
    const [found, setFound] = useState<string[]>([]);
    const [mistakes, setMistakes] = useState<{ x: number, y: number }[]>([]);
    const [status, setStatus] = useState<"playing" | "success">("playing");
    const containerRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (status === "success" || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Check if any hotspot was clicked
        const clickedHotspot = hotspots.find(h => {
            const distance = Math.sqrt(Math.pow(x - h.x, 2) + Math.pow(y - h.y, 2));
            return distance <= h.radius;
        });

        if (clickedHotspot) {
            if (!found.includes(clickedHotspot.id)) {
                const newFound = [...found, clickedHotspot.id];
                setFound(newFound);

                if (newFound.length === hotspots.length) {
                    setStatus("success");
                    onComplete(1.0);
                }
            }
        } else {
            // Mistake
            const newMistake = { x, y };
            setMistakes(prev => [...prev.slice(-2), newMistake]);
            setTimeout(() => {
                setMistakes(prev => prev.filter(m => m !== newMistake));
            }, 1000);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in zoom-in duration-700">
            <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-amber-400 text-black shadow-lg shadow-amber-400/20">
                            <Search size={24} strokeWidth={3} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
                            <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">{description}</p>
                        </div>
                    </div>
                    <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-black">
                        {found.length} / {hotspots.length} FOUND
                    </div>
                </div>
            </div>

            <div
                ref={containerRef}
                onClick={handleClick}
                className="relative aspect-video rounded-3xl overflow-hidden border-4 border-white/10 bg-black cursor-crosshair group select-none shadow-2xl"
            >
                <Image
                    src={getImageUrl(imageUrl)}
                    alt={title}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />

                {/* Overlay found hotspots */}
                {hotspots.map(h => (
                    found.includes(h.id) && (
                        <div
                            key={h.id}
                            className="absolute bg-green-500/30 border-2 border-green-400 rounded-full flex items-center justify-center animate-in zoom-in duration-300 pointer-events-none"
                            style={{
                                left: `${h.x}%`,
                                top: `${h.y}%`,
                                width: `${h.radius * 2}%`,
                                height: `${h.radius * 2 * (16 / 9)}%`, // Basic aspect ratio compensation
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            <div className="bg-green-500 rounded-full p-1 shadow-lg text-white">
                                <CheckCircle size={16} strokeWidth={3} />
                            </div>
                        </div>
                    )
                ))}

                {/* Mistake indicators */}
                {mistakes.map((m, idx) => (
                    <div
                        key={idx}
                        className="absolute text-red-500 animate-out fade-out duration-1000 pointer-events-none"
                        style={{ left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                        <XCircle size={32} strokeWidth={3} />
                    </div>
                ))}

                {/* Success Message */}
                {status === "success" && (
                    <div className="absolute inset-0 bg-indigo-600/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-500 z-20">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl animate-bounce">
                            <CheckCircle className="text-indigo-600" size={56} strokeWidth={3} />
                        </div>
                        <h3 className="text-4xl font-black text-white tracking-tighter mb-2">AMAZING!</h3>
                        <p className="text-indigo-100 font-bold uppercase tracking-[0.3em]">You found them all!</p>
                    </div>
                )}
            </div>

            {/* Target List */}
            <div className="flex flex-wrap gap-2">
                {hotspots.map(h => (
                    <div
                        key={h.id}
                        className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center gap-2 ${found.includes(h.id)
                            ? "bg-green-500 text-white translate-y-[-2px] shadow-lg shadow-green-500/20"
                            : "bg-white/5 text-gray-500 border border-white/5"
                            }`}
                    >
                        {found.includes(h.id) ? <CheckCircle size={14} /> : <div className="w-1 h-1 rounded-full bg-current" />}
                        {h.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
