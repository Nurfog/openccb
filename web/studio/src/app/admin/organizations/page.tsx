'use client';

import { useState, useEffect } from 'react';
import { cmsApi, Organization } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Plus, Building2, Globe, Calendar, ExternalLink, ShieldCheck } from 'lucide-react';

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDomain, setNewDomain] = useState('');
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
                                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">{org.name}</h3>
                                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                                        <Globe className="w-3 h-3" />
                                        {org.domain || 'No custom domain'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 mt-6">
                                <div className="flex items-center justify-between text-xs text-gray-500 bg-black/20 p-2 rounded-lg">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Created: {new Date(org.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-blue-500 font-mono">
                                        {org.id.split('-')[0]}...
                                    </div>
                                </div>
                                <button className="w-full py-2 px-4 text-sm font-medium border border-white/5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center gap-2">
                                    Details <ExternalLink className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
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
        </div>
    );
}
