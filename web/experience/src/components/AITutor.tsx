"use client";

import { useState, useRef, useEffect } from "react";
import { lmsApi } from "@/lib/api";
import { Send, Bot, User, X, MessageSquare, Loader2 } from "lucide-react";

interface Message {
    role: 'tutor' | 'user';
    content: string;
}

export default function AITutor({ lessonId }: { lessonId: string }) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'tutor', content: '¡Hola! Soy tu tutor de IA. ¿Tienes alguna duda sobre esta lección?' }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        // Load session from localStorage on mount
        const savedSession = localStorage.getItem(`tutor_session_${lessonId}`);
        if (savedSession) {
            setSessionId(savedSession);
        }
    }, [lessonId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const { response, session_id: newSessionId } = await lmsApi.chatWithTutor(lessonId, userMessage, sessionId || undefined);
            setMessages(prev => [...prev, { role: 'tutor', content: response }]);

            if (newSessionId && newSessionId !== sessionId) {
                setSessionId(newSessionId);
                localStorage.setItem(`tutor_session_${lessonId}`, newSessionId);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'tutor', content: "Lo siento, hubo un error conectando con el tutor. Por favor intenta de nuevo." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-6 w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/40 flex items-center justify-center hover:scale-110 transition-all z-[100] group"
                aria-label="Abrir Tutor de IA"
                aria-expanded="false"
            >
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-black rounded-full animate-pulse" aria-hidden="true" />
                <MessageSquare className="w-6 h-6 group-hover:rotate-12 transition-transform" aria-hidden="true" />
            </button>
        );
    }

    return (
        <div
            className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] glass bg-white/95 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col z-[200] animate-in slide-in-from-bottom-6 duration-500 overflow-hidden"
            role="dialog"
            aria-label="Tutor de IA"
        >
            {/* Header */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 bg-blue-600/5 dark:bg-blue-600/10 flex items-center justify-between">
                <div className="flex items-center gap-3" aria-hidden="true">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Tutor de IA</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter">En Línea</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    aria-label="Cerrar Tutor de IA"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Messages */}
            <ul
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
                aria-live="polite"
                aria-relevant="additions"
            >
                {messages.map((msg, i) => (
                    <li
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${msg.role === 'user' ? 'bg-black/5 dark:bg-white/5' : 'bg-blue-600/20 text-blue-600 dark:text-blue-400'}`} aria-hidden="true">
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`p-3 rounded-2xl text-xs font-medium leading-relaxed ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200 border border-black/5 dark:border-white/5 rounded-tl-none'
                                }`}
                                aria-label={msg.role === 'user' ? 'Tú dijeste' : 'El tutor dijo'}
                            >
                                {msg.content}
                            </div>
                        </div>
                    </li>
                ))}
                {isLoading && (
                    <li className="flex justify-start animate-in fade-in duration-300" aria-busy="true">
                        <div className="flex gap-2 max-w-[85%]">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center" aria-hidden="true">
                                <Bot size={16} />
                            </div>
                            <div className="bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-black/5 dark:border-white/5 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">El tutor está pensando...</span>
                            </div>
                        </div>
                    </li>
                )}
            </ul>

            {/* Input */}
            <div className="p-4 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-black/40">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escribe tu duda aquí..."
                        aria-label="Escribe tu duda para el tutor"
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-3 px-4 pr-12 text-xs font-medium focus:outline-none focus:border-blue-600/50 dark:focus:border-blue-500/50 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600 text-gray-900 dark:text-gray-100"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 top-1.5 p-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-all hover:bg-blue-500"
                        aria-label="Enviar mensaje"
                    >
                        <Send size={16} aria-hidden="true" />
                    </button>
                </div>
                <p className="mt-2 text-[9px] text-gray-500 dark:text-gray-600 font-bold uppercase tracking-widest text-center">
                    IA entrenada con el contenido de esta lección
                </p>
            </div>
        </div>
    );
}
