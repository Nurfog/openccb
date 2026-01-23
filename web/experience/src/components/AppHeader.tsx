'use client';

import Link from "next/link";
import Image from "next/image";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { LogOut, Globe, Menu, X } from "lucide-react";
import NotificationCenter from "./NotificationCenter";
import { useState } from "react";

import { lmsApi, getImageUrl } from "@/lib/api";

export default function AppHeader() {
    const { t, language, setLanguage } = useTranslation();
    const { branding } = useBranding();
    const { user, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Use platform_name if available, otherwise name, otherwise default
    const platformName = branding?.platform_name || branding?.name || 'OpenCCB';

    return (
        <header className="h-16 glass sticky top-0 z-[100] px-4 md:px-6 flex items-center justify-between backdrop-blur-xl bg-black/40 border-b border-white/5">
            <Link href="/" className="flex items-center gap-2 md:gap-3 group">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all overflow-hidden relative">
                    {branding?.logo_url ? (
                        <Image src={getImageUrl(branding.logo_url)} alt={branding.name} fill className="object-contain" sizes="40px" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
                            {platformName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="flex flex-col -gap-1">
                    <span className="font-black text-sm md:text-lg tracking-tighter text-white leading-none">
                        {platformName.toUpperCase()}
                    </span>
                    <span className="text-[8px] md:text-[10px] font-black tracking-widest text-blue-500 uppercase">EXPERIENCIA</span>
                </div>
            </Link>

            <div className="flex items-center gap-4">
                <nav className="hidden md:flex items-center gap-8 mr-4">
                    <Link href="/" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors">
                        {t('nav.catalog')}
                    </Link>
                    <Link href="/my-learning" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors">
                        {t('nav.myLearning')}
                    </Link>
                </nav>

                <div className="flex items-center gap-2 md:gap-4">
                    <NotificationCenter />

                    <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-4">
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

                    <div className="hidden md:flex items-center gap-4 pl-4 border-l border-white/10">
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

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[150] md:hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute right-0 top-0 bottom-0 w-64 glass border-l border-white/10 p-6 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <span className="font-black text-xs uppercase tracking-[0.2em] text-gray-500">Menú</span>
                            <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex flex-col gap-6 flex-1">
                            <Link
                                href="/"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-sm font-black uppercase tracking-widest text-gray-300 hover:text-white border-l-2 border-transparent hover:border-blue-500 pl-4 transition-all"
                            >
                                {t('nav.catalog')}
                            </Link>
                            <Link
                                href="/my-learning"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-sm font-black uppercase tracking-widest text-gray-300 hover:text-white border-l-2 border-transparent hover:border-blue-500 pl-4 transition-all"
                            >
                                {t('nav.myLearning')}
                            </Link>

                            <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
                                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5">
                                    <Globe size={16} className="text-gray-500" />
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="bg-transparent text-xs font-bold uppercase tracking-widest text-gray-300 focus:outline-none flex-1"
                                    >
                                        <option value="en" className="bg-[#0f1115]">English</option>
                                        <option value="es" className="bg-[#0f1115]">Español</option>
                                        <option value="pt" className="bg-[#0f1115]">Português</option>
                                    </select>
                                </div>
                            </div>
                        </nav>

                        <div className="pt-6 border-t border-white/5 space-y-4">
                            <Link
                                href="/profile"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-xs text-blue-400">
                                    {user?.full_name?.charAt(0) || 'U'}
                                </div>
                                <span className="text-sm font-bold">{user?.full_name || 'Mi Perfil'}</span>
                            </Link>
                            <button
                                onClick={logout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut size={18} />
                                <span className="text-sm font-bold">{t('nav.signOut')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
