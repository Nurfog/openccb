'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/I18nContext';
import { LayoutDashboard, ShieldCheck, LogOut, Webhook, Settings, Globe, Library, BookOpen, Sun, Moon } from 'lucide-react';
import { useBranding } from '@/context/BrandingContext';
import { useTheme } from '@/context/ThemeContext';
import { getImageUrl } from '@/lib/api';
import Image from 'next/image';

export function Navbar() {
    const { t, language, setLanguage } = useTranslation();
    const { user, logout } = useAuth();
    const { branding } = useBranding();
    const { theme, toggleTheme } = useTheme();

    const platformName = branding?.platform_name || 'OpenCCB';

    return (
        <nav className="fixed top-0 w-full z-50 glass border-b border-black/5 dark:border-white/10 bg-gray-50/70 dark:bg-black/40 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 md:gap-4 group" aria-label={`${platformName} Studio - Dashboard`}>
                    <div className={`rounded-lg md:rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all overflow-hidden relative border border-white/5 ${branding?.logo_variant === 'wide' ? 'w-32 h-8 md:w-48 md:h-10 px-2 bg-white' : 'w-8 h-8 md:w-10 md:h-10'}`}>
                        {branding?.logo_url ? (
                            <Image src={getImageUrl(branding.logo_url)} alt="" fill className={`object-contain ${branding?.logo_variant === 'wide' ? 'p-1' : ''}`} sizes={branding?.logo_variant === 'wide' ? '200px' : '40px'} />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700" aria-hidden="true">
                                <BookOpen size={branding?.logo_variant === 'wide' ? 16 : 20} />
                            </div>
                        )}
                    </div>
                    {branding?.logo_variant !== 'wide' && (
                        <div className="flex flex-col -gap-1">
                            <span className="font-black text-sm md:text-lg tracking-tighter text-gray-900 dark:text-white leading-none">
                                {platformName.toUpperCase()}
                            </span>
                            <span className="text-[8px] md:text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-500 uppercase">STUDIO</span>
                        </div>
                    )}
                </Link>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            {t('nav.courses')}
                        </Link>

                        <Link
                            href="/library/assets"
                            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            <Library className="w-4 h-4" aria-hidden="true" />
                            {t('nav.library') || 'Library'}
                        </Link>

                        {user?.role === 'admin' && (
                            <>
                                {user.organization_id === '00000000-0000-0000-0000-000000000001' && (
                                    <Link
                                        href="/admin"
                                        className="text-sm font-black text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-glow-sm"
                                    >
                                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                                        {t('nav.globalControl')}
                                    </Link>
                                )}
                                <Link
                                    href="/settings/webhooks"
                                    className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                                >
                                    <Webhook className="w-4 h-4" />
                                    {t('nav.webhooks')}
                                </Link>
                                <Link
                                    href="/profile"
                                    className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    {t('nav.profile')}
                                </Link>
                            </>
                        )}

                        <Link
                            href="/settings"
                            className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </Link>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    <div className="h-6 w-px bg-white/10 mx-2" />
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-500" aria-hidden="true" />
                        <select
                            id="studio-language-selector"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            aria-label={t('nav.selectLanguage') || 'Select Language'}
                            className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
                        >
                            <option value="en" className="bg-white dark:bg-gray-900">EN</option>
                            <option value="es" className="bg-white dark:bg-gray-900">ES</option>
                            <option value="pt" className="bg-white dark:bg-gray-900">PT</option>
                        </select>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    {user ? (
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-medium text-gray-900 dark:text-white">{user.full_name}</span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</span>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all text-gray-500"
                                title={t('nav.signOut') || "Sign Out"}
                                aria-label={t('nav.signOut') || "Sign Out"}
                            >
                                <LogOut className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/auth/login"
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
