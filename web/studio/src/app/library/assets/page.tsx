"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    Search, Image as ImageIcon, FileText, Film, File as FileIcon,
    Loader2, Upload, Trash2, ExternalLink, Filter, Plus
} from "lucide-react";
import { cmsApi, Asset, AssetFilters, getImageUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import PageLayout from "@/components/PageLayout";

export default function AssetLibraryPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const loadAssets = useCallback(async () => {
        setIsLoading(true);
        try {
            const filters: AssetFilters = {};
            if (searchTerm) filters.search = searchTerm;
            if (filterType !== "all") filters.mimetype = filterType;

            const data = await cmsApi.getAssets(filters);
            setAssets(data);
        } catch (error) {
            console.error("Failed to load assets:", error);
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, filterType]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAssets();
        }, 300);
        return () => clearTimeout(timer);
    }, [loadAssets]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            for (let i = 0; i < files.length; i++) {
                await cmsApi.uploadAsset(files[i], (pct) => {
                    setUploadProgress(pct);
                });
            }
            loadAssets();
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload assets.");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this asset? This will break content that uses it.")) return;

        try {
            await cmsApi.deleteAsset(id);
            setAssets(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete asset.");
        }
    };

    const getIcon = (mimetype: string) => {
        if (mimetype.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-400" />;
        if (mimetype.startsWith('video/')) return <Film className="w-8 h-8 text-purple-400" />;
        if (mimetype.includes('pdf')) return <FileText className="w-8 h-8 text-red-400" />;
        return <FileIcon className="w-8 h-8 text-gray-400" />;
    };

    return (
        <PageLayout
            title="Biblioteca de Recursos"
            description="Gestiona y reutiliza archivos de medios en todos tus cursos."
            actions={
                <label className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all cursor-pointer shadow-md shadow-blue-600/20 active:scale-95">
                    <Upload className="w-4 h-4" />
                    Subir Archivos
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                    />
                </label>
            }
        >
            <div className="space-y-6">
                {isUploading && (
                    <div className="w-full bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 p-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Uploading Assets...</span>
                            <span className="text-xs font-bold text-white">{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by filename..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-slate-900 dark:text-white"
                        >
                            <option value="all" className="bg-white dark:bg-gray-900">All Types</option>
                            <option value="image/" className="bg-white dark:bg-gray-900">Images</option>
                            <option value="video/" className="bg-white dark:bg-gray-900">Videos</option>
                            <option value="application/pdf" className="bg-white dark:bg-gray-900">Documents (PDF)</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-end px-4 text-gray-500 font-bold text-[10px] uppercase tracking-[0.2em]">
                        {assets.length} Total Assets
                    </div>
                </div>

                {/* Asset Grid */}
                {isLoading && assets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                        <span className="text-[10px] uppercase font-black tracking-[0.3em] text-gray-500">Retrieving Cloud Assets...</span>
                    </div>
                ) : assets.length === 0 ? (
                    <div className="py-40 flex flex-col items-center gap-6 border-2 border-dashed border-black/10 dark:border-white/5 rounded-[40px] bg-black/[0.02] dark:bg-white/[0.02]">
                        <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[32px] border border-black/5 dark:border-white/5">
                            <Plus className="w-12 h-12 text-gray-700" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-gray-400">Your library is empty</h3>
                            <p className="text-sm text-gray-600 font-medium">Start contributing to your organization's shared assets.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {assets.map((asset) => (
                            <div
                                key={asset.id}
                                className="group bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[32px] overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-300 hover:-translate-y-1 relative"
                            >
                                {/* Preview Area */}
                                <div className="aspect-video w-full bg-black/40 flex items-center justify-center relative overflow-hidden">
                                    {asset.mimetype.startsWith('image/') ? (
                                        <div
                                            className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                            style={{ backgroundImage: `url(${getImageUrl(asset.storage_path)})` }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            {getIcon(asset.mimetype)}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                        <a
                                            href={getImageUrl(asset.storage_path)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all"
                                            title="View Full"
                                        >
                                            <ExternalLink className="w-5 h-5" />
                                        </a>
                                        <button
                                            onClick={() => handleDelete(asset.id)}
                                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/10 transition-all"
                                            title="Delete Asset"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="absolute top-4 left-4">
                                        <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">
                                            {asset.mimetype.split('/')[1]}
                                        </div>
                                    </div>
                                </div>

                                {/* Content Info */}
                                <div className="p-6 space-y-3">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-200 truncate pr-2" title={asset.filename}>
                                        {asset.filename}
                                    </h3>
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                                                {(asset.size_bytes / 1024 / 1024).toFixed(2)} MB
                                            </span>
                                            <span className="text-[9px] text-gray-600 font-medium">
                                                {new Date(asset.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {asset.course_id && (
                                            <div className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[8px] font-bold uppercase tracking-widest border border-blue-500/10">
                                                Course Linked
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </PageLayout>
    );
}
