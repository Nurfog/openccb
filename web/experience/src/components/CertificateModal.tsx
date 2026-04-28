"use client";

import { X, Printer, Download, Award, ShieldCheck } from "lucide-react";
import { CertificateResponse } from "@/lib/api";
import DOMPurify from "isomorphic-dompurify";

interface CertificateModalProps {
    certificate: CertificateResponse;
    onClose: () => void;
}

export default function CertificateModal({ certificate, onClose }: CertificateModalProps) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-5xl md:h-[90vh] bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border border-white/10">
                
                {/* Header / Toolbar */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 no-print">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Award size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Certificado Oficial</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500">Emitido el {new Date(certificate.issued_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handlePrint}
                            className="p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-gray-400 transition-all flex items-center gap-2 text-xs font-bold"
                        >
                            <Printer size={18} />
                            <span className="hidden sm:inline">Imprimir / PDF</span>
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-3 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Certificate Content Wrapper */}
                <div className="flex-1 overflow-y-auto p-4 md:p-12 flex items-center justify-center bg-slate-100 dark:bg-black/40">
                    <div className="certificate-container shadow-2xl ring-1 ring-black/5">
                        {/* Sanitizar HTML con DOMPurify antes de inyectar */}
                        <div 
                            className="bg-white"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(certificate.certificate_html) }} 
                        />
                    </div>
                </div>

                {/* Footer Info */}
                <div className="p-6 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500">
                        <ShieldCheck size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Este certificado es auténtico y verificable</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 flex items-center gap-2">
                        Código: <code className="bg-slate-200 dark:bg-white/5 px-2 py-1 rounded text-blue-600 dark:text-blue-400 font-mono">{certificate.verification_code}</code>
                    </div>
                </div>

                <style jsx global>{`
                    .certificate-container {
                        width: 100%;
                        max-width: 800px;
                        background: white;
                        transform-origin: center;
                    }
                    @media print {
                        .no-print { display: none !important; }
                        body { background: white !important; margin: 0 !important; padding: 0 !important; }
                        .certificate-container { 
                            box-shadow: none !important; 
                            ring: none !important;
                            width: 100% !important;
                            max-width: none !important;
                            position: absolute;
                            top: 0;
                            left: 0;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}
