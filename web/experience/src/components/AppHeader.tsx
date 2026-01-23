'use client';

import Link from "next/link";
import Image from "next/image";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { LogOut, Globe } from "lucide-react";
import NotificationCenter from "./NotificationCenter";

import { lmsApi, getImageUrl } from "@/lib/api";

export default function AppHeader() {
    const { t, language, setLanguage } = useTranslation();
    const { branding } = useBranding();
    const { user, logout } = useAuth();

    // Use platform_name if available, otherwise name, otherwise default
    const platformName = branding?.platform_name || branding?.name || 'OpenCCB';

    return (
        <header className="h-16 glass sticky top-0 z-50 px-6 flex items-center justify-between backdrop-blur-xl bg-black/40 border-b border-white/5">
            <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all overflow-hidden relative">
                    {branding?.logo_url ? (
                        <Image src={getImageUrl(branding.logo_url)} alt={branding.name} fill className="object-contain" sizes="40px" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
                            {platformName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="flex flex-col -gap-1">
                    <span className="font-black text-lg tracking-tighter text-white leading-none">
                        {platformName.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-black tracking-widest text-blue-500 uppercase">EXPERIENCIA</span>
                </div>
            </Link>

            <nav className="flex items-center gap-2 md:gap-8">
                <div className="hidden md:flex items-center gap-8 mr-4">
                    <Link href="/" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors">
                        {t('nav.catalog')}
                    </Link>
                    <Link href="/my-learning" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors">
                        {t('nav.myLearning')}
                    </Link>
                </div>

                <NotificationCenter />

                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                    <Globe size={14} className="text-gray-500" />
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors focus:outline-none cursor-pointer"
                    >
                        <option value="en" className="bg-[#0f1115]">EN</option>
                        <option value="es" className="bg-[#0f1115]">ES</option>
                        <option value="pt" className="bg-[#0f1115]">PT</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 md:gap-4 pl-4 border-l border-white/10">
                    <Link href="/profile" className="flex items-center gap-2 group/profile">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-blue-400 group-hover/profile:border-blue-500/50 transition-colors">
                            {user?.full_name?.charAt(0) || 'U'}
                        </div>
                    </Link>
                    <button
                        onClick={logout}
                        className="p-2 hover:bg-red-500/10 rounded-full text-gray-400 hover:text-red-400 transition-colors"
                        title={t('nav.signOut')}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </nav>
        </header>
    );
}
