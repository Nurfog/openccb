"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cmsApi, Organization, BrandingPayload, getImageUrl } from "@/lib/api";
import FileUpload from "./FileUpload";
import { useRouter } from "next/navigation";

export default function BrandingSettings() {
    const router = useRouter();
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<BrandingPayload>({
        primary_color: "#3B82F6",
        secondary_color: "#8B5CF6",
        platform_name: "",
    });

    useEffect(() => {
        fetchOrg();
    }, []);

    const fetchOrg = async () => {
        try {
            const data = await cmsApi.getOrganization();
            setOrg(data);
            setFormData({
                primary_color: data.primary_color || "#3B82F6",
                secondary_color: data.secondary_color || "#8B5CF6",
                platform_name: data.platform_name || "",
            });
        } catch (error) {
            console.error("Failed to fetch organization:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!org) return;
        setSaving(true);
        try {
            await cmsApi.updateOrganizationBranding(org.id, formData);
            fetchOrg();
            alert("Branding updated successfully!");
            router.refresh();
        } catch (error) {
            console.error("Failed to update branding:", error);
            alert("Failed to update branding settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading settings...</div>;
    if (!org) return <div className="p-8 text-center text-red-400">Failed to load organization settings.</div>;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="border border-white/10 rounded-2xl p-6 bg-white/5 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span>🎨</span> Brand Identity
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Platform Name */}
                    <div className="col-span-full">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Platform Name</label>
                        <input
                            type="text"
                            value={formData.platform_name || ""}
                            onChange={(e) => setFormData({ ...formData, platform_name: e.target.value })}
                            placeholder={org.name}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <p className="text-xs text-gray-500 mt-2">Appears in the browser tab and page titles.</p>
                    </div>

                    {/* Logo Section */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-400">Logo</label>
                        <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center justify-center min-h-[120px] relative">
                            {org.logo_url ? (
                                <Image
                                    src={getImageUrl(org.logo_url)}
                                    alt="Logo"
                                    fill
                                    className="object-contain p-2"
                                    sizes="100px"
                                />
                            ) : (
                                <span className="text-gray-600 text-sm">No logo uploaded</span>
                            )}
                        </div>
                        <FileUpload
                            accept="image/png,image/jpeg,image/svg+xml"
                            currentUrl={org.logo_url}
                            customUploadFn={async (file) => {
                                const res = await cmsApi.uploadOrganizationLogo(org.id, file);
                                return { url: res.logo_url || "" };
                            }}
                            onUploadComplete={(url) => {
                                setOrg({ ...org, logo_url: url });
                                router.refresh();
                            }}
                        />
                        <p className="text-xs text-gray-500">Recommended: SVG or PNG, max 2MB.</p>
                    </div>

                    {/* Favicon Section */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-400">Favicon</label>
                        <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center justify-center min-h-[120px] relative">
                            {org.favicon_url ? (
                                <div className="w-8 h-8 relative">
                                    <Image
                                        src={getImageUrl(org.favicon_url)}
                                        alt="Favicon"
                                        fill
                                        className="object-contain"
                                        sizes="32px"
                                    />
                                </div>
                            ) : (
                                <span className="text-gray-600 text-sm">No favicon</span>
                            )}
                        </div>
                        <FileUpload
                            accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
                            currentUrl={org.favicon_url}
                            customUploadFn={async (file) => {
                                const res = await cmsApi.uploadOrganizationFavicon(org.id, file);
                                return { url: res.favicon_url || "" };
                            }}
                            onUploadComplete={(url) => {
                                setOrg({ ...org, favicon_url: url });
                                router.refresh();
                            }}
                        />
                        <p className="text-xs text-gray-500">Recommended: ICO or PNG, 32x32px.</p>
                    </div>
                </div>
            </div>

            <div className="border border-white/10 rounded-2xl p-6 bg-white/5 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span>🌈</span> Brand Colors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Primary Color */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Primary Color</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="color"
                                value={formData.primary_color}
                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-none p-0"
                            />
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={formData.primary_color}
                                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white font-mono uppercase"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Used for main buttons, active states, and highlights.</p>
                    </div>

                    {/* Secondary Color */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Secondary Color</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="color"
                                value={formData.secondary_color}
                                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-none p-0"
                            />
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={formData.secondary_color}
                                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white font-mono uppercase"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Used for accents and gradients.</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                >
                    {saving ? "Saving Changes..." : "Save Branding Settings"}
                </button>
            </div>
        </div>
    );
}
