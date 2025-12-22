"use client";

import { useState } from "react";
import { cmsApi } from "@/lib/api";
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
            const res = await cmsApi.login({ email, password });
            login(res.user, res.token);
            router.push("/");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Authentication failed. Please verify your credentials.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-500 mb-6">
                        <LogIn size={32} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter text-white">Studio Login</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Access your educational dashboard</p>
                </div>

                <div className="glass-card p-8 border-white/5 bg-white/[0.02] rounded-3xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Instructor Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="instructor@openccb.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
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
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                                />
                            </div>
                        </div>

                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {loading ? "Verifying..." : "Enter Studio"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    New to Studio? <Link href="/auth/register" className="text-blue-500 hover:text-blue-400">Create an account</Link>
                </p>
            </div>
        </div>
    );
}
