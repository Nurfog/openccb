"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { cmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, Lock, Mail, User, Building2 } from "lucide-react";

export default function StudioLoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [ssoMode, setSSOMode] = useState(false);
    const [orgIdForSSO, setOrgIdForSSO] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isLogin) {
                const response = await cmsApi.login({ email, password });

                // Verify user is instructor or admin
                if (response.user.role !== "instructor" && response.user.role !== "admin") {
                    setError("Access denied. This portal is for instructors and administrators only.");
                    setLoading(false);
                    return;
                }

                login(response.user, response.token);
                router.push("/");
            } else {
                const response = await cmsApi.register({
                    email,
                    password,
                    full_name: fullName,
                    role: "instructor",
                    organization_name: organizationName,
                });

                login(response.user, response.token);
                router.push("/");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
                        <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">OpenCCB Studio</h1>
                    <p className="text-gray-400">Instructor & Administrator Portal</p>
                </div>

                {/* Login/Register Form */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
                    <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${isLogin ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${!isLogin ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Register
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!ssoMode ? (
                            <>
                                {!isLogin && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-300 mb-2">
                                                Full Name
                                            </label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="John Doe"
                                                    autoComplete="name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-300 mb-2">
                                                Organization Name (Optional)
                                            </label>
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={organizationName}
                                                    onChange={(e) => setOrganizationName(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Your School or Company"
                                                    autoComplete="organization"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 pl-1">
                                                If left blank, an organization will be created based on your email domain.
                                            </p>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="instructor@example.com"
                                            autoComplete="email"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="••••••••"
                                            autoComplete="current-password"
                                            required
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">
                                    Organization ID
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={orgIdForSSO}
                                        onChange={(e) => setOrgIdForSSO(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="00000000-0000-0000-0000-000000000000"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2 pl-1">
                                    Contact your administrator if you don&apos;t know your Organization ID.
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            onClick={(e) => {
                                if (ssoMode) {
                                    e.preventDefault();
                                    if (!orgIdForSSO) {
                                        setError("Organization ID is required");
                                        return;
                                    }
                                    cmsApi.initSSOLogin(orgIdForSSO);
                                }
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Processing..." : ssoMode ? "Continue with SSO" : isLogin ? "Sign In" : "Create Account"}
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#020617] px-2 text-gray-500">Or</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setSSOMode(!ssoMode);
                                setError("");
                            }}
                            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl border border-white/10 transition-colors"
                        >
                            {ssoMode ? "Use Email & Password" : "Login with Enterprise SSO"}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/10 text-center">
                        <p className="text-sm text-gray-400">
                            Are you a student?{" "}
                            <a href="http://localhost:3003/auth/login" className="text-blue-400 hover:text-blue-300 font-bold">
                                Go to Student Portal
                            </a>
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-500 mt-6">
                    OpenCCB Studio - Instructor & Administrator Portal
                </p>
            </div>
        </div>
    );
}
