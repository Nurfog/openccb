"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { lmsApi, cmsApi, StudentGradeReport, User } from "@/lib/api";
import {
    UserPlus,
    Search,
    Loader2,
    X,
    Filter,
    CheckCircle2,
    Mail,
    Plus,
    UserCircle,
    Bell,
    TrendingDown,
    AlertTriangle,
    Clock,
    BarChart2,
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

function riskLevel(student: StudentGradeReport): "critical" | "high" | "medium" | "ok" {
    const daysInactive = student.last_active_at
        ? Math.floor((Date.now() - new Date(student.last_active_at).getTime()) / 86400000)
        : 999;
    const avgScore = student.average_score ?? null;
    if (daysInactive >= 14 || (avgScore !== null && avgScore * 100 < 40)) return "critical";
    if (daysInactive >= 7 || (avgScore !== null && avgScore * 100 < 60)) return "high";
    if (daysInactive >= 3 || (avgScore !== null && avgScore * 100 < 70)) return "medium";
    return "ok";
}

function RiskBadge({ level }: { level: ReturnType<typeof riskLevel> }) {
    const map = {
        critical: { label: "Crítico", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
        high: { label: "Alto", cls: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
        medium: { label: "Medio", cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
        ok: { label: "Bien", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    };
    const { label, cls } = map[level];
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${cls}`}>
            {label}
        </span>
    );
}

export default function CourseStudentsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [students, setStudents] = useState<StudentGradeReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [riskFilter, setRiskFilter] = useState<"all" | "critical" | "high" | "medium">("all");

    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
    const [allOrgUsers, setAllOrgUsers] = useState<User[]>([]);
    const [orgUsersLoading, setOrgUsersLoading] = useState(false);
    const [enrollSearch, setEnrollSearch] = useState("");

    const [notifyTarget, setNotifyTarget] = useState<StudentGradeReport | null>(null);
    const [notifyTitle, setNotifyTitle] = useState("");
    const [notifyMessage, setNotifyMessage] = useState("");
    const [notifySending, setNotifySending] = useState(false);
    const [notifySuccess, setNotifySuccess] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const gradesData = await lmsApi.getCourseGrades(id);
            setStudents(gradesData);
        } catch (error) {
            console.error("Error fetching students:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!isEnrollModalOpen) return;
        setOrgUsersLoading(true);
        cmsApi.getAllUsers()
            .then((users: User[]) => {
                const enrolled = new Set(students.map(s => s.user_id));
                setAllOrgUsers(users.filter(u => u.role === "student" && !enrolled.has(u.id)));
            })
            .catch(console.error)
            .finally(() => setOrgUsersLoading(false));
    }, [isEnrollModalOpen, students]);

    const handleEnroll = async (emails: string[]) => {
        await lmsApi.bulkEnroll(id, emails);
        fetchData();
        setIsEnrollModalOpen(false);
    };

    const openNotify = (student: StudentGradeReport) => {
        setNotifyTarget(student);
        setNotifyTitle("");
        setNotifyMessage("");
        setNotifySuccess(false);
    };

    const handleNotify = async () => {
        if (!notifyTarget || !notifyTitle.trim() || !notifyMessage.trim()) return;
        setNotifySending(true);
        try {
            await lmsApi.notifyStudent(id, notifyTarget.user_id, notifyTitle, notifyMessage);
            setNotifySuccess(true);
            setTimeout(() => {
                setNotifyTarget(null);
                setNotifyTitle("");
                setNotifyMessage("");
                setNotifySuccess(false);
            }, 1500);
        } catch (e) {
            console.error(e);
        } finally {
            setNotifySending(false);
        }
    };

    const filteredStudents = students.filter(s => {
        const matchSearch =
            s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRisk = riskFilter === "all" || riskLevel(s) === riskFilter;
        return matchSearch && matchRisk;
    });

    const atRisk = students.filter(s => ["critical", "high"].includes(riskLevel(s)));

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
    );

    return (
        <>
            <CourseEditorLayout
                activeTab="students"
                pageTitle="Estudiantes y Grupos"
                pageDescription="Gestiona inscripciones, monitorea progreso y comunícate con tus alumnos."
                pageActions={
                    <button
                        onClick={() => setIsEnrollModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95"
                    >
                        <UserPlus size={18} /> Inscribir Estudiantes
                    </button>
                }
            >
                <div className="space-y-8">
                    {/* Alerta de riesgo */}
                    {atRisk.length > 0 && (
                        <div className="flex items-start gap-4 p-5 bg-red-500/5 border border-red-500/20 rounded-2xl">
                            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-black text-red-500">
                                    {atRisk.length} alumno{atRisk.length > 1 ? "s" : ""} necesita{atRisk.length === 1 ? "" : "n"} atención
                                </p>
                                <p className="text-xs text-red-400/70 mt-0.5">
                                    Sin actividad reciente o con calificaciones por debajo del umbral. Usa el botón 🔔 para contactarlos.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Filtros */}
                    <div className="bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-3xl flex flex-col md:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o email..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Filter size={16} className="text-slate-400 shrink-0" />
                            <select
                                value={riskFilter}
                                onChange={e => setRiskFilter(e.target.value as typeof riskFilter)}
                                className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-widest focus:outline-none text-slate-900 dark:text-white min-w-[160px]"
                            >
                                <option value="all">Todos los alumnos</option>
                                <option value="critical">⚠ Riesgo Crítico</option>
                                <option value="high">🟠 Riesgo Alto</option>
                                <option value="medium">🟡 Riesgo Medio</option>
                            </select>
                        </div>
                        <span className="text-xs text-slate-400 font-bold whitespace-nowrap">
                            {filteredStudents.length} de {students.length}
                        </span>
                    </div>

                    {/* Tabla */}
                    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
                                    <th className="p-5">Alumno</th>
                                    <th className="p-5 text-center hidden md:table-cell">Progreso</th>
                                    <th className="p-5 text-center hidden lg:table-cell">Promedio</th>
                                    <th className="p-5 text-center hidden lg:table-cell">Última Actividad</th>
                                    <th className="p-5 text-center">Riesgo</th>
                                    <th className="p-5 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-400 italic text-sm">
                                            No se encontraron alumnos.
                                        </td>
                                    </tr>
                                ) : filteredStudents.map(student => {
                                    const risk = riskLevel(student);
                                    const daysInactive = student.last_active_at
                                        ? Math.floor((Date.now() - new Date(student.last_active_at).getTime()) / 86400000)
                                        : null;
                                    const progress = Math.min(Math.round(student.progress ?? 0), 100);
                                    const avgPct = student.average_score != null ? Math.round(student.average_score * 100) : null;

                                    return (
                                        <tr key={student.user_id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                                            {/* Alumno */}
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-sm shrink-0">
                                                        {student.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-900 dark:text-white text-sm">{student.full_name}</div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <Mail size={10} /> {student.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Progreso */}
                                            <td className="p-5 hidden md:table-cell">
                                                <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase">Progreso</span>
                                                        <span className={`text-[10px] font-black ${progress >= 80 ? "text-emerald-500" : progress >= 40 ? "text-blue-400" : "text-slate-400"}`}>{progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ${progress >= 80 ? "bg-emerald-500" : progress >= 40 ? "bg-blue-500" : "bg-slate-300 dark:bg-white/20"}`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Promedio */}
                                            <td className="p-5 text-center hidden lg:table-cell">
                                                {avgPct !== null ? (
                                                    <span className={`text-sm font-black ${avgPct >= 70 ? "text-emerald-500" : avgPct >= 50 ? "text-orange-400" : "text-red-500"}`}>
                                                        {avgPct}%
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300 dark:text-white/20">—</span>
                                                )}
                                            </td>

                                            {/* Última actividad */}
                                            <td className="p-5 text-center hidden lg:table-cell">
                                                {daysInactive !== null ? (
                                                    <div className={`flex items-center justify-center gap-1 text-xs font-bold ${daysInactive >= 14 ? "text-red-400" : daysInactive >= 7 ? "text-orange-400" : "text-slate-500 dark:text-gray-400"}`}>
                                                        <Clock size={12} />
                                                        {daysInactive === 0 ? "Hoy" : daysInactive === 1 ? "Ayer" : `Hace ${daysInactive}d`}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300 dark:text-white/20">Sin datos</span>
                                                )}
                                            </td>

                                            {/* Riesgo */}
                                            <td className="p-5 text-center">
                                                <RiskBadge level={risk} />
                                            </td>

                                            {/* Acciones */}
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openNotify(student)}
                                                        title="Enviar notificación"
                                                        className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-600 text-blue-500 hover:text-white transition-all active:scale-95"
                                                    >
                                                        <Bell size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/courses/${id}/grades`)}
                                                        title="Ver libro de notas"
                                                        className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all active:scale-95"
                                                    >
                                                        <BarChart2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Leyenda */}
                    <div className="flex flex-wrap items-center gap-4 px-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Indicador de riesgo:</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><TrendingDown size={12} className="text-red-500" /> Crítico — inactivo ≥14d o promedio &lt;40%</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><TrendingDown size={12} className="text-orange-400" /> Alto — inactivo ≥7d o promedio &lt;60%</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><TrendingDown size={12} className="text-yellow-400" /> Medio — inactivo ≥3d o promedio &lt;70%</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><CheckCircle2 size={12} className="text-emerald-500" /> Bien</span>
                    </div>
                </div>
            </CourseEditorLayout>

            {/* Modal: Inscribir */}
            {isEnrollModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#16181b] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
                                    <UserPlus className="text-blue-600" /> Inscribir Estudiantes
                                </h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Directorio de la organización</p>
                            </div>
                            <button onClick={() => setIsEnrollModalOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o email..."
                                    value={enrollSearch}
                                    onChange={e => setEnrollSearch(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                            <div className="space-y-3 max-h-[360px] overflow-y-auto">
                                {orgUsersLoading ? (
                                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                                ) : allOrgUsers.filter(u => u.full_name.toLowerCase().includes(enrollSearch.toLowerCase())).length === 0 ? (
                                    <p className="text-center p-10 text-slate-400 italic text-sm">No hay más estudiantes disponibles.</p>
                                ) : allOrgUsers.filter(u => u.full_name.toLowerCase().includes(enrollSearch.toLowerCase())).map(u => (
                                    <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/10 flex items-center justify-center">
                                                <UserCircle size={22} className="text-slate-400" />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 dark:text-white text-sm">{u.full_name}</div>
                                                <div className="text-xs text-slate-400 flex items-center gap-1"><Mail size={10} /> {u.email}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleEnroll([u.email])}
                                            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
                                        >
                                            Inscribir
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-2xl flex gap-3 text-xs text-blue-700 dark:text-blue-300 font-medium">
                                <Plus size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                También puedes inscribir alumnos externos desde el <strong>Libro de Notas</strong> con la función de inscripción masiva.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Notificar alumno */}
            {notifyTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#16181b] border border-slate-200 dark:border-white/10 rounded-[2rem] w-full max-w-lg shadow-2xl">
                        <div className="p-7 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Bell size={18} className="text-blue-500" /> Notificar Alumno
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">{notifyTarget.full_name} · {notifyTarget.email}</p>
                            </div>
                            <button onClick={() => setNotifyTarget(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-7 space-y-5">
                            {notifySuccess ? (
                                <div className="flex flex-col items-center gap-3 py-8">
                                    <CheckCircle2 size={40} className="text-emerald-500" />
                                    <p className="font-black text-emerald-500">Notificación enviada</p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Título</label>
                                        <input
                                            type="text"
                                            value={notifyTitle}
                                            onChange={e => setNotifyTitle(e.target.value)}
                                            placeholder="Ej: Recordatorio de actividad pendiente"
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Mensaje</label>
                                        <textarea
                                            value={notifyMessage}
                                            onChange={e => setNotifyMessage(e.target.value)}
                                            placeholder="Escribe el mensaje para el alumno..."
                                            rows={4}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleNotify}
                                        disabled={notifySending || !notifyTitle.trim() || !notifyMessage.trim()}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {notifySending ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                                        {notifySending ? "Enviando..." : "Enviar Notificación"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
