'use client';

import Link from "next/link";
import Image from "next/image";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { LogOut, Globe, Menu, X, Sun, Moon } from "lucide-react";
import NotificationCenter from "./NotificationCenter";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";

import { lmsApi, getImageUrl } from "@/lib/api";

export default function AppHeader() {
    const { t, language, setLanguage } = useTranslation();
    const { branding } = useBranding();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Use platform_name if available, otherwise name, otherwise default
    const platformName = branding?.platform_name || branding?.name || 'OpenCCB';

    return (
        <header className="h-16 glass sticky top-0 z-[100] px-4 md:px-6 flex items-center justify-between backdrop-blur-xl bg-gray-50/70 dark:bg-black/40 border-b border-black/5 dark:border-white/5">
            <Link href="/" className="flex items-center gap-2 md:gap-5 group" aria-label={`${platformName} - Dashboard`}>
                <div className={`rounded-lg md:rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all overflow-hidden relative border border-white/5 ${branding?.logo_variant === 'wide' ? 'w-36 h-9 md:w-56 md:h-12 px-2 bg-white' : 'w-8 h-8 md:w-12 md:h-12'}`}>
                    {branding?.logo_url ? (
                        <Image src={getImageUrl(branding.logo_url)} alt="" fill className={`object-contain ${branding?.logo_variant === 'wide' ? 'p-1' : 'p-0.5'}`} sizes={branding?.logo_variant === 'wide' ? '240px' : '48px'} />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700" aria-hidden="true">
                            {platformName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                {branding?.logo_variant !== 'wide' && (
                    <div className="flex flex-col -gap-1" aria-hidden="true">
                        <span className="font-black text-base md:text-xl tracking-tighter text-gray-900 dark:text-white leading-none">
                            {platformName.toUpperCase()}
                        </span>
                        <span className="text-[8px] md:text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-500 uppercase">EXPERIENCIA</span>
                    </div>
                )}
            </Link>

            <div className="flex items-center gap-4">
                <nav className="hidden md:flex items-center gap-8 mr-4" aria-label="Navegación principal">
                    <Link href="/" className="nav-link-standard text-slate-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        {t('nav.catalog')}
                    </Link>
                    <Link href="/my-learning" className="nav-link-standard text-slate-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        {t('nav.myLearning')}
                    </Link>
                    <Link href="/bookmarks" className="nav-link-standard text-slate-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        {t('nav.bookmarks')}
                    </Link>

                    {user && (
                        <Link href={`/profile/${user.id}`} className="nav-link-standard text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                            MI PORTAFOLIO
                        </Link>
                    )}
                </nav>

                <div className="flex items-center gap-2 md:gap-4">
                    <NotificationCenter />

                    <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-4">
                        <Globe size={14} className="text-gray-500" aria-hidden="true" />
                        <select
                            id="language-selector"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            aria-label={t('nav.selectLanguage') || 'Select Language'}
                            className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors focus:outline-none cursor-pointer"
                        >
                            <option value="en" className="bg-white dark:bg-[#0f1115]">EN</option>
                            <option value="es" className="bg-white dark:bg-[#0f1115]">ES</option>
                            <option value="pt" className="bg-white dark:bg-[#0f1115]">PT</option>
                        </select>
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all border-l border-white/10 pl-4"
                        title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>

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
                            aria-label={t('nav.signOut')}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={isMenuOpen}
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-[150] md:hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setIsMenuOpen(false)}
                >
                    <div
                        className="absolute right-0 top-0 bottom-0 w-64 glass border-l border-white/10 p-6 flex flex-col animate-in slide-in-from-right duration-300"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menú móvil"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-8">
                            <span className="font-black text-xs uppercase tracking-[0.2em] text-gray-500">Menú</span>
                            <button
                                onClick={() => setIsMenuOpen(false)}
                                className="p-2 hover:bg-white/5 rounded-lg"
                                aria-label="Close menu"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex flex-col gap-6 flex-1" aria-label="Mobile navigation">
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
                            <Link
                                href="/bookmarks"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-sm font-black uppercase tracking-widest text-gray-300 hover:text-white border-l-2 border-transparent hover:border-blue-500 pl-4 transition-all"
                            >
                                {t('nav.bookmarks')}
                            </Link>
                            {user && (
                                <Link
                                    href={`/profile/${user.id}`}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="text-sm font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 border-l-2 border-transparent hover:border-blue-500 pl-4 transition-all"
                                >
                                    MI PORTAFOLIO
                                </Link>
                            )}

                            <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
                                <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <Globe size={16} className="text-gray-500" aria-hidden="true" />
                                        <select
                                            id="mobile-language-selector"
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                            aria-label={t('nav.selectLanguage') || 'Select Language'}
                                            className="bg-transparent text-xs font-bold uppercase tracking-widest text-gray-300 focus:outline-none"
                                        >
                                            <option value="en" className="bg-white dark:bg-[#0f1115]">English</option>
                                            <option value="es" className="bg-white dark:bg-[#0f1115]">Español</option>
                                            <option value="pt" className="bg-white dark:bg-[#0f1115]">Português</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={toggleTheme}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                    >
                                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                    </button>
                                </div>
                            </div>
                        </nav>

                        <div className="pt-6 border-t border-white/5 space-y-4">
                            <Link
                                href="/profile"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-xs text-blue-400" aria-hidden="true">
                                    {user?.full_name?.charAt(0) || 'U'}
                                </div>
                                <span className="text-sm font-bold">{user?.full_name || 'Mi Perfil'}</span>
                            </Link>
                            <button
                                onClick={logout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut size={18} aria-hidden="true" />
                                <span className="text-sm font-bold">{t('nav.signOut')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
