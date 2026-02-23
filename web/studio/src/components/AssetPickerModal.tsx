"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Search, Image as ImageIcon, FileText, Film, File as FileIcon, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { cmsApi, Asset } from "@/lib/api";

interface AssetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId?: string;
    onSelect: (asset: Asset) => void;
    filterType?: "image" | "file" | "video" | "all";
}

export default function AssetPickerModal({
    isOpen,
    onClose,
    courseId,
    onSelect,
    filterType = "all"
}: AssetPickerModalProps) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"course" | "global">(courseId ? "course" : "global");

    const loadAssets = useCallback(async () => {
        if (!isOpen) return;
        setIsLoading(true);
        try {
            const filters: any = {};
            if (viewMode === "course" && courseId) {
                filters.course_id = courseId;
            }
            if (searchTerm) {
                filters.search = searchTerm;
            }

            const data = await cmsApi.getAssets(filters);
            let filtered = data;

            if (filterType === "image") {
                filtered = data.filter(a => a.mimetype.startsWith("image/"));
            } else if (filterType === "file") {
                filtered = data.filter(a => !a.mimetype.startsWith("image/") && !a.mimetype.startsWith("video/"));
            } else if (filterType === "video") {
                filtered = data.filter(a => a.mimetype.startsWith("video/"));
            }

            setAssets(filtered);
        } catch (error) {
            console.error("Failed to load assets for picker:", error);
        } finally {
            setIsLoading(false);
        }
    }, [courseId, isOpen, filterType, viewMode, searchTerm]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAssets();
        }, 300);
        return () => clearTimeout(timer);
    }, [loadAssets]);

    const getIcon = (mimetype: string) => {
        if (mimetype.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-400" />;
        if (mimetype.startsWith('video/')) return <Film className="w-5 h-5 text-purple-400" />;
        if (mimetype.includes('pdf')) return <FileText className="w-5 h-5 text-red-400" />;
        return <FileIcon className="w-5 h-5 text-gray-400" />;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={filterType === "image" ? "Select Image" : filterType === "video" ? "Select Video" : "Select Asset"}
        >
            <div className="space-y-4 max-h-[70vh] overflow-hidden flex flex-col">
                <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                    {courseId && (
                        <button
                            onClick={() => setViewMode("course")}
                            className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all ${viewMode === "course" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-200"}`}
                        >
                            This Course
                        </button>
                    )}
                    <button
                        onClick={() => setViewMode("global")}
                        className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all ${viewMode === "global" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-200"}`}
                    >
                        Global Library
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search assets by filename..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 min-h-[350px] pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                            <span className="text-[10px] uppercase font-black tracking-[0.2em] opacity-50">Synchronizing...</span>
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="text-center py-24 flex flex-col items-center gap-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <FileIcon className="w-8 h-8 text-gray-600" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-bold text-gray-400">Empty Collection</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest">
                                    {searchTerm ? "No results found" : "No assets uploaded yet"}
                                </div>
                            </div>
                        </div>
                    ) : (
                        assets.map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => {
                                    onSelect(asset);
                                    onClose();
                                }}
                                className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left group"
                            >
                                <div className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-blue-500/10 transition-colors shrink-0">
                                    {getIcon(asset.mimetype)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-gray-200 truncate group-hover:text-blue-400 transition-colors">{asset.filename}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                                            {(asset.size_bytes / 1024 / 1024).toFixed(2)} MB
                                        </div>
                                        <div className="w-1 h-1 rounded-full bg-gray-700" />
                                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider truncate">
                                            {asset.mimetype.split('/')[1]}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.1em]">
                        {assets.length} Assets Found
                    </div>
                </div>
            </div>
        </Modal>
    );
}
