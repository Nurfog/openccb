"use client";

import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";

interface Cue {
    start: number;
    end: number;
    text: string;
}

interface InteractiveTranscriptProps {
    cues: Cue[];
    currentTime: number;
    onSeek: (time: number) => void;
}

export default function InteractiveTranscript({ cues, currentTime, onSeek }: InteractiveTranscriptProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeCueRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active cue
    useEffect(() => {
        if (activeCueRef.current && scrollRef.current) {
            activeCueRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentTime]);

    const isCueActive = (cue: Cue) => {
        return currentTime >= cue.start && currentTime < cue.end;
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full glass-card overflow-hidden border-white/5 bg-black/20">
            <div className="p-6 border-b border-white/5 flex items-center gap-3 bg-white/5">
                <Clock className="w-4 h-4 text-blue-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Transcriptor Interactivo</h3>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
            >
                {cues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <span className="text-4xl mb-4">🤐</span>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">No hay transcripción disponible para este contenido</p>
                    </div>
                ) : (
                    cues.map((cue, index) => {
                        const active = isCueActive(cue);
                        return (
                            <div
                                key={index}
                                ref={active ? activeCueRef : null}
                                onClick={() => onSeek(cue.start)}
                                className={`group cursor-pointer p-4 rounded-2xl transition-all border ${active
                                        ? 'bg-blue-500/10 border-blue-500/30 text-white translate-x-1'
                                        : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:border-white/10'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <span className={`text-[10px] font-mono mt-1 ${active ? 'text-blue-400' : 'text-gray-600'}`}>
                                        {formatTime(cue.start)}
                                    </span>
                                    <p className={`text-sm leading-relaxed ${active ? 'font-medium' : ''}`}>
                                        {cue.text}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Haz clic en cualquier segmento para saltar</span>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                    <div className="w-1 h-1 rounded-full bg-blue-500/50"></div>
                    <div className="w-1 h-1 rounded-full bg-blue-500/20"></div>
                </div>
            </div>
        </div>
    );
}
