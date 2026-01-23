"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { lmsApi, getCmsApiUrl } from "@/lib/api";
import {
    Save,
    Shield,
    Mail,
    User as UserIcon,
    Trophy,
    Flame,
    Camera,
    Languages,
    FileText,
    LogOut,
    Trash2,
    Award
} from "lucide-react";

export default function ProfilePage() {
    const { t, setLanguage: setContextLanguage } = useTranslation();
    const { user, logout } = useAuth();
    const [fullName, setFullName] = useState(user?.full_name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [language, setLanguage] = useState(user?.language || "es");
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [gamification, setGamification] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchGamification = useCallback(async () => {
        if (!user) return;
        try {
            const data = await lmsApi.getGamification(user.id);
            setGamification(data);
        } catch (err) {
            console.error("Failed to fetch gamification:", err);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            setFullName(user.full_name);
            setEmail(user.email);
            setBio(user.bio || "");
            setLanguage(user.language || "es");
            setAvatarUrl(user.avatar_url || "");
            fetchGamification();
        }
    }, [user, fetchGamification]);

    const getImageUrl = (path?: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const cleanPath = path.startsWith('/uploads') ? path.replace('/uploads', '/assets') : path;
        const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
        return `${getCmsApiUrl()}${finalPath}`;
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        try {
            setUploading(true);
            const res = await lmsApi.uploadAsset(file);
            setAvatarUrl(res.url);

            // Auto-save the new avatar URL
            await lmsApi.updateUser(user.id, { avatar_url: res.url });
            setMessage({ type: 'success', text: '¡Avatar actualizado con éxito!' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error al subir el avatar.' });
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            setSaving(true);
            setMessage(null);

            await lmsApi.updateUser(user.id, {
                full_name: fullName,
                bio,
                language,
                avatar_url: avatarUrl
            });

            setContextLanguage(language);
            setMessage({ type: 'success', text: t('common.save') + '!' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error al actualizar el perfil.' });
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-5xl mx-auto py-12 px-6">
            <div className="mb-12">
                <h1 className="text-4xl font-black tracking-tight text-white mb-2">Mi Perfil</h1>
                <p className="text-gray-400">Personaliza tu identidad y sigue tu progreso de aprendizaje.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Profile */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-8 rounded-[2rem] border border-white/5 flex flex-col items-center text-center relative overflow-hidden group">
                        {/* Avatar Section */}
                        <div className="relative mb-6">
                            <div className="w-32 h-32 rounded-full bg-blue-600/20 border-4 border-white/5 flex items-center justify-center overflow-hidden shadow-2xl relative">
                                {avatarUrl ? (
                                    <Image
                                        src={getImageUrl(avatarUrl)}
                                        alt={fullName}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 100vw, 128px"
                                    />
                                ) : (
                                    <span className="text-5xl font-black text-blue-400">
                                        {fullName.charAt(0)}
                                    </span>
                                )}

                                {uploading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-[#0a0a0b] transition-transform active:scale-90"
                            >
                                <Camera size={18} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                            />
                        </div>

                        <h2 className="text-2xl font-black text-white">{fullName}</h2>
                        <span className="text-xs font-black uppercase tracking-widest text-blue-500 mt-1">Estudiante</span>

                        <div className="w-full h-px bg-white/5 my-8" />

                        {/* Gamification Stats */}
                        <div className="w-full grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/5 ring-1 ring-white/5">
                                <Trophy size={20} className="text-yellow-500 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-tighter text-gray-500">Nivel</p>
                                <p className="text-2xl font-black text-white">{user.level || 1}</p>
                            </div>
                            <div className="flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/5 ring-1 ring-white/5">
                                <Flame size={20} className="text-orange-500 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-tighter text-gray-500">XP Total</p>
                                <p className="text-2xl font-black text-white">{user.xp || 0}</p>
                            </div>
                        </div>

                        <button
                            onClick={logout}
                            className="mt-10 w-full py-4 rounded-2xl border border-white/5 bg-white/5 text-sm font-black text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all flex items-center justify-center gap-3 group/logout"
                        >
                            <LogOut size={18} className="group-hover/logout:-translate-x-1 transition-transform" />
                            Cerrar Sesión
                        </button>
                    </div>

                    {/* Badges Section */}
                    <div className="glass p-6 rounded-[2rem] border border-white/5">
                        <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                            <Award size={18} className="text-yellow-500" /> Logros Obtenidos
                        </h3>
                        {gamification?.badges && gamification.badges.length > 0 ? (
                            <div className="grid grid-cols-4 gap-3">
                                {gamification.badges.map((badge: any) => (
                                    <div key={badge.id} className="group relative">
                                        <div className="w-full aspect-square rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                                            {badge.icon_url ? (
                                                <Image src={badge.icon_url} alt={badge.name} width={32} height={32} className="opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                                            ) : (
                                                <Award size={24} className="text-gray-600 group-hover:text-yellow-500 transition-colors" />
                                            )}
                                        </div>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black border border-white/10 rounded-lg text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                            {badge.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 px-4 rounded-2xl bg-white/5 border border-dashed border-white/10">
                                <Award size={32} className="text-gray-700 mx-auto mb-3" />
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">¡Completa lecciones para ganar insignias!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Settings Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSave} className="glass p-10 rounded-[2.5rem] border border-white/5 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                    <UserIcon size={14} className="text-blue-500" /> Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                    placeholder="Introduce tu nombre completo"
                                    required
                                />
                            </div>

                            <div className="space-y-3 opacity-60">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                    <Mail size={14} className="text-blue-500" /> Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    disabled
                                    className="w-full bg-black/20 border border-white/5 rounded-2xl px-6 py-4 text-white/50 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                <FileText size={14} className="text-blue-500" /> Biografía
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all min-h-[140px] resize-none outline-none"
                                placeholder="Cuéntanos un poco sobre ti..."
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                <Languages size={14} className="text-blue-500" /> Idioma Preferido
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { code: 'en', label: 'English', flag: '🇺🇸' },
                                    { code: 'es', label: 'Español', flag: '🇪🇸' },
                                    { code: 'pt', label: 'Português', flag: '🇧🇷' }
                                ].map((lang) => (
                                    <button
                                        key={lang.code}
                                        type="button"
                                        onClick={() => setLanguage(lang.code)}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${language === lang.code
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                            : 'bg-black/20 border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                                            }`}
                                    >
                                        <span className="text-xl">{lang.flag}</span>
                                        <span className="text-sm font-bold">{lang.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {message && (
                            <div className={`p-5 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-4 ${message.type === 'success'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 rounded-2xl font-black text-white shadow-2xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                            >
                                {saving ? (
                                    <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={24} />
                                )}
                                Sincronizar Datos de Perfil
                            </button>
                        </div>
                    </form>

                    {/* Danger Zone */}
                    <div className="glass p-8 rounded-[2rem] border border-red-500/10 bg-red-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 shadow-lg">
                                <Trash2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-red-400 font-black text-lg">Zona Peligrosa</h3>
                                <p className="text-xs text-red-400/60 mt-1">Esto eliminará permanentemente tu identidad y datos.</p>
                            </div>
                        </div>
                        <button className="px-8 py-3 border border-red-500/20 rounded-xl text-xs font-black text-red-400 hover:bg-red-500/10 transition-all uppercase tracking-widest active:scale-95">
                            Eliminar Cuenta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
