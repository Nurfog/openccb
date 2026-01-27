import React, { useState, useEffect } from 'react';
import { AnnouncementWithAuthor, lmsApi } from '../lib/api';
import { AnnouncementCard } from './AnnouncementCard';
import { NewAnnouncementModal } from './NewAnnouncementModal';
import { Megaphone, Plus, Search, Loader2 } from 'lucide-react';

interface AnnouncementsListProps {
    courseId: string;
    isInstructor: boolean;
}

export const AnnouncementsList: React.FC<AnnouncementsListProps> = ({ courseId, isInstructor }) => {
    const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewModal, setShowNewModal] = useState(false);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const data = await lmsApi.getAnnouncements(courseId);
            setAnnouncements(data);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, [courseId]);

    const filteredAnnouncements = announcements.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400">
                        <Megaphone className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Anuncios del Curso</h2>
                        <p className="text-gray-400 italic">Mantente al día con las últimas noticias</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar anuncios..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-primary-500/50 transition-colors w-full sm:w-64"
                        />
                    </div>
                    {isInstructor && (
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-900/20"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nuevo Anuncio</span>
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                    <p className="text-gray-400">Cargando anuncios...</p>
                </div>
            ) : filteredAnnouncements.length > 0 ? (
                <div className="grid gap-6">
                    {filteredAnnouncements.map((announcement) => (
                        <AnnouncementCard
                            key={announcement.id}
                            announcement={announcement}
                            isInstructor={isInstructor}
                            onUpdate={fetchAnnouncements}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Megaphone className="w-8 h-8 text-gray-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No hay anuncios</h3>
                    <p className="text-gray-400 max-w-md mx-auto">
                        {searchTerm
                            ? `No se encontraron anuncios que coincidan con "${searchTerm}"`
                            : "Aún no se han publicado anuncios en este curso."}
                    </p>
                </div>
            )}

            {showNewModal && (
                <NewAnnouncementModal
                    courseId={courseId}
                    onClose={() => setShowNewModal(false)}
                    onSuccess={() => {
                        setShowNewModal(false);
                        fetchAnnouncements();
                    }}
                />
            )}
        </div>
    );
};
