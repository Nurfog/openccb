"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Building2,
    Users,
    ClipboardList,
    ShieldCheck,
    ArrowLeft,
    Activity,
    TrendingUp,
    Mic,
    FileArchive,
    Gauge,
    MessageSquare,
    BrainCircuit,
    Shield
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
        { icon: Building2, label: "Organizations", href: "/admin" },
        { icon: Users, label: "Users", href: "/admin/users" },
        { icon: Gauge, label: "Tokens IA", href: "/admin/token-usage" },
        { icon: BrainCircuit, label: "Auditoría IA", href: "/admin/ai-audit" },
        { icon: Shield, label: "Ética de Datos", href: "/admin/data-ethics" },
        { icon: MessageSquare, label: "FAQ Moderation", href: "/admin/faq-review" },
        { icon: FileArchive, label: "Material Compartido", href: "/admin/materials" },
        { icon: Mic, label: "Audio Evaluations", href: "/admin/audio-evaluations" },
        { icon: ClipboardList, label: "Audit Logs", href: "/admin/audit" },
        { icon: Activity, label: "System Tasks", href: "/admin/tasks" },
        { icon: TrendingUp, label: "Control Global IA", href: "/admin/ai-usage-global" },
    ];

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-transparent text-slate-900 dark:text-white transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-black/20 backdrop-blur-xl p-6 flex flex-col gap-8 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-gray-500 leading-tight">Control Panel</h2>
                        <h1 className="font-black text-lg tracking-tighter text-slate-900 dark:text-white">SUPER ADMIN</h1>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-black text-base transition-all ${pathname === item.href
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                : "text-slate-600 hover:text-slate-900 dark:text-gray-200 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="pt-6 border-t border-slate-200 dark:border-white/5">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-gray-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to Studio
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 md:p-12 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
