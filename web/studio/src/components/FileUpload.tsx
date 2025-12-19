"use client";

import { useState, useRef } from "react";
import { cmsApi } from "@/lib/api";

interface FileUploadProps {
    onUploadComplete: (url: string) => void;
    currentUrl?: string;
    accept?: string;
}

export default function FileUpload({ onUploadComplete, currentUrl, accept = "video/*,audio/*" }: FileUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const result = await cmsApi.uploadAsset(file);
            onUploadComplete(result.url);
        } catch (err) {
            alert("Upload failed. Please try again.");
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="space-y-4">
            <div
                className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-4 ${dragActive ? "border-blue-500 bg-blue-500/10 scale-[1.02]" : "border-white/10 hover:border-white/20 bg-white/5"
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    onChange={handleFileChange}
                />

                {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Uploading Asset...</span>
                    </div>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                            <span className="text-2xl group-hover:scale-110 transition-transform">📁</span>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-gray-300">Drag & drop or <span className="text-blue-400 underline decoration-blue-500/30">browse</span></p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Native video, audio files supported</p>
                        </div>
                    </>
                )}
            </div>

            {currentUrl && !isUploading && (
                <div className="flex items-center justify-between px-4 py-3 glass bg-green-500/5 border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-sm">✅</span>
                        <span className="text-xs text-green-400 truncate font-medium">{currentUrl}</span>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onUploadComplete(""); }}
                        className="text-[10px] uppercase font-black text-gray-500 hover:text-red-400 transition-colors"
                    >
                        Remove
                    </button>
                </div>
            )}
        </div>
    );
}
