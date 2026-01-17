"use client";

import FileUpload from "../FileUpload";
import { getImageUrl } from "@/lib/api";
import { FileText, Download, Eye } from "lucide-react";

interface DocumentBlockProps {
    id: string;
    title?: string;
    url: string;
    editMode: boolean;
    onChange: (updates: { title?: string; url?: string }) => void;
}

export default function DocumentBlock({ title, url, editMode, onChange }: DocumentBlockProps) {
    const isPdf = url.toLowerCase().endsWith(".pdf");
    const displayUrl = getImageUrl(url);

    return (
        <div className="space-y-6">
            {/* Block Header */}
            <div className="space-y-2">
                {editMode ? (
                    <div className="space-y-2 p-6 glass border-white/5 bg-white/5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Document Activity Title</label>
                        <input
                            type="text"
                            value={title || ""}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="e.g. Course Syllabus, Reading Guide..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:border-blue-500/50 focus:outline-none"
                        />
                    </div>
                ) : (
                    title && <h3 className="text-xl font-bold border-l-4 border-indigo-500 pl-4 py-1 tracking-tight text-white">{title}</h3>
                )}
            </div>

            {editMode && (
                <div className="p-6 glass border-blue-500/10 mb-8 bg-blue-500/5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 block">Upload Document (PDF, DOCX, PPTX)</label>
                    <FileUpload
                        currentUrl={url}
                        onUploadComplete={(newUrl) => onChange({ url: newUrl })}
                    />
                    <p className="text-[10px] text-gray-500 uppercase leading-relaxed mt-4 px-2">
                        Supported formats: PDF (can be previewed), DOCX, PPTX (download only).
                    </p>
                </div>
            )}

            {!editMode && (
                <div className="relative">
                    {url ? (
                        <div className="space-y-4">
                            {isPdf ? (
                                <div className="glass rounded-2xl overflow-hidden border-white/5 bg-white/5 aspect-[4/3] w-full">
                                    <iframe
                                        src={`${displayUrl}#toolbar=0`}
                                        className="w-full h-full border-none"
                                        title={title || "Document Preview"}
                                    />
                                    <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/40">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Eye size={14} className="text-indigo-400" /> PDF Preview
                                        </span>
                                        <a
                                            href={displayUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                                        >
                                            <Download size={14} /> Full Screen / Download
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="glass p-12 rounded-3xl border border-white/5 bg-white/5 flex flex-col items-center text-center gap-6">
                                    <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <FileText size={40} />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-white mb-2">Non-PDF Document</p>
                                        <p className="text-sm text-gray-500 max-w-sm mx-auto uppercase tracking-widest font-black leading-relaxed">
                                            This file cannot be previewed directly. Please download it to read.
                                        </p>
                                    </div>
                                    <a
                                        href={displayUrl}
                                        download
                                        className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                                    >
                                        <Download size={20} /> Download File
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="glass border-dashed border-white/10 p-12 rounded-3xl flex flex-col items-center gap-4 text-gray-500">
                            <FileText size={48} className="opacity-20" />
                            <p className="font-bold uppercase tracking-widest text-xs">No file selected</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
