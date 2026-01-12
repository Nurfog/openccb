"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { lmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, Lock, Mail, User, Building2 } from "lucide-react";

export default function ExperienceLoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isLogin) {
                const response = await lmsApi.login({ email, password });

                // Verify user is a student
                if (response.user.role !== "student") {
                    setError("Access denied. This portal is for students only. Please use the Studio portal for instructors.");
                    setLoading(false);
                    return;
                }

                login(response.user, response.token);
                router.push("/");
            } else {
                const response = await lmsApi.register({
                    email,
                    password,
                    full_name: fullName,
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
                        <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">OpenCCB Experience</h1>
                    <p className="text-gray-400">Student Learning Portal</p>
                </div>

                {/* Login/Register Form */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
                    <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${isLogin ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${!isLogin ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Register
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Jane Smith"
                                        required
                                    />
                                </div>
                            </div>
                        )}
                        {!isLogin && (
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Your School or Company"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2 pl-1">If left blank, an organization will be created based on your email domain.</p>
                            </div>
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
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="student@example.com"
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
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/10 text-center">
                        <p className="text-sm text-gray-400">
                            Are you an instructor?{" "}
                            <a href="http://localhost:3000/auth/login" className="text-indigo-400 hover:text-indigo-300 font-bold">
                                Go to Instructor Portal
                            </a>
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-500 mt-6">
                    OpenCCB Experience - Student Learning Portal
                </p>
            </div>
        </div>
    );
}
