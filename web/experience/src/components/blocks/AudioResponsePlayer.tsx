"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, RotateCcw, Check, X, Clock } from "lucide-react";

interface AudioResponsePlayerProps {
    id: string;
    prompt: string;
    keywords?: string[];
    timeLimit?: number;
    isGraded?: boolean;
    onComplete?: (score: number, transcript: string) => void;
}

export default function AudioResponsePlayer({
    id,
    prompt,
    keywords = [],
    timeLimit,
    isGraded = false,
    onComplete
}: AudioResponsePlayerProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [transcript, setTranscript] = useState("");
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [evaluation, setEvaluation] = useState<{ score: number; foundKeywords: string[] } | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Initialize Web Speech API
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    }
                }
                if (finalTranscript) {
                    setTranscript(prev => prev + finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
            };
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start speech recognition
            if (recognitionRef.current) {
                setTranscript("");
                recognitionRef.current.start();
            }

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    const newTime = prev + 1;
                    if (timeLimit && newTime >= timeLimit) {
                        stopRecording();
                    }
                    return newTime;
                });
            }, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const playRecording = () => {
        if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
        }
    };

    const evaluateResponse = () => {
        if (!transcript.trim()) {
            alert("No speech detected. Please try recording again.");
            return;
        }

        const transcriptLower = transcript.toLowerCase();
        const foundKeywords = keywords.filter(kw =>
            transcriptLower.includes(kw.toLowerCase())
        );

        const score = keywords.length > 0
            ? Math.round((foundKeywords.length / keywords.length) * 100)
            : 100; // If no keywords specified, give full credit for any response

        setEvaluation({ score, foundKeywords });
        setSubmitted(true);

        if (onComplete) {
            onComplete(score, transcript);
        }
    };

    const reset = () => {
        setAudioBlob(null);
        setTranscript("");
        setRecordingTime(0);
        setSubmitted(false);
        setEvaluation(null);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6" id={id}>
            <div className="p-8 glass border-white/5 rounded-3xl space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                        <Mic className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xl font-bold text-gray-100">{prompt}</p>
                        {keywords.length > 0 && !submitted && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className="text-xs text-gray-500 uppercase tracking-wider">Expected topics:</span>
                                {keywords.map((kw, i) => (
                                    <span key={i} className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300">
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recording Controls */}
                {!submitted && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-center gap-4">
                            {!isRecording && !audioBlob && (
                                <button
                                    onClick={startRecording}
                                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/30 transition-all"
                                >
                                    <Mic className="w-5 h-5" />
                                    Start Recording
                                </button>
                            )}

                            {isRecording && (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex items-center gap-3 px-6 py-3 bg-red-500/20 border-2 border-red-500 rounded-2xl animate-pulse">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                        <span className="font-mono text-xl font-bold text-red-400">{formatTime(recordingTime)}</span>
                                        {timeLimit && (
                                            <span className="text-sm text-gray-400">/ {formatTime(timeLimit)}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={stopRecording}
                                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white transition-all"
                                    >
                                        <Square className="w-4 h-4" />
                                        Stop Recording
                                    </button>
                                </div>
                            )}

                            {audioBlob && !isRecording && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={playRecording}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white transition-all"
                                    >
                                        <Play className="w-4 h-4" />
                                        Play Recording
                                    </button>
                                    <button
                                        onClick={reset}
                                        className="flex items-center gap-2 px-6 py-3 glass hover:bg-white/10 rounded-xl font-bold text-gray-300 transition-all"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Re-record
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Transcript Preview */}
                        {transcript && !submitted && (
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Transcript:</p>
                                <p className="text-sm text-gray-300">{transcript}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        {audioBlob && transcript && (
                            <button
                                onClick={evaluateResponse}
                                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold text-white shadow-lg shadow-green-500/30 transition-all"
                            >
                                Submit Response
                            </button>
                        )}
                    </div>
                )}

                {/* Evaluation Results */}
                {submitted && evaluation && (
                    <div className="space-y-4">
                        <div className={`p-6 rounded-2xl border-2 ${evaluation.score >= 70
                                ? 'bg-green-500/10 border-green-500'
                                : evaluation.score >= 40
                                    ? 'bg-yellow-500/10 border-yellow-500'
                                    : 'bg-red-500/10 border-red-500'
                            }`}>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-bold uppercase tracking-wider text-gray-400">Your Score</span>
                                <span className="text-3xl font-black">{evaluation.score}%</span>
                            </div>

                            {keywords.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Keywords Found:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {keywords.map((kw, i) => {
                                            const found = evaluation.foundKeywords.includes(kw);
                                            return (
                                                <span
                                                    key={i}
                                                    className={`px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1 ${found
                                                            ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                                                            : 'bg-gray-500/20 border border-gray-500/50 text-gray-400'
                                                        }`}
                                                >
                                                    {found ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                    {kw}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Your Transcript:</p>
                            <p className="text-sm text-gray-300">{transcript}</p>
                        </div>

                        {!isGraded && evaluation.score < 70 && (
                            <button
                                onClick={reset}
                                className="w-full py-4 glass hover:bg-white/10 rounded-xl font-bold text-blue-400 transition-all"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
