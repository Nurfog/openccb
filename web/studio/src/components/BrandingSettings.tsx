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
        name: "",
        primary_color: "#3B82F6",
        secondary_color: "#8B5CF6",
        platform_name: "",
        logo_variant: "standard",
    });

    useEffect(() => {
        fetchOrg();
    }, []);

    const fetchOrg = async () => {
        try {
            const data = await cmsApi.getOrganization();
            setOrg(data);
            setFormData({
                name: data.name || "",
                primary_color: data.primary_color || "#3B82F6",
                secondary_color: data.secondary_color || "#8B5CF6",
                platform_name: data.platform_name || "",
                logo_variant: data.logo_variant || "standard",
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
            <fieldset className="border border-white/10 rounded-2xl p-6 bg-white/5 backdrop-blur-sm">
                <legend className="px-2 text-xl font-bold flex items-center gap-2">
                    <span aria-hidden="true">🎨</span> Brand Identity
                </legend>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Organization Name */}
                    <div className="col-span-full">
                        <label htmlFor="org-name" className="block text-sm font-medium text-gray-400 mb-2">Organization Name</label>
                        <input
                            id="org-name"
                            type="text"
                            value={formData.name || ""}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                            placeholder="My Organization"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-2">The official name of your organization.</p>
                    </div>
                    {/* Platform Name */}
                    <div className="col-span-full">
                        <label htmlFor="platform-name" className="block text-sm font-medium text-gray-400 mb-2">Platform Name</label>
                        <input
                            id="platform-name"
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
                        <span className="block text-sm font-medium text-gray-400">Logo</span>
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
                            id="logo-upload"
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
                        <span className="block text-sm font-medium text-gray-400">Favicon</span>
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
                            id="favicon-upload"
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

                    {/* Logo Variant Selection */}
                    <div className="col-span-full border-t border-white/5 pt-6 mt-2">
                        <label className="block text-sm font-medium text-gray-400 mb-4">Logo Display Style (Header)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, logo_variant: "standard" })}
                                className={`flex flex-col gap-3 p-4 rounded-xl border transition-all text-left ${formData.logo_variant === "standard" ? "bg-blue-600/10 border-blue-500/50" : "bg-black/20 border-white/10 hover:border-white/20"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs">O</div>
                                    <span className="text-sm font-bold">Standard</span>
                                </div>
                                <p className="text-xs text-gray-500">Small icon next to the organization name. Best for square logos.</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, logo_variant: "wide" })}
                                className={`flex flex-col gap-3 p-4 rounded-xl border transition-all text-left ${formData.logo_variant === "wide" ? "bg-blue-600/10 border-blue-500/50" : "bg-black/20 border-white/10 hover:border-white/20"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-20 h-6 bg-blue-600/20 rounded-md border border-blue-500/30 flex items-center justify-center">
                                        <div className="w-12 h-2 bg-blue-500 rounded-full" />
                                    </div>
                                    <span className="text-sm font-bold">Wide / Horizontal</span>
                                </div>
                                <p className="text-xs text-gray-500">Shows the full logo without text. Best for horizontal images like yours.</p>
                            </button>
                        </div>
                    </div>
                </div>
            </fieldset>

            <fieldset className="border border-white/10 rounded-2xl p-6 bg-white/5 backdrop-blur-sm">
                <legend className="px-2 text-xl font-bold flex items-center gap-2">
                    <span aria-hidden="true">🌈</span> Brand Colors
                </legend>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Primary Color */}
                    <div>
                        <label htmlFor="primary-color" className="block text-sm font-medium text-gray-400 mb-2">Primary Color</label>
                        <div className="flex items-center gap-4">
                            <input
                                id="primary-color-picker"
                                type="color"
                                value={formData.primary_color}
                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                aria-label="Primary color picker"
                                className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-none p-0"
                            />
                            <div className="flex-1">
                                <input
                                    id="primary-color"
                                    type="text"
                                    value={formData.primary_color}
                                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white font-mono uppercase"
                                    aria-describedby="primary-color-desc"
                                />
                            </div>
                        </div>
                        <p id="primary-color-desc" className="text-xs text-gray-500 mt-2">Used for main buttons, active states, and highlights.</p>
                    </div>

                    {/* Secondary Color */}
                    <div>
                        <label htmlFor="secondary-color" className="block text-sm font-medium text-gray-400 mb-2">Secondary Color</label>
                        <div className="flex items-center gap-4">
                            <input
                                id="secondary-color-picker"
                                type="color"
                                value={formData.secondary_color}
                                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                aria-label="Secondary color picker"
                                className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-none p-0"
                            />
                            <div className="flex-1">
                                <input
                                    id="secondary-color"
                                    type="text"
                                    value={formData.secondary_color}
                                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white font-mono uppercase"
                                    aria-describedby="secondary-color-desc"
                                />
                            </div>
                        </div>
                        <p id="secondary-color-desc" className="text-xs text-gray-500 mt-2">Used for accents and gradients.</p>
                    </div>
                </div>
            </fieldset>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                >
                    {saving ? "Saving Changes..." : "Save Branding Settings"}
                </button>
            </div>
        </div >
    );
}
