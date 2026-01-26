"use client";

import React, { useState } from "react";
import { Send, X } from "lucide-react";

interface ReplyEditorProps {
    threadId: string;
    parentPostId?: string | null;
    onSubmit: (content: string) => Promise<void>;
    onCancel: () => void;
    placeholder?: string;
}

export default function ReplyEditor({ threadId, parentPostId, onSubmit, onCancel, placeholder }: ReplyEditorProps) {
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || submitting) return;

        setSubmitting(true);
        try {
            await onSubmit(content);
            setContent("");
        } catch (error) {
            console.error("Error submitting reply:", error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mt-4">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder || "Escribe tu respuesta..."}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors resize-none"
                rows={4}
                disabled={submitting}
            />

            <div className="flex items-center gap-2 mt-3">
                <button
                    type="submit"
                    disabled={!content.trim() || submitting}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                    <Send size={16} />
                    {submitting ? "Enviando..." : "Enviar"}
                </button>

                <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-xl transition-all border border-white/10 text-sm"
                >
                    <X size={16} />
                    Cancelar
                </button>
            </div>
        </form>
    );
}
