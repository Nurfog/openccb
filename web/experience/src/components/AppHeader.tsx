'use client';

import Link from "next/link";
import { useBranding } from "@/context/BrandingContext";

export default function AppHeader() {
    const { branding } = useBranding();

    return (
        <header className="h-16 glass sticky top-0 z-50 px-6 flex items-center justify-between backdrop-blur-xl bg-black/40 border-b border-white/5">
            <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all overflow-hidden relative">
                    {branding?.logo_url ? (
                        <img src={branding.logo_url} alt={branding.name} className="w-full h-full object-contain" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">L</div>
                    )}
                </div>
                <div className="flex flex-col -gap-1">
                    <span className="font-black text-lg tracking-tighter text-white leading-none">
                        {branding?.name?.toUpperCase() || 'LEARN'}
                    </span>
                    {!branding && <span className="text-[10px] font-black tracking-widest text-blue-500 uppercase">EXPERIENCE</span>}
                </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
                <Link href="/" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors">Catalog</Link>
                <Link href="#" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors">My Learning</Link>
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10" />
            </nav>
        </header>
    );
}
