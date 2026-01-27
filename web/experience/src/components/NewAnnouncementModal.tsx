import React, { useState } from 'react';
import { lmsApi } from '../lib/api';
import { X, Send, AlertTriangle } from 'lucide-react';

interface NewAnnouncementModalProps {
    courseId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const NewAnnouncementModal: React.FC<NewAnnouncementModalProps> = ({
    courseId,
    onClose,
    onSuccess,
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setLoading(true);
        setError(null);
        try {
            await lmsApi.createAnnouncement(courseId, {
                title: title.trim(),
                content: content.trim(),
                is_pinned: isPinned,
            });
            onSuccess();
        } catch (err: any) {
            console.error('Error creating announcement:', err);
            setError('Error al crear el anuncio. Por favor, inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1c1e] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Send className="w-5 h-5 text-primary-500" />
                        Publicar Nuevo Anuncio
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                            <AlertTriangle className="w-5 h-5" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Título del Anuncio</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej: Nuevos materiales disponibles"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Contenido</label>
                        <textarea
                            required
                            rows={6}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe el mensaje para los estudiantes..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-primary-500/50 transition-colors resize-none"
                        />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-primary-500/5 border border-primary-500/10 rounded-2xl">
                        <input
                            type="checkbox"
                            id="isPinned"
                            checked={isPinned}
                            onChange={(e) => setIsPinned(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white/5"
                        />
                        <label htmlFor="isPinned" className="text-sm text-gray-300 font-medium cursor-pointer">
                            Fijar este anuncio al principio de la lista
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-semibold text-gray-400 hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-900/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>Publicando...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Publicar Anuncio</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
