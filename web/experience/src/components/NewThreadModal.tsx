"use client";

import React, { useState } from "react";
import { lmsApi, CreateThreadPayload } from "@/lib/api";
import { X, Send } from "lucide-react";

interface NewThreadModalProps {
    courseId: string;
    lessonId?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function NewThreadModal({ courseId, lessonId, onClose, onSuccess }: NewThreadModalProps) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            setError("El título y el contenido son requeridos");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const payload: CreateThreadPayload = {
                title: title.trim(),
                content: content.trim(),
                lesson_id: lessonId
            };

            await lmsApi.createThread(courseId, payload);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al crear el hilo");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 className="text-2xl font-black text-white">Nuevo Hilo de Discusión</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Título
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="¿Cuál es tu pregunta o tema?"
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                            disabled={submitting}
                            maxLength={200}
                        />
                        <p className="text-xs text-gray-500">{title.length}/200 caracteres</p>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Contenido
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Describe tu pregunta o tema en detalle..."
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors resize-none"
                            rows={8}
                            disabled={submitting}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={!title.trim() || !content.trim() || submitting}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={16} />
                            {submitting ? "Creando..." : "Crear Hilo"}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-xl transition-all border border-white/10"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
