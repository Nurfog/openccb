"use client";

import React, { useState } from "react";
import { lmsApi } from "@/lib/api";
import { GraduationCap, Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await lmsApi.forgotPassword(email.trim().toLowerCase());
            setSent(true);
        } catch {
            setError("Ocurrió un error. Intenta nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-950 flex items-center justify-center p-4 transition-colors">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-600/30">
                        <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Recuperar contraseña</h1>
                    <p className="text-slate-500 dark:text-indigo-200/60 text-sm">
                        Ingresa tu correo y te enviaremos un enlace de restablecimiento.
                    </p>
                </div>

                <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl rounded-3xl p-8">
                    {sent ? (
                        <div className="text-center py-4">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <p className="text-slate-700 dark:text-slate-300 font-medium">
                                Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.
                            </p>
                            <p className="text-slate-400 text-sm mt-2">Revisa tu bandeja de entrada o spam.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                                    Correo Electrónico
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        required
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                                        placeholder="nombre@correo.com"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-lg font-medium">
                                    {error}
                                </div>
                            )}

                            <button
                                disabled={loading}
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                            >
                                {loading ? "Enviando..." : "Enviar enlace"}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <a href="/auth/login" className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                            <ArrowLeft className="w-3 h-3" />
                            Volver al inicio de sesión
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
