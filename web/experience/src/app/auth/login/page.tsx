"use client";

import { useState } from "react";
import { lmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Mail, Lock } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await lmsApi.login({ email, password });
            login(res.user, res.token);
            router.push("/");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Login failed. Please check your credentials.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-[#050505]">
            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-500 mb-6">
                        <LogIn size={32} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter text-white">Student Login</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Welcome back to your learning journey</p>
                </div>

                <div className="glass-card p-8 border-white/5 bg-white/[0.02]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            disabled={loading}
                            type="submit"
                            className="btn-premium w-full !py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 disabled:opacity-50"
                        >
                            {loading ? "Authenticating..." : "Continue to Dashboard"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Don&apos;t have an account? <Link href="/auth/register" className="text-blue-500 hover:text-blue-400">Sign up here</Link>
                </p>
            </div>
        </div>
    );
}
