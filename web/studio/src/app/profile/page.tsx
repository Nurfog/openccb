"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cmsApi } from "@/lib/api";
import { Save, Shield, Mail, User as UserIcon, Building } from "lucide-react";

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

            await cmsApi.updateUser(user.id, {
                full_name: fullName,
                // In this simplified version, we don't allow email change here to avoid complexity
            });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });

            // Optionally update the local user state if needed, 
            // but usually a page refresh or context update would be better.
            // For now, let's just show the message.
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="mb-12">
                <h1 className="text-4xl font-black tracking-tight text-white mb-2">User Profile</h1>
                <p className="text-gray-400">Manage your personal information and account settings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="md:col-span-1">
                    <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center font-black text-3xl text-blue-400 mb-4 shadow-2xl shadow-blue-500/20">
                            {user.full_name.charAt(0)}
                        </div>
                        <h2 className="text-xl font-bold text-white">{user.full_name}</h2>
                        <span className="text-xs font-black uppercase tracking-widest text-blue-500 mt-1">{user.role}</span>

                        <div className="w-full h-px bg-white/5 my-6" />

                        <div className="w-full flex flex-col gap-4 text-left">
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <Building size={16} className="text-gray-600" />
                                <span className="truncate">Org: {user.organization_id}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <Shield size={16} className="text-gray-600" />
                                <span>Role: {user.role}</span>
                            </div>
                        </div>

                        <button
                            onClick={logout}
                            className="mt-8 w-full py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Logout Session
                        </button>
                    </div>
                </div>

                {/* Settings Form */}
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handleSave} className="glass p-8 rounded-3xl border border-white/5 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <UserIcon size={14} /> Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        <div className="space-y-2 opacity-60">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <Mail size={14} /> Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/50 cursor-not-allowed"
                            />
                            <p className="text-[10px] text-gray-500 italic">Email cannot be changed currently.</p>
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
                            Save Changes
                        </button>
                    </form>

                    <div className="glass p-6 rounded-3xl border border-red-500/10 bg-red-500/5 items-center justify-between flex">
                        <div>
                            <h3 className="text-red-400 font-bold">Danger Zone</h3>
                            <p className="text-xs text-red-400/60 mt-0.5">Deleting your account is permanent.</p>
                        </div>
                        <button className="px-4 py-2 border border-red-500/20 rounded-lg text-xs font-black text-red-400 hover:bg-red-500/10 transition-colors uppercase tracking-widest">
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
