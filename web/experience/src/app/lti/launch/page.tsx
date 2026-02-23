"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function LtiLaunchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleLaunch = async () => {
            const token = searchParams.get("token");
            const target = searchParams.get("target") || "/dashboard";

            if (!token) {
                setError("No launch token provided");
                return;
            }

            try {
                // 1. Temporarily save token so api client can use it for getMe
                localStorage.setItem("experience_token", token);

                // 2. Fetch user details
                const user = await lmsApi.getMe();

                // 3. Initialize session in AuthContext
                login(user, token);

                // 4. Redirect to final destination
                router.replace(target);
            } catch (err: any) {
                console.error("LTI Launch Error:", err);
                setError("Failed to initialize session. Please try again.");
            }
        };

        handleLaunch();
    }, [searchParams, login, router]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
                <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-4">
                    <div className="text-4xl">⚠️</div>
                    <h1 className="text-2xl font-black text-red-400">Error de Inicio</h1>
                    <p className="text-gray-400">{error}</p>
                    <button
                        onClick={() => router.push("/auth/login")}
                        className="btn-primary w-full py-3 rounded-xl font-bold uppercase tracking-widest text-xs"
                    >
                        Volver al Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
            <div className="text-center space-y-6">
                <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 border-t-4 border-purple-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-2 border-t-4 border-blue-500 rounded-full animate-spin-slow"></div>
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase italic">Iniciando Sesión</h1>
                    <p className="text-gray-500 text-sm font-bold tracking-widest uppercase mt-2">OpenCCB LTI Gateway</p>
                </div>
            </div>
        </div>
    );
}

export default function LtiLaunchPage() {
    return (
        <Suspense fallback={null}>
            <LtiLaunchContent />
        </Suspense>
    );
}
