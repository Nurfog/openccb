"use client";

import { FileText, Download, Eye, ExternalLink } from "lucide-react";
import { getCmsApiUrl } from "@/lib/api";

interface DocumentPlayerProps {
    id: string;
    title?: string;
    url: string;
}

export default function DocumentPlayer({ id, title, url }: DocumentPlayerProps) {
    if (!url) return null;

    const isPdf = url.toLowerCase().endsWith(".pdf");

    const getFullUrl = (path: string) => {
        if (path.startsWith('http')) return path;
        const cleanPath = path.startsWith('/uploads') ? path.replace('/uploads', '/assets') : path;
        const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
        return `${getCmsApiUrl()}${finalPath}`;
    };

    const displayUrl = getFullUrl(url);

    return (
        <div className="space-y-6" id={id}>
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                    {title || "Material de Lectura"}
                </h3>
            </div>

            <div className="relative">
                {isPdf ? (
                    <div className="glass-card !p-0 overflow-hidden border-white/5 bg-white/5 aspect-[4/3] w-full group relative">
                        <iframe
                            src={`${displayUrl}#view=FitH&toolbar=0`}
                            className="w-full h-full border-none"
                            title={title || "Document Preview"}
                        />

                        {/* Overlay Controls */}
                        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/50 flex items-center gap-2">
                                <Eye size={12} /> Vista Previa
                            </span>
                            <div className="flex gap-2">
                                <a
                                    href={displayUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10"
                                >
                                    <ExternalLink size={12} /> Pantalla Completa
                                </a>
                                <a
                                    href={displayUrl}
                                    download
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                                >
                                    <Download size={12} /> Descargar
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-12 flex flex-col items-center text-center gap-6 border-white/5 bg-white/5">
                        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <FileText size={40} />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-white mb-2">Documento Adjunto</p>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto uppercase tracking-widest font-black leading-relaxed">
                                Este archivo no puede previsualizarse. Descárgalo para leerlo.
                            </p>
                        </div>
                        <a
                            href={displayUrl}
                            download
                            className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-500/40 active:scale-95"
                        >
                            <Download size={20} /> Descargar Archivo
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
