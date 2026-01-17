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
    Activity
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
        { icon: Building2, label: "Organizations", href: "/admin/organizations" },
        { icon: Users, label: "Users", href: "/admin/users" },
        { icon: ClipboardList, label: "Audit Logs", href: "/admin/audit" },
        { icon: Activity, label: "System Tasks", href: "/admin/tasks" },
    ];

    return (
        <div className="flex min-h-screen bg-[#0f1115] text-white">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-black/20 backdrop-blur-xl p-6 flex flex-col gap-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="font-black text-xs uppercase tracking-widest text-gray-500 leading-tight">Control Panel</h2>
                        <h1 className="font-black text-lg tracking-tighter">SUPER ADMIN</h1>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${pathname === item.href
                                    ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-glow-sm"
                                    : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="pt-6 border-t border-white/5">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to Studio
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-12 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
