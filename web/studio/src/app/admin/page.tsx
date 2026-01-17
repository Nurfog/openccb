"use client";

import React, { useState, useEffect } from "react";
import { cmsApi } from "@/lib/api";
import {
    Building2,
    Users,
    BookOpen,
    Zap,
    Server,
    Clock,
    ShieldAlert
} from "lucide-react";

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        orgs: 0,
        users: 0,
        courses: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // In a real app we'd have a specific stats endpoint, 
                // but for now we'll calculate from lists
                const [orgs, users] = await Promise.all([
                    cmsApi.getOrganizations(),
                    cmsApi.getAllUsers()
                ]);

                setStats({
                    orgs: orgs.length,
                    users: users.length,
                    courses: 0 // We'd need a global courses count
                });
            } catch (err) {
                console.error("Failed to load admin stats", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const cards = [
        {
            label: "Organizations",
            value: stats.orgs,
            icon: Building2,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            desc: "Active institutional tenants"
        },
        {
            label: "Total Users",
            value: stats.users,
            icon: Users,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            desc: "Registered globally"
        },
        {
            label: "Global Courses",
            value: stats.courses,
            icon: BookOpen,
            color: "text-green-400",
            bg: "bg-green-500/10",
            desc: "Managed across all orgs"
        },
    ];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-4xl font-black tracking-tight mb-2">System Overview</h1>
                <p className="text-gray-400">Holistic view of the OpenCCB ecosystem.</p>
            </div>

            {/* Stat Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <div key={card.label} className="p-8 rounded-3xl glass-card border-white/5 bg-white/[0.02] flex flex-col gap-4">
                        <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>
                            <card.icon size={24} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">{card.label}</div>
                            <div className="text-4xl font-black">{loading ? "..." : card.value}</div>
                            <p className="text-xs text-gray-500 mt-2">{card.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* System Health */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">Service Status</h2>
                    <div className="flex items-center gap-2 text-green-400 text-xs font-bold">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        All systems operational
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Server className="text-blue-400" size={20} />
                            <div>
                                <div className="text-sm font-bold">API Services (CMS/LMS)</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Rust Axum Cluster</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded-full font-black uppercase">Online</span>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Zap className="text-amber-400" size={20} />
                            <div>
                                <div className="text-sm font-bold">Local AI Services</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Whisper + Ollama</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded-full font-black uppercase">Online</span>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Clock className="text-indigo-400" size={20} />
                            <div>
                                <div className="text-sm font-bold">Background Workers</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Notification Scheduler</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded-full font-black uppercase">Running</span>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <ShieldAlert className="text-red-400" size={20} />
                            <div>
                                <div className="text-sm font-bold">Security Engine</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">JWT & RBAC Middleware</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded-full font-black uppercase">Active</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
