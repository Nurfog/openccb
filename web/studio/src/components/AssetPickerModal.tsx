"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Search, Image as ImageIcon, FileText, Film, File as FileIcon, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { cmsApi, Asset } from "@/lib/api";

interface AssetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    onSelect: (asset: Asset) => void;
    filterType?: "image" | "file" | "all";
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

    const loadAssets = useCallback(async () => {
        if (!isOpen) return;
        setIsLoading(true);
        try {
            const data = await cmsApi.getCourseAssets(courseId);
            let filtered = data;
            if (filterType === "image") {
                filtered = data.filter(a => a.mimetype.startsWith("image/"));
            } else if (filterType === "file") {
                filtered = data.filter(a => !a.mimetype.startsWith("image/"));
            }
            setAssets(filtered);
        } catch (error) {
            console.error("Failed to load assets for picker:", error);
        } finally {
            setIsLoading(false);
        }
    }, [courseId, isOpen, filterType]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const filteredAssets = assets.filter(asset =>
        asset.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            title={filterType === "image" ? "Select Image" : filterType === "file" ? "Select File" : "Select Asset"}
        >
            <div className="space-y-4 max-h-[60vh] overflow-hidden flex flex-col">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px] pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <span className="text-xs uppercase font-bold tracking-widest">Loading assets...</span>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 text-sm">
                            {searchTerm ? "No files match your search." : "No assets found for this course."}
                        </div>
                    ) : (
                        filteredAssets.map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => {
                                    onSelect(asset);
                                    onClose();
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10 transition-all text-left group"
                            >
                                <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                                    {getIcon(asset.mimetype)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-gray-200 truncate">{asset.filename}</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                                        {(asset.size_bytes / 1024 / 1024).toFixed(2)} MB • {asset.mimetype.split('/')[1]}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="pt-4 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                        Only assets uploaded to this course are shown.
                    </p>
                </div>
            </div>
        </Modal>
    );
}
