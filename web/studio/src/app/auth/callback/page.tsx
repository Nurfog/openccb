"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();

    useEffect(() => {
        const token = searchParams.get("token");
        if (token) {
            // Temporarily store token so getMe can use it
            localStorage.setItem('studio_token', token);

            cmsApi.getMe()
                .then((user) => {
                    login(user, token);
                    router.push("/");
                })
                .catch((err) => {
                    console.error("SSO Error:", err);
                    localStorage.removeItem('studio_token');
                    router.push("/auth/login?error=sso_failed");
                });
        } else {
            router.push("/auth/login");
        }
    }, [searchParams, login, router]);

    return (
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <h2 className="text-xl font-bold text-white text-center">
                Completing your sign in...
            </h2>
            <p className="text-gray-400">Please wait a moment.</p>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <Suspense fallback={
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                </div>
            }>
                <CallbackHandler />
            </Suspense>
        </div>
    );
}
