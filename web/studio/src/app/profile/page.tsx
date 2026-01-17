"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { cmsApi, getImageUrl } from "@/lib/api";
import {
    Save,
    Shield,
    Mail,
    User as UserIcon,
    Building,
    Camera,
    Languages,
    FileText,
    LogOut,
    Trash2
} from "lucide-react";

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const [fullName, setFullName] = useState(user?.full_name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [language, setLanguage] = useState(user?.language || "en");
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setFullName(user.full_name);
            setEmail(user.email);
            setBio(user.bio || "");
            setLanguage(user.language || "en");
            setAvatarUrl(user.avatar_url || "");
        }
    }, [user]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        try {
            setUploading(true);
            const res = await cmsApi.uploadAsset(file);
            setAvatarUrl(res.url);

            // Auto-save the new avatar URL
            await cmsApi.updateUser(user.id, { avatar_url: res.url });
            setMessage({ type: 'success', text: 'Avatar updated successfully!' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to upload avatar.' });
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

            await cmsApi.updateUser(user.id, {
                full_name: fullName,
                bio,
                language,
                avatar_url: avatarUrl
            });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-5xl mx-auto py-12 px-6">
            <div className="mb-12">
                <h1 className="text-4xl font-black tracking-tight text-white mb-2">User Profile</h1>
                <p className="text-gray-400">Manage your identity and preferences across the platform.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-8 rounded-[2rem] border border-white/5 flex flex-col items-center text-center relative overflow-hidden group">
                        {/* Avatar Section */}
                        <div className="relative mb-6">
                            <div className="w-32 h-32 rounded-full bg-blue-600/20 border-4 border-white/5 flex items-center justify-center overflow-hidden shadow-2xl relative">
                                {avatarUrl ? (
                                    <img
                                        src={getImageUrl(avatarUrl)}
                                        alt={fullName}
                                        className="w-full h-full object-cover"
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
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/10">
                                {user.role}
                            </span>
                        </div>

                        <div className="w-full h-px bg-white/5 my-8" />

                        <div className="w-full space-y-4 text-left">
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                                <Building size={18} className="text-gray-500" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-tighter text-gray-500">Organization</p>
                                    <p className="text-xs font-bold text-white truncate">{user.organization_id}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                                <Shield size={18} className="text-gray-500" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-tighter text-gray-500">Access Level</p>
                                    <p className="text-xs font-bold text-white truncate capitalize">{user.role}</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={logout}
                            className="mt-10 w-full py-4 rounded-2xl border border-white/5 bg-white/5 text-sm font-black text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all flex items-center justify-center gap-3 group/logout"
                        >
                            <LogOut size={18} className="group-hover/logout:-translate-x-1 transition-transform" />
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Right Column: Settings Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSave} className="glass p-10 rounded-[2.5rem] border border-white/5 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                    <UserIcon size={14} className="text-blue-500" /> Personal Name
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                    placeholder="Enter your full name"
                                    required
                                />
                            </div>

                            <div className="space-y-3 opacity-60">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                    <Mail size={14} className="text-blue-500" /> Email Address
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
                                <FileText size={14} className="text-blue-500" /> Biography
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all min-h-[140px] resize-none outline-none"
                                placeholder="Tell us a bit about yourself..."
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                <Languages size={14} className="text-blue-500" /> Preferred Language
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { code: 'en', label: 'English', flag: '🇺🇸' },
                                    { code: 'es', label: 'Spanish', flag: '🇪🇸' },
                                    { code: 'pt', label: 'Portuguese', flag: '🇧🇷' }
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
                                Sync Profile Data
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
                                <h3 className="text-red-400 font-black text-lg">Danger Zone</h3>
                                <p className="text-xs text-red-400/60 mt-1">This will permanently delete your identity and data.</p>
                            </div>
                        </div>
                        <button className="px-8 py-3 border border-red-500/20 rounded-xl text-xs font-black text-red-400 hover:bg-red-500/10 transition-all uppercase tracking-widest active:scale-95">
                            Purge Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
