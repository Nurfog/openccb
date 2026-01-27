import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnnouncementWithAuthor, lmsApi } from '../lib/api';
import { Pin, Trash2, Edit2, MoreVertical } from 'lucide-react';

interface AnnouncementCardProps {
    announcement: AnnouncementWithAuthor;
    isInstructor: boolean;
    onUpdate: () => void;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
    announcement,
    isInstructor,
    onUpdate
}) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de que deseas eliminar este anuncio?')) return;

        setIsDeleting(true);
        try {
            await lmsApi.deleteAnnouncement(announcement.id);
            onUpdate();
        } catch (error) {
            console.error('Error deleting announcement:', error);
            alert('Error al eliminar el anuncio');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className={`relative p-6 rounded-2xl border transition-all duration-300 ${announcement.is_pinned
                ? 'bg-primary-500/10 border-primary-500/30'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}>
            {announcement.is_pinned && (
                <div className="absolute top-4 right-4 text-primary-400">
                    <Pin className="w-4 h-4 fill-current" />
                </div>
            )}

            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold overflow-hidden">
                        {announcement.author_avatar ? (
                            <img src={announcement.author_avatar} alt={announcement.author_name} className="w-full h-full object-cover" />
                        ) : (
                            announcement.author_name.charAt(0)
                        )}
                    </div>
                    <div>
                        <h4 className="font-semibold text-white">{announcement.author_name}</h4>
                        <p className="text-sm text-gray-400">
                            {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true, locale: es })}
                        </p>
                    </div>
                </div>

                {isInstructor && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                            title="Eliminar anuncio"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{announcement.title}</h3>
            <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {announcement.content}
            </div>
        </div>
    );
};
