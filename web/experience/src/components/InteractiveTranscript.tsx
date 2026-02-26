"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface Cue {
    start: number;
    end: number;
    text: string;
}

interface InteractiveTranscriptProps {
    transcription: {
        en?: string;
        es?: string;
        cues?: Cue[];
    };
    currentTime: number;
    onSeek: (time: number) => void;
}

export default function InteractiveTranscript({ transcription, currentTime, onSeek }: InteractiveTranscriptProps) {
    const [lang, setLang] = useState<'en' | 'es'>('es'); // Default to Spanish as per Experience portal target
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeCueRef = useRef<HTMLDivElement>(null);

    const cues = transcription.cues || [];

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
        <div className="flex flex-col h-full glass-card overflow-hidden border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-black/20">
            <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/[0.02] dark:bg-white/5">
                <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Transcripción</h3>
                </div>
                <div className="flex bg-white/40 dark:bg-black/40 rounded-lg p-1 border border-black/5 dark:border-white/5">
                    <button
                        onClick={() => setLang('en')}
                        aria-pressed={lang === 'en'}
                        className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        EN
                    </button>
                    <button
                        onClick={() => setLang('es')}
                        aria-pressed={lang === 'es'}
                        className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${lang === 'es' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        ES
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                role="region"
                aria-label="Contenido de la transcripción"
                aria-live="polite"
                className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
            >
                {cues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <span className="text-4xl mb-4">🤐</span>
                        <p className="text-xs text-gray-600 dark:text-gray-500 uppercase tracking-widest font-bold">No hay transcripción disponible</p>
                    </div>
                ) : (
                    cues.map((cue, index) => {
                        const active = isCueActive(cue);
                        // In a more advanced implementation, we'd have translated cues.
                        // For now, if lang is 'es' and we have a full translation but no cue-level translation,
                        // we'd ideally align them. To keep it simple and working:
                        return (
                            <div
                                key={index}
                                ref={active ? activeCueRef : null}
                                role="button"
                                tabIndex={0}
                                aria-label={`${formatTime(cue.start)}: ${cue.text}`}
                                aria-current={active ? "true" : undefined}
                                onClick={() => onSeek(cue.start)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        onSeek(cue.start);
                                    }
                                }}
                                className={`group cursor-pointer p-4 rounded-2xl transition-all border ${active
                                    ? 'bg-blue-600/10 dark:bg-blue-500/10 border-blue-600/20 dark:border-blue-500/30 text-gray-900 dark:text-white translate-x-1'
                                    : 'bg-black/5 dark:bg-white/5 border-transparent text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/5 dark:hover:border-white/10'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <span className={`text-[10px] font-mono mt-1 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`} aria-hidden="true">
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

                {lang === 'es' && transcription.es && cues.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/10">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4">Traducción Completa (Beta)</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic">
                            {transcription.es}
                        </p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-black/[0.02] dark:bg-white/5 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                <span className="text-[8px] font-bold text-gray-600 dark:text-gray-500 uppercase tracking-widest">Haz clic para saltar al tiempo</span>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                    <div className="w-1 h-1 rounded-full bg-blue-500/50"></div>
                    <div className="w-1 h-1 rounded-full bg-blue-500/20"></div>
                </div>
            </div>
        </div>
    );
}
