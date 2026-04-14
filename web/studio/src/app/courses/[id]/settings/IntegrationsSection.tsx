"use client";

import React, { useState } from "react";
import { cmsApi } from "@/lib/api";
import { RefreshCw, Database, Users, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface IntegrationsSectionProps {
    courseId: string;
}

export default function IntegrationsSection({ courseId }: IntegrationsSectionProps) {
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncingStudents, setSyncingStudents] = useState(false);
    const [syncingAssignments, setSyncingAssignments] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleSyncAll = async () => {
        setSyncingAll(true);
        setStatus(null);
        try {
            const result = await cmsApi.syncSamAll();
            setStatus({
                type: 'success',
                message: `Sincronización completa finalizada. Estudiantes: ${result.students_synced}, Asignaciones: ${result.assignments_synced}`
            });
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || "Error al sincronizar con SAM" });
        } finally {
            setSyncingAll(false);
        }
    };

    const handleSyncStudents = async () => {
        setSyncingStudents(true);
        setStatus(null);
        try {
            const result = await cmsApi.syncSamStudents();
            setStatus({
                type: 'success',
                message: `Estudiantes sincronizados: ${result.students_synced}`
            });
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || "Error al sincronizar estudiantes" });
        } finally {
            setSyncingStudents(false);
        }
    };

    const handleSyncAssignments = async () => {
        setSyncingAssignments(true);
        setStatus(null);
        try {
            const result = await cmsApi.syncSamAssignments();
            setStatus({
                type: 'success',
                message: `Asignaciones sincronizadas: ${result.assignments_synced}`
            });
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || "Error al sincronizar asignaciones" });
        } finally {
            setSyncingAssignments(false);
        }
    };

    return (
        <section className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 space-y-8 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <RefreshCw size={24} />
                </div>
                <div>
                    <h2 className="section-title">Integraciones y Sincronización</h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400">Gestiona la conexión con sistemas externos (SAM y MySQL Legacy)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SAM Integration Card */}
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <Database size={20} />
                        <h3 className="font-bold uppercase tracking-wider text-sm">SAM (Sistema Académico)</h3>
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                        Sincroniza la base de datos de estudiantes y las inscripciones a cursos desde el sistema SAM v3.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={handleSyncAll}
                            disabled={syncingAll || syncingStudents || syncingAssignments}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-black/20 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-slate-200 dark:border-white/10 rounded-xl transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <RefreshCw className={`w-5 h-5 text-indigo-500 ${syncingAll ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                <div className="text-left">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">Sincronización Total</div>
                                    <div className="text-[10px] text-slate-500 dark:text-gray-500">Estudiantes + Inscripciones</div>
                                </div>
                            </div>
                        </button>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSyncStudents}
                                disabled={syncingAll || syncingStudents}
                                className="flex-1 flex items-center gap-2 p-3 bg-white dark:bg-black/10 hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-gray-300 transition-all"
                            >
                                <Users size={14} />
                                {syncingStudents ? "Sincronizando..." : "Solo Estudiantes"}
                            </button>
                            <button
                                onClick={handleSyncAssignments}
                                disabled={syncingAll || syncingAssignments}
                                className="flex-1 flex items-center gap-2 p-3 bg-white dark:bg-black/10 hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-gray-300 transition-all"
                            >
                                <RefreshCw size={14} className={syncingAssignments ? 'animate-spin' : ''} />
                                {syncingAssignments ? "Sincronizando..." : "Solo Inscripciones"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* MySQL Legacy Sync Card */}
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-6 opacity-75 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-gray-400">
                        <AlertCircle size={20} />
                        <h3 className="font-bold uppercase tracking-wider text-sm">MySQL Legacy Sync</h3>
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                        Importación manual de contenidos y estructuras de cursos desde el sistema antiguo. 
                        <span className="block mt-1 text-amber-500 font-bold">⚠️ Use con precaución: puede duplicar contenidos.</span>
                    </p>

                    <button
                        disabled={true}
                        className="w-full flex items-center justify-center p-4 bg-slate-100 dark:bg-black/40 border border-dashed border-slate-300 dark:border-white/10 rounded-xl text-slate-400 text-xs font-bold"
                    >
                        Próximamente para este curso específico
                    </button>
                </div>
            </div>

            {status && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${status.type === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                    {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <p className="text-sm font-bold">{status.message}</p>
                </div>
            )}
        </section>
    );
}
