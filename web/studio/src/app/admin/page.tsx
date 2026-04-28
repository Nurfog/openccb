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
    ShieldAlert,
    Gauge,
    TrendingUp
} from "lucide-react";

interface TokenStats {
    total_tokens: number;
    total_requests: number;
    total_cost_usd: number;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        orgs: 0,
        users: 0,
        courses: 0
    });
    const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // In a real app we'd have a specific stats endpoint,
                // but for now we'll calculate from lists
                const [org, users, tokenResp] = await Promise.all([
                    cmsApi.getOrganization(),
                    cmsApi.getAllUsers(),
                    fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/admin/token-usage`, {
                        credentials: 'include',
                    })
                ]);

                setStats({
                    orgs: 1, // Single tenant architecture
                    users: users.length,
                    courses: 0 // We'd need a global courses count
                });
                
                // Load token stats
                if (tokenResp.ok) {
                    const tokenData = await tokenResp.json();
                    setTokenStats({
                        total_tokens: tokenData.stats?.total_tokens || 0,
                        total_requests: tokenData.stats?.total_requests || 0,
                        total_cost_usd: tokenData.stats?.total_cost_usd || 0,
                    });
                }
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
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10",
            desc: "Active institutional tenants"
        },
        {
            label: "Total Users",
            value: stats.users,
            icon: Users,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-500/10",
            desc: "Registered globally"
        },
        {
            label: "Global Courses",
            value: stats.courses,
            icon: BookOpen,
            color: "text-green-600 dark:text-green-400",
            bg: "bg-green-500/10",
            desc: "Managed across all orgs"
        },
    ];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-4xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">System Overview</h1>
                <p className="text-slate-500 dark:text-gray-400">Holistic view of the OpenCCB ecosystem.</p>
            </div>

            {/* Stat Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => (
                    <div key={card.label} className="p-8 rounded-3xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex flex-col gap-4 shadow-sm dark:shadow-none">
                        <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>
                            <card.icon size={24} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-1">{card.label}</div>
                            <div className="text-4xl font-black text-slate-900 dark:text-white">{loading ? "..." : card.value}</div>
                            <p className="text-xs text-slate-500 dark:text-gray-500 mt-2">{card.desc}</p>
                        </div>
                    </div>
                ))}
                
                {/* AI Token Usage Card */}
                <div className="p-8 rounded-3xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex flex-col gap-4 shadow-sm dark:shadow-none">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Gauge size={24} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-1">AI Token Usage</div>
                        <div className="text-4xl font-black text-slate-900 dark:text-white">
                            {loading ? "..." : tokenStats ? new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(tokenStats.total_tokens) : 'N/A'}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-2">
                            {tokenStats ? `${new Intl.NumberFormat('en-US').format(tokenStats.total_requests)} requests • $${tokenStats.total_cost_usd.toFixed(2)}` : 'Loading...'}
                        </p>
                    </div>
                    <a href="/admin/token-usage" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 mt-2">
                        View Details <TrendingUp className="w-3 h-3" />
                    </a>
                </div>
            </div>

            {/* System Health */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Service Status</h2>
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-bold">
                        <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
                        All systems operational
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.01] flex items-center justify-between shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-4">
                            <Server className="text-blue-600 dark:text-blue-400" size={20} />
                            <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">API Services (CMS/LMS)</div>
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest">Rust Axum Cluster</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-black uppercase">Online</span>
                    </div>

                    <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.01] flex items-center justify-between shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-4">
                            <Zap className="text-amber-600 dark:text-amber-400" size={20} />
                            <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">Local AI Services</div>
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest">Whisper + Ollama</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-black uppercase">Online</span>
                    </div>

                    <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.01] flex items-center justify-between shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-4">
                            <Clock className="text-indigo-600 dark:text-indigo-400" size={20} />
                            <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">Background Workers</div>
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest">Notification Scheduler</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-black uppercase">Running</span>
                    </div>

                    <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.01] flex items-center justify-between shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-4">
                            <ShieldAlert className="text-red-600 dark:text-red-400" size={20} />
                            <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">Security Engine</div>
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest">JWT & RBAC Middleware</div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-black uppercase">Active</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
