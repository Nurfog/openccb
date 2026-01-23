"use client";

import BrandingSettings from "@/components/BrandingSettings";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SettingsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || user.role !== "admin")) {
            router.push("/");
        }
    }, [user, loading, router]);

    if (loading) return null;

    if (!user || user.role !== "admin") return null;

    return (
        <div className="pt-24 px-8 pb-12 min-h-screen bg-gradient-to-br from-gray-900 to-black">
            <div className="max-w-4xl mx-auto mb-8">
                <h1 className="text-3xl font-black text-white tracking-tight">Organization Settings</h1>
                <p className="text-gray-400 mt-2">Manage your white-label branding and platform identity.</p>
            </div>
            <BrandingSettings />
        </div>
    );
}
