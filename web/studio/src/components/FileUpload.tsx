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
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadingFileName, setUploadingFileName] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        setUploadProgress(0);
        setUploadingFileName(file.name);
        try {
            const result = await cmsApi.uploadAsset(file, (pct) => {
                setUploadProgress(pct);
            });
            onUploadComplete(result.url);
        } catch (err) {
            alert("Upload failed. Please try again.");
            console.error(err);
        } finally {
            setIsUploading(false);
            setUploadingFileName("");
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
            {/* Upload Progress Modal Overlay */}
            {isUploading && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-gray-900 border border-white/10 p-8 rounded-3xl shadow-2xl space-y-6 text-center">
                        <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <span className="text-3xl">📤</span>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white tracking-tight">Uploading Asset</h3>
                            <p className="text-xs text-gray-400 font-medium truncate px-4">{uploadingFileName}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Processing...</span>
                                <span className="text-lg font-black italic text-white">{uploadProgress}%</span>
                            </div>
                        </div>

                        <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
                            Please do not close this tab or navigate away. <br /> Your file is being securely transferred.
                        </p>
                    </div>
                </div>
            )}

            <div
                className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-4 ${dragActive ? "border-blue-500 bg-blue-500/10 scale-[1.02]" : "border-white/10 hover:border-white/20 bg-white/5"
                    } ${isUploading ? "opacity-30 pointer-events-none" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    onChange={handleFileChange}
                    disabled={isUploading}
                />

                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <span className="text-2xl group-hover:scale-110 transition-transform">📁</span>
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-gray-300">Drag & drop or <span className="text-blue-400 underline decoration-blue-500/30">browse</span></p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Native video, audio files supported</p>
                </div>
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
