"use client";

import { useAuth } from "@/context/AuthContext";
import { LogOut, ShieldAlert, Building2 } from "lucide-react";
import Link from "next/link";

export default function AuthHeader() {
    const { user, logout } = useAuth();
    return (
        <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
                <>
                    <Link href="/admin/organizations" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                        <Building2 size={16} /> Org
                    </Link>
                    <Link href="/admin/audit" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                        <ShieldAlert size={16} /> Audit
                    </Link>
                </>
            )}
            {user && (
                <>
                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs">
                        {user.full_name.charAt(0)}
                    </div>
                    <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <LogOut size={16} />
                    </button>
                </>
            )}
        </div>
    );
}
