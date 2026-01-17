"use client";

import { useState, useEffect } from "react";
import { Play, Lock, AlertCircle } from "lucide-react";
import { lmsApi } from "@/lib/api";

interface MediaPlayerProps {
    id: string;
    lessonId?: string;
    title?: string;
    url: string;
    media_type: 'video' | 'audio';
    config?: {
        maxPlays?: number;
        markers?: {
            timestamp: number;
            question: string;
            options: string[];
            correctIndex: number;
        }[];
    };
    hasTranscription?: boolean;
    initialPlayCount?: number;
    onTimeUpdate?: (time: number) => void;
    onPlay?: () => void;
    isGraded?: boolean;
}

export default function MediaPlayer({ id, lessonId, title, url, media_type, config, hasTranscription, initialPlayCount, onTimeUpdate, onPlay, isGraded }: MediaPlayerProps) {
    const [playCount, setPlayCount] = useState(initialPlayCount || 0);
    const [hasStarted, setHasStarted] = useState(false);
    const [locked, setLocked] = useState(false);

    // Marker State
    const [activeMarker, setActiveMarker] = useState<{ question: string, options: string[], correctIndex: number } | null>(null);
    const [handledMarkers, setHandledMarkers] = useState<Set<number>>(new Set());
    const [lastTime, setLastTime] = useState(0);
    const [feedback, setFeedback] = useState<{ isCorrect: boolean } | null>(null);

    useEffect(() => {
        if (initialPlayCount !== undefined) {
            setPlayCount(initialPlayCount);
        }
    }, [initialPlayCount]);

    const maxPlays = config?.maxPlays || 0;

    const CMS_API_URL = process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:3001";

    const getFullUrl = (path: string) => {
        if (path.startsWith('http')) return path;
        // Map /uploads to /assets for the backend
        const cleanPath = path.startsWith('/uploads') ? path.replace('/uploads', '/assets') : path;
        const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
        return `${CMS_API_URL}${finalPath}`;
    };

    const isLocalFile = url.startsWith('/uploads') || url.startsWith('http://localhost:3001/assets') || url.includes('/assets/');

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (hasStarted && isLocalFile && lessonId) {
            // Heartbeat every 5 seconds
            interval = setInterval(async () => {
                const video = document.querySelector('video');
                if (video && !video.paused) {
                    await lmsApi.recordInteraction(lessonId, {
                        video_timestamp: video.currentTime,
                        event_type: 'heartbeat',
                        metadata: { block_id: id }
                    }).catch(console.error);
                }
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [hasStarted, isLocalFile, lessonId, id]);

    const handlePlay = async () => {
        if (locked) return;
        if (!hasStarted) {
            setPlayCount(prev => prev + 1);
            setHasStarted(true);
            if (lessonId) {
                await lmsApi.recordInteraction(lessonId, {
                    video_timestamp: 0,
                    event_type: 'start',
                    metadata: { block_id: id }
                }).catch(console.error);
            }
            if (onPlay) onPlay();
        }
    };

    if (locked) {
        return (
            <div className="space-y-4" id={id}>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{title || "Contenido Multimedia"}</h3>
                <div className="glass-card aspect-video flex flex-col items-center justify-center gap-6 border-red-500/20 bg-red-500/5">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                        <Lock size={32} />
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-bold text-white mb-2">Contenido Bloqueado</p>
                        <p className="text-sm text-gray-500 max-w-xs uppercase tracking-widest font-black">
                            Has alcanzado el límite de {maxPlays} reproducciones para este contenido.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Helper to format URL (handles YouTube embeds)
    const getEmbedUrl = (rawUrl: string) => {
        if (rawUrl.includes("youtube.com/watch?v=")) {
            return rawUrl.replace("watch?v=", "embed/");
        }
        if (rawUrl.includes("youtu.be/")) {
            return rawUrl.replace("youtu.be/", "youtube.com/embed/");
        }
        return rawUrl;
    };

    const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('experience_token') : null;
    const selectedOrgId = typeof window !== 'undefined' ? localStorage.getItem('experience_selected_org_id') : null;

    // Construct VTT URLs with auth if possible, or assume public/handled by backend
    // Since browser <track> doesn't support custom headers easily, 
    // we might need to handle this via a proxy or temporary signed URLs.
    // For now, we'll assume the backend allows VTT access if requested with the correct lesson ID.
    const vttEn = lessonId ? `${CMS_API_URL}/lessons/${lessonId}/vtt?lang=en` : null;
    const vttEs = lessonId ? `${CMS_API_URL}/lessons/${lessonId}/vtt?lang=es` : null;

    return (
        <div className="space-y-6" id={id}>
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{title || "Contenido Multimedia"}</h3>
                {maxPlays > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white/5 border border-white/5 text-gray-500">
                        {playCount} / {maxPlays} REPRODUCCIONES
                    </span>
                )}
            </div>

            <div className="glass-card !p-2 overflow-hidden aspect-video relative group">
                {isLocalFile ? (
                    <video
                        src={getFullUrl(url)}
                        controls
                        crossOrigin="anonymous"
                        className="w-full h-full rounded-xl"
                        onPlay={handlePlay}
                        onTimeUpdate={(e) => {
                            const time = e.currentTarget.currentTime;

                            // Marker Logic
                            if (config?.markers && !activeMarker) {
                                // Check for markers we just crossed
                                const markers = config.markers;

                                for (const marker of markers) {
                                    // Trigger if we crossed the timestamp and haven't handled it yet
                                    // Use a small window to ensure we catch it but don't double trigger
                                    if (time >= marker.timestamp && lastTime < marker.timestamp && !handledMarkers.has(marker.timestamp)) {
                                        e.currentTarget.pause();
                                        setActiveMarker(marker);
                                        setHandledMarkers(prev => new Set(prev).add(marker.timestamp));
                                        break;
                                    }
                                }
                            }
                            setLastTime(time);

                            if (onTimeUpdate) {
                                onTimeUpdate(time);
                            }
                        }}
                    >
                        {hasTranscription && vttEn && (
                            <track kind="subtitles" src={vttEn} srcLang="en" label="English" />
                        )}
                        {hasTranscription && vttEs && (
                            <track kind="subtitles" src={vttEs} srcLang="es" label="Español" />
                        )}
                    </video>
                ) : (
                    <iframe
                        src={getEmbedUrl(url)}
                        className="w-full h-full rounded-xl"
                        allowFullScreen
                    />
                )}

                {/* Simulated play tracker overlay for iframes (invisible but catches first click) */}
                {!isLocalFile && playCount === 0 && (
                    <div
                        onClick={handlePlay}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer group-hover:bg-black/20 transition-all"
                    >
                        <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center shadow-2xl shadow-blue-500/40 group-hover:scale-110 transition-transform">
                            <Play size={32} className="text-white fill-white ml-2" />
                        </div>
                    </div>
                )}
            </div>

            {maxPlays > 0 && playCount > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-orange-500/70 p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                    <AlertCircle size={14} />
                    <span>Presta atención. El contenido se bloqueará después de {maxPlays} reproducciones.</span>
                </div>
            )}
            {/* Question Overlay */}
            {activeMarker && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md rounded-xl animate-in fade-in duration-300">
                    <div className="bg-white text-black p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4">
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                            <AlertCircle size={16} />
                            <span>Quick Check</span>
                        </div>
                        <h4 className="text-xl font-bold">{activeMarker.question}</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {activeMarker.options.map((option, idx) => (
                                <button
                                    key={idx}
                                    disabled={!!feedback}
                                    onClick={() => {
                                        const isCorrect = idx === activeMarker.correctIndex;

                                        if (isGraded) {
                                            // Graded Mode: Show feedback then continue
                                            setFeedback({ isCorrect });
                                            // Save answer to backend (mocked for now)
                                            console.log(`Submitted answer for marker at ${activeMarker}: ${isCorrect ? 'Correct' : 'Wrong'}`);

                                            setTimeout(() => {
                                                setFeedback(null);
                                                setActiveMarker(null);
                                                const video = document.querySelector(`div[id="${id}"] video`) as HTMLVideoElement;
                                                if (video) video.play();
                                            }, 1500);
                                        } else {
                                            // Formative Mode: Block until correct
                                            if (isCorrect) {
                                                setFeedback({ isCorrect: true });
                                                setTimeout(() => {
                                                    setFeedback(null);
                                                    setActiveMarker(null);
                                                    const video = document.querySelector(`div[id="${id}"] video`) as HTMLVideoElement;
                                                    if (video) video.play();
                                                }, 1000);
                                            } else {
                                                setFeedback({ isCorrect: false });
                                                alert("Try again! (This is just practice)");
                                                setFeedback(null);
                                            }
                                        }
                                    }}
                                    className={`px-4 py-3 rounded-xl font-medium transition-all text-left ${feedback
                                        ? idx === activeMarker.correctIndex
                                            ? "bg-green-500 text-white"
                                            : feedback.isCorrect === false && "bg-red-500 text-white"
                                        : "bg-gray-100 hover:bg-blue-500 hover:text-white"
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        {feedback && (
                            <div className={`mt-2 text-center text-sm font-bold uppercase tracking-widest ${feedback.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                {feedback.isCorrect ? "Correct!" : "Incorrect"}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
