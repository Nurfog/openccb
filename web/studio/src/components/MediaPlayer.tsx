"use client";

import { useEffect, useRef, useState } from "react";

interface MediaPlayerProps {
    src: string | null;
    type: string; // "video" | "audio"
    transcription?: {
        en?: string;
        es?: string;
        cues?: { start: number; end: number; text: string }[];
    } | null;
    locked?: boolean;
    onEnded?: () => void;
}

export default function MediaPlayer({ src, type, transcription, locked, onEnded }: MediaPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentCaption, setCurrentCaption] = useState("");
    const [language, setLanguage] = useState<"en" | "es">("en");

    useEffect(() => {
        const media = type === "video" ? videoRef.current : audioRef.current;
        if (!media) return;

        const handleTimeUpdate = () => {
            if (transcription?.cues) {
                const activeCue = transcription.cues.find(cue =>
                    media.currentTime >= cue.start && media.currentTime <= cue.end
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
    }, [type, transcription, onEnded]);

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
            <div className="space-y-4 relative group">
                <div className={`glass overflow-hidden border border-white/10 aspect-video ${locked ? 'blur-xl grayscale' : ''}`}>
                    <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>

                {locked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl z-10 text-center p-6 border border-white/10">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 border border-white/20">
                            <span className="text-3xl">🔒</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Playback Limited</h3>
                        <p className="text-sm text-gray-300 max-w-xs">This content can only be played once according to the activity rules.</p>
                    </div>
                )}

                {transcription && !locked && (
                    <div className="glass p-6 space-y-4 border border-blue-500/20">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold flex items-center gap-2">
                                Transcription <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">AI Enhanced</span>
                            </h4>
                            <div className="flex bg-white/5 rounded-lg p-1">
                                <button
                                    onClick={() => setLanguage("en")}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${language === "en" ? "bg-blue-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                                >EN</button>
                                <button
                                    onClick={() => setLanguage("es")}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${language === "es" ? "bg-blue-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                                >ES</button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-400 leading-relaxed max-h-40 overflow-y-auto italic bg-white/5 p-4 rounded-lg">
                            &quot;{transcription[language] || "Transcription not available."}&quot;
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4 relative group">
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

            {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl z-10 text-center p-6 border border-white/10">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 border border-white/20">
                        <span className="text-3xl">🔒</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Playback Limited</h3>
                    <p className="text-sm text-gray-300 max-w-xs">This content can only be played once according to the activity rules.</p>
                </div>
            )}

            {transcription && !locked && (
                <div className="glass p-6 space-y-4 border border-blue-500/20">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                            Transcription <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">AI Enhanced</span>
                        </h4>
                        <div className="flex bg-white/5 rounded-lg p-1">
                            <button
                                onClick={() => setLanguage("en")}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${language === "en" ? "bg-blue-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                            >EN</button>
                            <button
                                onClick={() => setLanguage("es")}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${language === "es" ? "bg-blue-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                            >ES</button>
                        </div>
                    </div>
                    <div className="text-sm text-gray-400 leading-relaxed max-h-40 overflow-y-auto italic bg-white/5 p-4 rounded-lg">
                        &quot;{transcription[language] || "Transcription not available."}&quot;
                    </div>
                </div>
            )}
        </div>
    );
}
