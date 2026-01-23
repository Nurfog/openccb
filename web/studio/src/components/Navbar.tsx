'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/I18nContext';
import { LayoutDashboard, ShieldCheck, LogOut, Webhook, Settings, Globe } from 'lucide-react';

export function Navbar() {
    const { t, language, setLanguage } = useTranslation();
    const { user, logout } = useAuth();

    return (
        <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 bg-black/20">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight">
                        Open<span className="gradient-text">CCB</span> Studio
                    </h1>
                </Link>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            {t('nav.courses')}
                        </Link>

                        {user?.role === 'admin' && (
                            <>
                                {user.organization_id === '00000000-0000-0000-0000-000000000001' && (
                                    <Link
                                        href="/admin"
                                        className="text-sm font-black text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-glow-sm"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
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

                    {/* Language Switcher */}
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
                        >
                            <option value="en" className="bg-gray-900">EN</option>
                            <option value="es" className="bg-gray-900">ES</option>
                            <option value="pt" className="bg-gray-900">PT</option>
                        </select>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    {user ? (
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-medium text-white">{user.full_name}</span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</span>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all text-gray-500"
                                title="Sign Out"
                            >
                                <LogOut className="w-4 h-4" />
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
