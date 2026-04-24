'use client';

import Link from "next/link";
import Image from "next/image";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { LogOut, Globe, Menu, X, Sun, Moon, Search } from "lucide-react";
import NotificationCenter from "./NotificationCenter";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";

import { getImageUrl, lmsApi } from "@/lib/api";

export default function AppHeader() {
    const { t, language, setLanguage } = useTranslation();
    const { branding } = useBranding();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // ── Búsqueda global ──
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<Array<{ id: string; kind: string; title: string; snippet?: string; url: string; course_title?: string }>>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const runSearch = useCallback(async (q: string) => {
        if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const res = await lmsApi.globalSearch(q);
            setSearchResults(res.results ?? []);
        } catch {
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, []);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => runSearch(searchQuery), 350);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [searchQuery, runSearch]);

    // Cerrar al hacer click fuera
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function handleSearchSelect(url: string) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
        setSearchActiveIndex(-1);
        router.push(url);
    }

    function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!searchOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setSearchOpen(true);
            return;
        }

        if (e.key === 'Escape') {
            setSearchOpen(false);
            setSearchActiveIndex(-1);
            return;
        }

        if (!searchResults.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSearchActiveIndex((prev) => (prev + 1) % searchResults.length);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSearchActiveIndex((prev) => (prev <= 0 ? searchResults.length - 1 : prev - 1));
            return;
        }

        if (e.key === 'Enter' && searchActiveIndex >= 0) {
            e.preventDefault();
            const selected = searchResults[searchActiveIndex];
            if (selected) {
                handleSearchSelect(selected.url);
            }
        }
    }

    const kindLabel: Record<string, string> = {
        course: "Curso",
        lesson: "Lección",
        discussion: "Foro",
        announcement: "Anuncio",
    };

    // Use platform_name if available, otherwise name, otherwise default
    const platformName = branding?.platform_name || branding?.name || 'Academia';

    return (
        <>
        <header className="h-16 glass sticky top-0 z-[100] px-4 md:px-6 flex items-center justify-between backdrop-blur-xl bg-gray-50/80 dark:bg-black/40 border-b border-black/8 dark:border-white/5">
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
                {/* Búsqueda global */}
                {user && (
                    <div ref={searchRef} className="relative hidden md:block">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                id="global-search"
                                type="text"
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    setSearchOpen(true);
                                    setSearchActiveIndex(-1);
                                }}
                                onFocus={() => setSearchOpen(true)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Buscar cursos, lecciones..."
                                role="combobox"
                                aria-expanded={searchOpen}
                                aria-controls="global-search-results"
                                aria-autocomplete="list"
                                aria-activedescendant={searchActiveIndex >= 0 ? `search-option-${searchActiveIndex}` : undefined}
                                aria-label="Buscar cursos, lecciones, foros y anuncios"
                                className="w-56 lg:w-72 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-700 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 transition-all"
                            />
                        </div>
                        {searchOpen && searchQuery.length >= 2 && (
                            <div className="absolute top-full mt-2 left-0 w-80 lg:w-96 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden">
                                {searchLoading ? (
                                    <div className="p-4 text-sm text-gray-400 text-center">Buscando...</div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-400 text-center">Sin resultados para &quot;{searchQuery}&quot;</div>
                                ) : (
                                    <ul id="global-search-results" role="listbox" className="max-h-80 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
                                        {searchResults.map((r, idx) => (
                                            <li key={`${r.kind}-${r.id}`} role="presentation">
                                                <button
                                                    id={`search-option-${idx}`}
                                                    role="option"
                                                    aria-selected={searchActiveIndex === idx}
                                                    onClick={() => handleSearchSelect(r.url)}
                                                    className={`w-full px-4 py-3 text-left transition-colors flex flex-col gap-0.5 ${searchActiveIndex === idx ? 'bg-blue-50 dark:bg-white/10' : 'hover:bg-blue-50 dark:hover:bg-white/5'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                            {kindLabel[r.kind] ?? r.kind}
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">{r.title}</span>
                                                    </div>
                                                    {r.snippet && (
                                                        <p className="text-xs text-gray-400 truncate pl-0.5">{r.snippet}</p>
                                                    )}
                                                    {r.course_title && r.kind !== 'course' && (
                                                        <p className="text-xs text-gray-500 truncate pl-0.5">en {r.course_title}</p>
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {user && (
                    <nav className="hidden md:flex items-center gap-8 mr-4" aria-label="Navegación principal">
                        <Link href="/" className="flex items-center gap-2 text-base font-black uppercase tracking-wider transition-colors text-slate-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
                            {t('nav.catalog')}
                        </Link>
                        <Link href="/my-learning" className="flex items-center gap-2 text-base font-black uppercase tracking-wider transition-colors text-slate-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
                            {t('nav.myLearning')}
                        </Link>
                        <Link href="/bookmarks" className="flex items-center gap-2 text-base font-black uppercase tracking-wider transition-colors text-slate-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
                            {t('nav.bookmarks')}
                        </Link>

                        <Link href={`/profile/${user.id}`} className="flex items-center gap-2 text-base font-black uppercase tracking-wider transition-colors text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                            MI PORTAFOLIO
                        </Link>
                    </nav>
                )}

                <div className="flex items-center gap-2 md:gap-4">
                    {user && <NotificationCenter />}

                    <div className="hidden sm:flex items-center gap-2 border-l border-black/10 dark:border-white/10 pl-4">
                        <Globe size={14} className="text-gray-500" aria-hidden="true" />
                        <select
                            id="language-selector"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            aria-label={t('nav.selectLanguage') || 'Select Language'}
                            className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors focus:outline-none cursor-pointer"
                        >
                            <option value="en" className="bg-white dark:bg-[#0f1115]">EN</option>
                            <option value="es" className="bg-white dark:bg-[#0f1115]">ES</option>
                            <option value="pt" className="bg-white dark:bg-[#0f1115]">PT</option>
                        </select>
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all border-l border-black/10 dark:border-white/10 pl-4"
                        title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>

                    {user ? (
                        <div className="hidden md:flex items-center gap-4 pl-4 border-l border-black/10 dark:border-white/10">
                            <Link href="/profile" className="flex items-center gap-2 group/profile">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400 group-hover/profile:border-blue-500/50 transition-colors">
                                    {user.full_name?.charAt(0) || 'U'}
                                </div>
                            </Link>
                            <button
                                onClick={logout}
                                className="p-2 hover:bg-red-500/10 rounded-full text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                title={t('nav.signOut')}
                                aria-label={t('nav.signOut')}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <Link href="/auth/login" className="hidden md:inline-flex text-sm font-bold text-blue-600 hover:text-blue-500 transition-colors">Sign In</Link>
                    )}

                    {/* Mobile Menu Button */}
                    {user && (
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="md:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
                            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                            aria-expanded={isMenuOpen}
                        >
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    )}
                </div>
            </div>
            </header>

                {/* Mobile Sidebar Overlay — fuera del <header> para que el
                    backdrop-filter no cree un stacking context que confine el fixed */}
                {isMenuOpen && (
                <div
                    className="fixed inset-0 z-[150] md:hidden bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setIsMenuOpen(false)}
                >
                    <div
                        className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-white/10 p-6 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menú móvil"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-8">
                            <span className="font-black text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Menú</span>
                            <button
                                onClick={() => setIsMenuOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                                aria-label="Cerrar menú"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex flex-col gap-2 flex-1" aria-label="Mobile navigation">
                            <Link
                                href="/"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white border-l-2 border-transparent hover:border-blue-500 pl-4 py-2 transition-all"
                            >
                                {t('nav.catalog')}
                            </Link>
                            <Link
                                href="/my-learning"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white border-l-2 border-transparent hover:border-blue-500 pl-4 py-2 transition-all"
                            >
                                {t('nav.myLearning')}
                            </Link>
                            <Link
                                href="/bookmarks"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white border-l-2 border-transparent hover:border-blue-500 pl-4 py-2 transition-all"
                            >
                                {t('nav.bookmarks')}
                            </Link>
                            {user && (
                                <Link
                                    href={`/profile/${user.id}`}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border-l-2 border-transparent hover:border-blue-500 pl-4 py-2 transition-all"
                                >
                                    MI PORTAFOLIO
                                </Link>
                            )}

                            <div className="pt-6 mt-6 border-t border-gray-100 dark:border-white/5 space-y-4">
                                <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <Globe size={16} className="text-gray-400" aria-hidden="true" />
                                        <select
                                            id="mobile-language-selector"
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                            aria-label={t('nav.selectLanguage') || 'Select Language'}
                                            className="bg-transparent text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 focus:outline-none"
                                        >
                                            <option value="en" className="bg-white dark:bg-[#0f1115]">English</option>
                                            <option value="es" className="bg-white dark:bg-[#0f1115]">Español</option>
                                            <option value="pt" className="bg-white dark:bg-[#0f1115]">Português</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={toggleTheme}
                                        className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                                    >
                                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                    </button>
                                </div>
                            </div>
                        </nav>

                        <div className="pt-6 border-t border-gray-100 dark:border-white/5 space-y-2">
                            <Link
                                href="/profile"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400" aria-hidden="true">
                                    {user?.full_name?.charAt(0) || 'U'}
                                </div>
                                <span className="text-sm font-bold text-gray-800 dark:text-white">{user?.full_name || 'Mi Perfil'}</span>
                            </Link>
                            <button
                                onClick={logout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut size={18} aria-hidden="true" />
                                <span className="text-sm font-bold">{t('nav.signOut')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </>
        );
}
