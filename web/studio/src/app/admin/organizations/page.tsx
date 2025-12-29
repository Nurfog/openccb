'use client';

import { useState, useEffect } from 'react';
import { cmsApi, Organization } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Plus, Building2, Globe, Calendar, ExternalLink, ShieldCheck, Palette, Upload, Save, X, Check } from 'lucide-react';

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDomain, setNewDomain] = useState('');

    // Branding States
    const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [primaryColor, setPrimaryColor] = useState('#3B82F6');
    const [secondaryColor, setSecondaryColor] = useState('#8B5CF6');
    const [isSavingBranding, setIsSavingBranding] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const { user } = useAuth();

    useEffect(() => {
        loadOrganizations();
    }, []);

    const loadOrganizations = async () => {
        try {
            const data = await cmsApi.getOrganizations();
            setOrganizations(data);
        } catch (error) {
            console.error('Failed to load organizations', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await cmsApi.createOrganization(newName, newDomain || undefined);
            setNewName('');
            setNewDomain('');
            setIsModalOpen(false);
            loadOrganizations();
        } catch (error) {
            console.error('Failed to create organization', error);
        }
    };

    const openBranding = (org: Organization) => {
        setSelectedOrg(org);
        setPrimaryColor(org.primary_color || '#3B82F6');
        setSecondaryColor(org.secondary_color || '#8B5CF6');
        setIsBrandingModalOpen(true);
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedOrg) return;

        setUploadingLogo(true);
        try {
            const resp = await cmsApi.uploadOrganizationLogo(selectedOrg.id, file);
            setSelectedOrg({ ...selectedOrg, logo_url: resp.url });
            // Update in list
            setOrganizations(orgs => orgs.map(o => o.id === selectedOrg.id ? { ...o, logo_url: resp.url } : o));
        } catch (error) {
            console.error('Failed to upload logo', error);
            alert('Failed to upload logo. Please try again.');
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleBrandingSave = async () => {
        if (!selectedOrg) return;

        setIsSavingBranding(true);
        try {
            await cmsApi.updateOrganizationBranding(selectedOrg.id, {
                primary_color: primaryColor,
                secondary_color: secondaryColor
            });
            // Update in list
            setOrganizations(orgs => orgs.map(o => o.id === selectedOrg.id ? { ...o, primary_color: primaryColor, secondary_color: secondaryColor } : o));
            setIsBrandingModalOpen(false);
        } catch (error) {
            console.error('Failed to update branding', error);
            alert('Failed to update branding. Please try again.');
        } finally {
            setIsSavingBranding(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="p-4 rounded-full bg-red-500/10 mb-4">
                    <ShieldCheck className="w-12 h-12 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-gray-400">Only system administrators can access this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
                    <p className="text-gray-400 mt-1">Manage tenants and isolated environments.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 shadow-glow"
                >
                    <Plus className="w-4 h-4" />
                    New Organization
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 rounded-xl glass animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {organizations.map((org) => (
                        <div
                            key={org.id}
                            className="group relative p-6 rounded-xl glass border border-white/10 hover:border-blue-500/50 transition-all hover:translate-y-[-2px] overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Building2 className="w-16 h-16" />
                            </div>

                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 overflow-hidden w-12 h-12 flex items-center justify-center">
                                    {org.logo_url ? (
                                        <img src={org.logo_url} alt={org.name} className="w-full h-full object-contain" />
                                    ) : (
                                        <Building2 className="w-6 h-6" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">{org.name}</h3>
                                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                                        <Globe className="w-3 h-3" />
                                        {org.domain || 'No custom domain'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4 mb-2">
                                <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: org.primary_color || '#3B82F6' }} title="Primary Color" />
                                <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: org.secondary_color || '#8B5CF6' }} title="Secondary Color" />
                            </div>

                            <div className="space-y-3 mt-4">
                                <div className="flex items-center justify-between text-xs text-gray-500 bg-black/20 p-2 rounded-lg">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Created: {new Date(org.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-blue-500 font-mono">
                                        {org.id.split('-')[0]}...
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => openBranding(org)}
                                        className="py-2 px-4 text-sm font-medium border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Palette className="w-3 h-3" /> Branding
                                    </button>
                                    <button className="py-2 px-4 text-sm font-medium border border-white/5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center gap-2">
                                        Details <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Organization Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md glass border border-white/10 rounded-2xl p-8 shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">Create New Organization</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Organization Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    placeholder="e.g. Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Domain (Optional)</label>
                                <input
                                    type="text"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    placeholder="e.g. acme.com"
                                />
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Branding Management Modal */}
            {isBrandingModalOpen && selectedOrg && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl glass border border-white/10 rounded-2xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold">Branding Management</h2>
                                <p className="text-sm text-gray-400">{selectedOrg.name}</p>
                            </div>
                            <button onClick={() => setIsBrandingModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {/* Logo Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-3 text-brand">Organization Logo</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
                                            {selectedOrg.logo_url ? (
                                                <img src={selectedOrg.logo_url} alt="Preview" className="w-full h-full object-contain" />
                                            ) : (
                                                <Building2 className="w-8 h-8 text-gray-600" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg cursor-pointer transition-all border border-blue-500/20">
                                                <Upload className="w-4 h-4" />
                                                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                                            </label>
                                            <p className="text-[10px] text-gray-500 mt-2">PNG, JPG or SVG. Max 2MB.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Colors */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Primary Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="w-10 h-10 rounded cursor-pointer bg-transparent border-none"
                                            />
                                            <input
                                                type="text"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Secondary Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={secondaryColor}
                                                onChange={(e) => setSecondaryColor(e.target.value)}
                                                className="w-10 h-10 rounded cursor-pointer bg-transparent border-none"
                                            />
                                            <input
                                                type="text"
                                                value={secondaryColor}
                                                onChange={(e) => setSecondaryColor(e.target.value)}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Live Preview */}
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Experience Portal Preview</label>
                                <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-900 shadow-inner">
                                    {/* Mock Experience Header */}
                                    <div className="h-10 px-4 flex items-center justify-between border-b border-white/5" style={{ backgroundColor: primaryColor }}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center overflow-hidden">
                                                {selectedOrg.logo_url ? (
                                                    <img src={selectedOrg.logo_url} className="w-full h-full object-contain" />
                                                ) : <div className="w-3 h-3 bg-white" />}
                                            </div>
                                            <div className="w-16 h-2 bg-white/30 rounded" />
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-6 h-2 bg-white/20 rounded" />
                                            <div className="w-6 h-2 bg-white/20 rounded" />
                                        </div>
                                    </div>
                                    {/* Mock Experience Content */}
                                    <div className="p-4 space-y-3 bg-[#0a0c10]">
                                        <div className="w-2/3 h-4 bg-white/10 rounded mb-2" />
                                        <div className="w-full h-24 bg-white/5 rounded-lg border border-white/5 p-3">
                                            <div className="w-1/3 h-3 rounded mb-2" style={{ backgroundColor: secondaryColor }} />
                                            <div className="w-full h-2 bg-white/5 rounded mb-1" />
                                            <div className="w-full h-2 bg-white/5 rounded mb-1" />
                                            <div className="w-1/2 h-2 bg-white/5 rounded" />
                                            <div className="mt-4 flex justify-end">
                                                <div className="px-3 py-1.5 rounded text-[8px] font-bold text-white" style={{ backgroundColor: primaryColor }}>
                                                    GET STARTED
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <p className="text-[10px] text-blue-400 leading-relaxed">
                                        This is a real-time preview of how the brand identity will apply to the student's learning experience.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-10">
                            <button
                                onClick={() => setIsBrandingModalOpen(false)}
                                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBrandingSave}
                                disabled={isSavingBranding}
                                className="flex-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 font-bold flex items-center justify-center gap-2"
                            >
                                {isSavingBranding ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                                Save Branding
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
