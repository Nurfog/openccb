"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { lmsApi, PublicProfile } from "@/lib/api";
import {
    Award,
    BookOpen,
    Zap,
    ShieldCheck,
    Globe,
    Linkedin,
    Github,
    UserCircle
} from "lucide-react";

export default function StudentPortfolioPage() {
    const { id } = useParams();
    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const data = await lmsApi.getPublicProfile(id as string);
                setProfile(data);
            } catch (err: any) {
                setError(err.message || "Failed to load profile");
            } finally {
                setLoading(false);
            }
        };
        if (id) loadProfile();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading portfolio...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>;
    if (!profile) return null;

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
            {/* Hero Section / Profile Header */}
            <div className="relative h-64 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b border-white/5">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
                <div className="max-w-5xl mx-auto px-6 h-full flex flex-col justify-end pb-8">
                    <div className="flex items-end gap-6">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                            <div className="relative w-32 h-32 rounded-2xl bg-black border-2 border-white/10 overflow-hidden shadow-2xl">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-900">
                                        <UserCircle size={64} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 pb-2">
                            <h1 className="text-4xl font-bold tracking-tight">{profile.full_name}</h1>
                            <p className="text-gray-400 mt-1 flex items-center gap-2">
                                <Zap className="text-yellow-400" size={16} />
                                Level {profile.level} Apprentice • {profile.xp} XP
                            </p>
                        </div>
                        <div className="flex gap-2 pb-2">
                            <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"><Linkedin size={20} /></button>
                            <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"><Github size={20} /></button>
                            <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"><Globe size={20} /></button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-12">
                {/* Left Column: Bio & Stats */}
                <div className="md:col-span-1 space-y-8">
                    <section>
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">About Me</h2>
                        <p className="text-gray-300 leading-relaxed italic">
                            {profile.bio || "No biography provided. This student is focused on mastering their craft."}
                        </p>
                    </section>

                    <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Global Stats</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3 text-gray-400">
                                    <BookOpen size={18} className="text-blue-400" />
                                    <span>Courses Finished</span>
                                </div>
                                <span className="font-mono font-bold">{profile.completed_courses_count}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3 text-gray-400">
                                    <Award size={18} className="text-purple-400" />
                                    <span>Badges Earned</span>
                                </div>
                                <span className="font-mono font-bold">{profile.badges.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3 text-gray-400">
                                    <Zap size={18} className="text-yellow-400" />
                                    <span>Global Rank</span>
                                </div>
                                <span className="font-mono font-bold">Top 5%</span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Badges & Showcase */}
                <div className="md:col-span-2 space-y-12">
                    <section>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <ShieldCheck className="text-blue-500" />
                                Credentials & Badges
                            </h2>
                            <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">VERIFIED BY OPENCCB</span>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {profile.badges.map((badge: any) => (
                                <div key={badge.id} className="relative group cursor-pointer bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                                    <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center bg-blue-500/10 rounded-2xl">
                                        <img src={badge.icon_url} alt={badge.name} className="w-10 h-10 object-contain drop-shadow-lg" onError={(e) => {
                                            const target = e.target as any;
                                            target.src = "https://cdn-icons-png.flaticon.com/512/10636/10636665.png";
                                        }} />
                                    </div>
                                    <h3 className="font-bold text-sm mb-1">{badge.name}</h3>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter line-clamp-2 leading-tight">
                                        {badge.description}
                                    </p>
                                    <div className="absolute inset-0 border-2 border-blue-500/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[0_0_20px_rgba(59,130,246,0.3)]"></div>
                                </div>
                            ))}
                        </div>

                        {profile.badges.length === 0 && (
                            <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-gray-600">This student hasn&apos;t collected any badges yet.</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
