"use client";

import { useEffect, useState } from "react";
import { cmsApi, Organization } from "@/lib/api";
import { Building2, Calendar, Hash } from "lucide-react";

export default function OrganizationPage() {
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrg = async () => {
            try {
                const data = await cmsApi.getOrganization();
                setOrg(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load organization");
            } finally {
                setLoading(false);
            }
        };

        fetchOrg();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading organization details...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-bold">Error: {error}</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-black tracking-tighter text-white mb-2">Organization Settings</h1>
                <p className="text-gray-400">Manage your organization&apos;s profile and settings.</p>
            </header>

            {org && (
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="glass-card p-6 space-y-4">
                        <div className="flex items-center gap-3 text-blue-400 mb-2">
                            <Building2 size={24} />
                            <h2 className="text-xl font-bold text-white">Profile</h2>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Organization Name</label>
                            <div className="text-lg font-medium text-white">{org.name}</div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Organization ID</label>
                            <div className="flex items-center gap-2 text-sm text-gray-400 font-mono bg-black/20 p-2 rounded border border-white/5">
                                <Hash size={14} />
                                {org.id}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Created At</label>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Calendar size={14} />
                                {new Date(org.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 flex items-center justify-center text-center text-gray-500">
                        <div>
                            <p className="mb-2 font-bold">More settings coming soon</p>
                            <p className="text-xs">User management and billing features are under development.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
