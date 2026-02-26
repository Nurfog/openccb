"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/auth/login");
    }, [router]);

    return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
            <div className="animate-pulse text-gray-500 font-mono text-sm">Redirecting to login...</div>
        </div>
    );
}
