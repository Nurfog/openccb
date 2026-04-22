"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { lmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import { GraduationCap, Lock, Mail, User, ChevronLeft } from "lucide-react";

export default function ExperienceLoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { branding } = useBranding();

    const platformName = branding?.platform_name || branding?.name || 'Academia';

    // State
    const [isLogin, setIsLogin] = useState(true);

    // Form Inputs
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isLogin) {
                const response = await lmsApi.login({ email, password });
                if (response.user.role !== "student") {
                    throw new Error("Acceso denegado. Este portal es solo para estudiantes.");
                }
                login(response.user, response.token);
                router.push("/");
            } else {
                const response = await lmsApi.register({
                    email,
                    password,
                    full_name: fullName,
                });
                login(response.user, response.token);
                router.push("/");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falló la autenticación");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-950 flex items-center justify-center p-4 transition-colors">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-600/30">
                        <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Experiencia {platformName}</h1>
                    <p className="text-indigo-600 dark:text-indigo-200/60 font-medium">Portal de Aprendizaje para Estudiantes</p>
                </div>

                {/* Main Content Card */}
                <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-3xl overflow-hidden relative transition-colors">
                    <div className="p-8">
                        <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-white/5 rounded-xl p-1">
                            <button
                                onClick={() => setIsLogin(true)}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${isLogin ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"}`}
                            >
                                Iniciar Sesión
                            </button>
                            <button
                                onClick={() => setIsLogin(false)}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${!isLogin ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"}`}
                            >
                                Registrarse
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Nombre Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                                        <input required type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors" placeholder="Juan Pérez" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Correo Electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors" placeholder="nombre@correo.com" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                                    <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors" placeholder="••••••••" />
                                </div>
                                {isLogin && (
                                    <div className="text-right pt-1">
                                        <a href="/auth/forgot-password" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                                            ¿Olvidaste tu contraseña?
                                        </a>
                                    </div>
                                )}
                            </div>

                            {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-lg font-medium">{error}</div>}

                            <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 mt-2">
                                {loading ? "Procesando..." : isLogin ? "Ingresar" : "Crear Cuenta"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center border-t border-slate-200 dark:border-white/5 pt-6 transition-colors">
                    <p className="text-xs text-slate-500 dark:text-gray-500">
                        ¿Eres instructor? <a href="http://192.168.0.254:3000/auth/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold transition-colors">Ir al Portal de Instructores</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
