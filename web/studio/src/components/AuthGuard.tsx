"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            const isAuthPage = pathname?.startsWith("/auth");
            if (!user && !isAuthPage) {
                router.push("/auth/login");
            } else if (user && isAuthPage) {
                router.push("/");
            }
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    const isAuthPage = pathname?.startsWith("/auth");
    if (!user && !isAuthPage) {
        return null; // Prevents flashing protected content
    }

    return <>{children}</>;
}
