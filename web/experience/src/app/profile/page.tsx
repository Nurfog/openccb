"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { lmsApi } from "@/lib/api";
import { Save, Shield, Mail, User as UserIcon, Building, Trophy, Flame } from "lucide-react";

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const [fullName, setFullName] = useState(user?.full_name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (user) {
            setFullName(user.full_name);
            setEmail(user.email);
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            setSaving(true);
            setMessage(null);

            await lmsApi.updateUser(user.id, {
                full_name: fullName
            });

            setMessage({ type: 'success', text: '¡Perfil actualizado con éxito!' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error al actualizar el perfil.' });
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="mb-12">
                <h1 className="text-4xl font-black tracking-tight text-white mb-2">Mi Perfil</h1>
                <p className="text-gray-400">Personaliza tu experiencia de aprendizaje y sigue tu progreso.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Card & Stats */}
                <div className="md:col-span-1 space-y-6">
                    <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center font-black text-3xl text-blue-400 mb-4 shadow-2xl shadow-blue-500/20">
                            {user.full_name.charAt(0)}
                        </div>
                        <h2 className="text-xl font-bold text-white">{user.full_name}</h2>
                        <span className="text-xs font-black uppercase tracking-widest text-blue-500 mt-1">Estudiante</span>

                        <div className="w-full h-px bg-white/5 my-6" />

                        <div className="w-full flex flex-col gap-4 text-left">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Trophy size={16} className="text-yellow-500" />
                                    <span className="text-xs font-bold text-white uppercase tracking-tighter">Nivel</span>
                                </div>
                                <span className="text-lg font-black text-white">{user.level || 1}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Flame size={16} className="text-orange-500" />
                                    <span className="text-xs font-bold text-white uppercase tracking-tighter">XP</span>
                                </div>
                                <span className="text-lg font-black text-white">{user.xp || 0}</span>
                            </div>
                        </div>

                        <button
                            onClick={logout}
                            className="mt-8 w-full py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>

                {/* Settings Form */}
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handleSave} className="glass p-8 rounded-3xl border border-white/5 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <UserIcon size={14} /> Nombre Completo
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-700"
                                placeholder="Introduce tu nombre completo"
                                required
                            />
                        </div>

                        <div className="space-y-2 opacity-60">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <Mail size={14} /> Dirección de Correo Electrónico
                            </label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/50 cursor-not-allowed"
                            />
                            <p className="text-[10px] text-gray-500 italic">El correo electrónico no se puede cambiar actualmente.</p>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 rounded-xl font-black text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={20} />
                            )}
                            Guardar Cambios
                        </button>
                    </form>

                    <div className="glass p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                <Shield size={18} className="text-gray-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm">Organización</h3>
                                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{user.organization_id}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">Inquilino Activo</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
