"use client";

import { useAuth } from "@/context/AuthContext";
import { LogOut, ShieldAlert, Building2, Activity, Settings } from "lucide-react";
import Link from "next/link";

export default function AuthHeader() {
    const { user, logout } = useAuth();
    return (
        <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
                <>
                    <Link href="/admin/organizations" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2" title="Organizations">
                        <Building2 size={16} /> <span className="hidden md:inline">Org</span>
                    </Link>
                    <Link href="/admin/audit" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2" title="Audit Logs">
                        <ShieldAlert size={16} /> <span className="hidden md:inline">Audit</span>
                    </Link>
                    <Link href="/admin/tasks" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2" title="Tasks">
                        <Activity size={16} /> <span className="hidden md:inline">Tasks</span>
                    </Link>
                    <Link href="/settings" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2" title="Settings">
                        <Settings size={16} /> <span className="hidden md:inline">Settings</span>
                    </Link>
                </>
            )}
            {user && (
                <>
                    <Link href="/profile" className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs hover:border-blue-500/50 transition-colors">
                        {user.full_name.charAt(0)}
                    </Link>
                    <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <LogOut size={16} />
                    </button>
                </>
            )}
        </div>
    );
}
