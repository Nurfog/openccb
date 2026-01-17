"use client";

import { useState, useEffect } from "react";
import { lmsApi, Notification } from "@/lib/api";
import { Bell, X, Calendar, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const data = await lmsApi.getNotifications();
            setNotifications(data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 5 minutes
        const interval = setInterval(fetchNotifications, 300000);
        return () => clearInterval(interval);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await lmsApi.markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getIcon = (type: string) => {
        switch (type) {
            case 'deadline': return <Calendar className="text-red-400" size={18} />;
            case 'warning': return <AlertTriangle className="text-amber-400" size={18} />;
            case 'success': return <CheckCircle2 className="text-green-400" size={18} />;
            default: return <Info className="text-blue-400" size={18} />;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl glass border-white/10 text-gray-400 hover:text-white transition-all hover:bg-white/5"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#1a1c20] -translate-to-1/4">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-4 w-96 glass-card border-white/10 z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden bg-[#1a1c20]/95 backdrop-blur-xl">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Notificaciones</h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {loading && notifications.length === 0 ? (
                                <div className="p-12 text-center animate-pulse text-gray-500 text-xs font-bold uppercase tracking-widest">Cargando...</div>
                            ) : notifications.length === 0 ? (
                                <div className="p-12 text-center text-gray-500 text-xs font-bold uppercase tracking-widest italic">No hay notificaciones</div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={`p-4 hover:bg-white/5 transition-all group ${!n.is_read ? 'bg-blue-500/5' : ''}`}
                                            onClick={() => !n.is_read && markAsRead(n.id)}
                                        >
                                            <div className="flex gap-4">
                                                <div className="mt-1">{getIcon(n.notification_type)}</div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-bold text-white leading-tight">{n.title}</p>
                                                    <p className="text-xs text-gray-400 leading-relaxed">{n.message}</p>
                                                    <div className="flex items-center justify-between pt-2">
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                                            {new Date(n.created_at).toLocaleDateString()}
                                                        </span>
                                                        {n.link_url && (
                                                            <Link
                                                                href={n.link_url}
                                                                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                                                onClick={() => setIsOpen(false)}
                                                            >
                                                                Ver detalles →
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-4 border-t border-white/5 bg-white/5 text-center">
                                <button
                                    className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                                    onClick={() => {
                                        notifications.filter(n => !n.is_read).forEach(n => markAsRead(n.id));
                                    }}
                                >
                                    Marcar todas como leídas
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
