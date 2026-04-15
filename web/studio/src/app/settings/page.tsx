"use client";

import BrandingSettings from "@/components/BrandingSettings";
import EmailSettings from "@/components/EmailSettings";
import EmailTemplates from "@/components/EmailTemplates";
import ExerciseFeatureSettings from "@/components/ExerciseFeatureSettings";
import PageLayout from "@/components/PageLayout";
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
        <PageLayout
            title="Configuración de Organización"
            description="Gestiona el branding y la disponibilidad de ejercicios de tu plataforma."
            maxWidth="narrow"
        >
            <div className="space-y-8">
                <BrandingSettings />
                <EmailSettings />
                <EmailTemplates />
                <ExerciseFeatureSettings />
            </div>
        </PageLayout>
    );
}
