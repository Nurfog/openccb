"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { lmsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, Lock, Mail, User, Building2, ChevronLeft, ArrowRight } from "lucide-react";

type ViewMode = 'selection' | 'personal' | 'enterprise';

export default function ExperienceLoginPage() {
    const router = useRouter();
    const { login } = useAuth();

    // State
    const [viewMode, setViewMode] = useState<ViewMode>('selection');
    const [isLogin, setIsLogin] = useState(true); // For Personal flow

    // Form Inputs
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [fullName, setFullName] = useState("");
    const [orgIdForSSO, setOrgIdForSSO] = useState("");

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (viewMode === 'personal') {
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
                        organization_name: organizationName,
                    });
                    login(response.user, response.token);
                    router.push("/");
                }
            } else if (viewMode === 'enterprise') {
                if (!orgIdForSSO) {
                    throw new Error("El ID de la organización es requerido");
                }
                lmsApi.initSSOLogin(orgIdForSSO);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falló la autenticación");
            setLoading(false);
        }
    };

    const handleBack = () => {
        setError("");
        setViewMode('selection');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-600/30">
                        <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Experiencia OpenCCB</h1>
                    <p className="text-indigo-200/60 font-medium">Portal de Aprendizaje para Estudiantes</p>
                </div>

                {/* Main Content Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden relative">

                    {/* View: SELECTION */}
                    {viewMode === 'selection' && (
                        <div className="p-8 space-y-4">
                            <h2 className="text-xl font-bold text-white text-center mb-6">¿Cómo deseas ingresar?</h2>

                            <button
                                onClick={() => setViewMode('personal')}
                                className="w-full group p-4 rounded-2xl bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/50 transition-all text-left flex items-center gap-4"
                            >
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-indigo-200 transition-colors">
                                    <User size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-white text-lg">Personas</div>
                                    <div className="text-xs text-gray-400">Acceso con correo personal</div>
                                </div>
                                <ArrowRight className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </button>

                            <button
                                onClick={() => setViewMode('enterprise')}
                                className="w-full group p-4 rounded-2xl bg-white/5 hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-500/50 transition-all text-left flex items-center gap-4"
                            >
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:text-emerald-200 transition-colors">
                                    <Building2 size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-white text-lg">Empresas</div>
                                    <div className="text-xs text-gray-400">Acceso corporativo (SSO)</div>
                                </div>
                                <ArrowRight className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </button>
                        </div>
                    )}

                    {/* View: PERSONAL (Email/Pass) */}
                    {viewMode === 'personal' && (
                        <div className="p-8">
                            <button onClick={handleBack} className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-white mb-6 transition-colors">
                                <ChevronLeft size={14} /> Volver
                            </button>

                            <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-1">
                                <button
                                    onClick={() => setIsLogin(true)}
                                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${isLogin ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                                >
                                    Iniciar Sesión
                                </button>
                                <button
                                    onClick={() => setIsLogin(false)}
                                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${!isLogin ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                                >
                                    Registrarse
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {!isLogin && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre Completo</label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                <input required type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors" placeholder="Juan Pérez" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Correo Electrónico</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors" placeholder="nombre@correo.com" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors" placeholder="••••••••" />
                                    </div>
                                </div>

                                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-lg font-medium">{error}</div>}

                                <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 mt-2">
                                    {loading ? "Procesando..." : isLogin ? "Ingresar" : "Crear Cuenta"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* View: ENTERPRISE (Domain Login) */}
                    {viewMode === 'enterprise' && (
                        <div className="p-8">
                            <button onClick={handleBack} className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-white mb-6 transition-colors">
                                <ChevronLeft size={14} /> Volver
                            </button>

                            <div className="text-center mb-6">
                                <div className="mx-auto w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-3">
                                    <Building2 size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-white">Acceso Corporativo</h3>
                                <p className="text-xs text-gray-400">Ingresa las credenciales de tu empresa</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dominio de la Empresa</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input required type="text" value={organizationName} onChange={e => setOrganizationName(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-emerald-500 focus:outline-none transition-colors font-mono" placeholder="acme-corp" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario / Correo</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-emerald-500 focus:outline-none transition-colors" placeholder="usuario@empresa.com" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-emerald-500 focus:outline-none transition-colors" placeholder="••••••••" />
                                    </div>
                                </div>

                                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-lg font-medium">{error}</div>}

                                <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 mt-2">
                                    {loading ? "Validando..." : "Iniciar Sesión"}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <p className="text-xs text-gray-500">
                        ¿Eres instructor? <a href="http://192.168.0.254:3000/auth/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">Ir al Portal de Instructores</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
