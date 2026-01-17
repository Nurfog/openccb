"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import CourseEditorLayout from "@/components/CourseEditorLayout";
import { cmsApi, Asset, getImageUrl } from "@/lib/api";
import { Upload, Trash2, Copy, FileText, Image as ImageIcon, Film, File as FileIcon } from "lucide-react";

export default function CourseFilesPage() {
    const { id } = useParams() as { id: string };
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const loadAssets = useCallback(async () => {
        try {
            const data = await cmsApi.getCourseAssets(id);
            setAssets(data);
        } catch (error) {
            console.error("Failed to load assets:", error);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            await cmsApi.uploadAsset(file, (pct) => setUploadProgress(pct), id);
            await loadAssets(); // Refresh list
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload file");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (assetId: string) => {
        if (!confirm("Are you sure you want to delete this file? This cannot be undone.")) return;
        try {
            await cmsApi.deleteAsset(assetId);
            setAssets(assets.filter(a => a.id !== assetId));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete file");
        }
    };

    const copyToClipboard = (url: string) => {
        // Copy the relative path (e.g. /assets/uuid.ext) for use in lessons
        navigator.clipboard.writeText(url);
        alert(`Copied URL: ${url}`);
    };

    const getIcon = (mimetype: string) => {
        if (mimetype.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-400" />;
        if (mimetype.startsWith('video/')) return <Film className="w-8 h-8 text-purple-400" />;
        if (mimetype.includes('pdf')) return <FileText className="w-8 h-8 text-red-400" />;
        return <FileIcon className="w-8 h-8 text-gray-400" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <CourseEditorLayout activeTab="files">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Course Files & Assets</h1>
                        <p className="text-gray-400 mt-1">Manage files specific to this course. These will be included in exports.</p>
                    </div>
                    <div className="relative">
                        <input
                            type="file"
                            onChange={handleUpload}
                            className="hidden"
                            id="file-upload"
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="file-upload"
                            className={`btn btn-primary gap-2 cursor-pointer ${isUploading ? 'loading' : ''}`}
                        >
                            {!isUploading && <Upload className="w-4 h-4" />}
                            {isUploading ? `Uploading ${uploadProgress}%` : 'Upload File'}
                        </label>
                    </div>
                </div>

                <div className="glass rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 border-b border-white/10 text-gray-400 font-medium">
                            <tr>
                                <th className="p-4">Name</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Size</th>
                                <th className="p-4">Uploaded</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading files...</td></tr>
                            ) : assets.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-500">No files uploaded yet.</td></tr>
                            ) : (
                                assets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {getIcon(asset.mimetype)}
                                                <div>
                                                    <div className="font-medium text-white">{asset.filename}</div>
                                                    <div className="text-xs text-blue-400">{getImageUrl(asset.storage_path.replace('uploads/', '/assets/'))}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-400 font-mono text-sm">{asset.mimetype}</td>
                                        <td className="p-4 text-gray-400 text-sm">{formatSize(asset.size_bytes)}</td>
                                        <td className="p-4 text-gray-400 text-sm">{new Date(asset.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => copyToClipboard(asset.storage_path.replace('uploads/', '/assets/'))}
                                                    title="Copy Internal URL"
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-400"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(asset.id)}
                                                    title="Delete File"
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-red-400"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </CourseEditorLayout>
    );
}
