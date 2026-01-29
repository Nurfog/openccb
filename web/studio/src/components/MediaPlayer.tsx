"use client";

import { useEffect, useRef, useState } from "react";

interface MediaPlayerProps {
    src: string | null;
    type: string; // "video" | "audio"
    transcription?: {
        en?: string;
        es?: string;
        cues?: { start: number; end: number; text: string }[];
        cues_en?: { start: number; end: number; text: string }[];
    } | null;
    locked?: boolean;
    onEnded?: () => void;
    isGraded?: boolean;
    showInteractive?: boolean;
    onTimeUpdate?: (time: number) => void;
}

export default function MediaPlayer({ src, type, transcription, locked, onEnded, isGraded, showInteractive = true, onTimeUpdate }: MediaPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentCaption, setCurrentCaption] = useState("");
    const [language, setLanguage] = useState<"en" | "es">("en");

    const sidebarRef = useRef<HTMLDivElement>(null);
    const cueRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Hide everything if graded activity or explicitely disabled
    const shouldShowTranscription = transcription && !locked && !isGraded && showInteractive;

    // Determine which cues to use based on language
    const getActiveCues = () => {
        if (language === "en" && transcription?.cues_en) return transcription.cues_en;
        return transcription?.cues || [];
    };

    const activeCues = getActiveCues();

    // Auto-scroll logic
    useEffect(() => {
        if (!shouldShowTranscription) return;

        const activeIdx = activeCues.findIndex(cue =>
            currentTime >= cue.start && currentTime <= cue.end
        );

        if (activeIdx !== -1 && cueRefs.current[activeIdx] && sidebarRef.current) {
            const activeElem = cueRefs.current[activeIdx];
            const container = sidebarRef.current;

            // Center the active element in the visible area
            const offsetTop = activeElem.offsetTop;
            const elementHeight = activeElem.offsetHeight;
            const containerHeight = container.clientHeight;
            const centerScroll = offsetTop - (containerHeight / 2) + (elementHeight / 2);

            container.scrollTo({
                top: centerScroll,
                behavior: 'smooth'
            });
        }
    }, [currentTime, activeCues, shouldShowTranscription]);

    useEffect(() => {
        const media = type === "video" ? videoRef.current : audioRef.current;
        if (!media) return;

        const handleTimeUpdate = () => {
            const time = media.currentTime;
            setCurrentTime(time);
            if (onTimeUpdate) onTimeUpdate(time);

            // Re-calculate active cues inside to avoid stale closures in handleTimeUpdate
            // or just use the one from the outer scope if dependencies are correct
            const cuesToSearch = (language === "en" && transcription?.cues_en) ? transcription.cues_en : (transcription?.cues || []);

            if (cuesToSearch.length > 0) {
                const activeCue = cuesToSearch.find(cue =>
                    time >= cue.start && time <= cue.end
                );
                setCurrentCaption(activeCue?.text || "");
            }
        };

        const handleEnded = () => {
            if (onEnded) onEnded();
        };

        media.addEventListener("timeupdate", handleTimeUpdate);
        media.addEventListener("ended", handleEnded);
        return () => {
            media.removeEventListener("timeupdate", handleTimeUpdate);
            media.removeEventListener("ended", handleEnded);
        };
    }, [type, transcription, onEnded, onTimeUpdate, language]);

    const handleSeek = (time: number) => {
        const media = type === "video" ? videoRef.current : audioRef.current;
        if (media) {
            media.currentTime = time;
            media.play();
        }
    };

    if (!src) {
        return (
            <div className="glass aspect-video flex flex-col items-center justify-center border-dashed border-2 border-white/10 text-gray-500">
                <span className="text-4xl mb-2">🎞️</span>
                <p>No media file linked yet.</p>
            </div>
        );
    }

    const isYouTube = src.includes("youtube.com") || src.includes("youtu.be");
    const isVimeo = src.includes("vimeo.com");

    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const getVimeoId = (url: string) => {
        const match = url.match(/vimeo.com\/(\d+)/);
        return match ? match[1] : null;
    };

    const renderMedia = () => {
        if (isYouTube || isVimeo) {
            let embedUrl = "";
            if (isYouTube) {
                const id = getYouTubeId(src);
                embedUrl = `https://www.youtube.com/embed/${id}`;
            } else {
                const id = getVimeoId(src);
                embedUrl = `https://player.vimeo.com/video/${id}`;
            }

            return (
                <div className={`glass overflow-hidden border border-white/10 aspect-video ${locked ? 'blur-xl grayscale' : ''}`}>
                    <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            );
        }

        return (
            <div className={`relative glass overflow-hidden border border-white/10 ${locked ? 'blur-xl grayscale' : ''}`}>
                {type === "video" ? (
                    <video
                        ref={videoRef}
                        src={src}
                        className="w-full aspect-video object-cover"
                        controls={!locked}
                    />
                ) : (
                    <div className="p-12 flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                        <audio ref={audioRef} src={src} controls={!locked} className="w-full max-w-md" />
                        <span className="text-xs text-gray-400 mt-6 uppercase tracking-[0.2em] font-medium">Audio Experience</span>
                    </div>
                )}

                {/* Caption Overlay */}
                {currentCaption && type === "video" && !locked && (
                    <div className="absolute bottom-16 left-0 right-0 text-center px-8 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <span className="bg-black/80 text-white px-4 py-2 rounded-xl text-lg font-medium backdrop-blur-md border border-white/20 shadow-2xl">
                            {currentCaption}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto">
            {/* Player + Sidebar Grid */}
            <div className={`grid grid-cols-1 ${shouldShowTranscription && activeCues.length > 0 ? 'xl:grid-cols-12' : ''} gap-6 w-full`}>
                {/* Video Player Container */}
                <div className={`${shouldShowTranscription && activeCues.length > 0 ? 'xl:col-span-8' : 'w-full'}`}>
                    <div className="bg-[#0a0c10] rounded-[24px] xl:rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative">
                        <div className="relative bg-black flex items-center justify-center min-h-[200px]">
                            <div className="w-full h-full">
                                {renderMedia()}
                            </div>

                            {locked && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-10 text-center p-8">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                                        <span className="text-4xl text-white/50">🔒</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-wider">Playback Limited</h3>
                                    <p className="text-gray-400 max-w-xs text-sm leading-relaxed">This exclusive content is protected and can only be viewed once.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Interactive Sidebar (Separate Column) */}
                {shouldShowTranscription && activeCues.length > 0 && (
                    <div className="xl:col-span-4">
                        <div className="bg-[#0a0c10] rounded-[24px] xl:rounded-[32px] border border-white/5 shadow-2xl flex flex-col max-h-[500px]">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.03]">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Interactive</h4>
                                </div>
                                <div className="flex bg-black/20 rounded-lg p-1 border border-white/5">
                                    <button
                                        onClick={() => setLanguage("en")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "en" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:text-white"}`}
                                    >EN</button>
                                    <button
                                        onClick={() => setLanguage("es")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "es" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:text-white"}`}
                                    >ES</button>
                                </div>
                            </div>
                            <div
                                ref={sidebarRef}
                                className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-black/10"
                            >
                                {activeCues.map((cue, idx) => (
                                    <button
                                        key={idx}
                                        ref={(el) => { cueRefs.current[idx] = el; }}
                                        onClick={() => handleSeek(cue.start)}
                                        className={`text-left p-2.5 rounded-lg transition-all border group relative w-full ${currentTime >= cue.start && currentTime <= cue.end
                                            ? "bg-blue-600/20 border-blue-500/40 text-white shadow-[0_2px_12px_rgba(59,130,246,0.15)]"
                                            : "bg-white/[0.03] border-white/5 text-gray-400 hover:bg-white/[0.07] hover:border-white/10"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${currentTime >= cue.start && currentTime <= cue.end ? 'bg-blue-500/30 text-blue-200' : 'bg-white/5 text-gray-500'}`}>
                                                {Math.floor(cue.start / 60)}:{String(Math.floor(cue.start % 60)).padStart(2, '0')}
                                            </span>
                                            {currentTime >= cue.start && currentTime <= cue.end && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                                            )}
                                        </div>
                                        <p className="text-[11px] leading-snug font-medium line-clamp-2">
                                            {cue.text}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Transcription text now clearly separated below the whole unit */}
            {shouldShowTranscription && (
                <div className="glass-card !p-8 border-white/5 bg-white/[0.02] relative overflow-hidden group/text">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/30 group-hover/text:bg-blue-500 transition-all" />
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 flex items-center gap-3">
                            <span className="text-lg">📄</span> Full Transcription
                        </h4>
                        {!transcription.cues && (
                            <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                                <button
                                    onClick={() => setLanguage("en")}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "en" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:text-white"}`}
                                >EN</button>
                                <button
                                    onClick={() => setLanguage("es")}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "es" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:text-white"}`}
                                >ES</button>
                            </div>
                        )}
                    </div>
                    <div className="text-[13px] text-gray-400 font-medium leading-[1.7] italic bg-black/20 p-5 rounded-2xl border border-white/5 relative max-h-[300px] overflow-y-auto custom-scrollbar">
                        &quot;{transcription[language] || "Transcription not available."}&quot;
                        <div className="sticky bottom-0 right-0 text-[10px] font-black uppercase tracking-widest text-blue-500/40 text-right mt-4 pt-3 bg-gradient-to-t from-black/40 to-transparent">
                            Official {language.toUpperCase()} Text
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
