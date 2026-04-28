"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { lmsApi, cmsApi, StudioMentorshipView, User } from "@/lib/api";
import {
    Award,
    Search,
    Loader2,
    X,
    Plus,
    Trash2,
    UserCircle,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function CourseMentorshipsPage() {
    const { id: courseId } = useParams() as { id: string };

    const [mentorships, setMentorships] = useState<StudioMentorshipView[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal de asignación
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [orgUsers, setOrgUsers] = useState<User[]>([]);
    const [orgUsersLoading, setOrgUsersLoading] = useState(false);
    const [selectedMentorId, setSelectedMentorId] = useState("");
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [searchMentor, setSearchMentor] = useState("");
    const [searchStudent, setSearchStudent] = useState("");

    const load = useCallback(async () => {
        try {
            const data = await lmsApi.listCourseMentorships(courseId);
            setMentorships(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => { load(); }, [load]);

    const openModal = async () => {
        setIsModalOpen(true);
        if (orgUsers.length === 0) {
            setOrgUsersLoading(true);
            try {
                const users = await cmsApi.getAllUsers();
                setOrgUsers(users);
            } catch (e) {
                console.error(e);
            } finally {
                setOrgUsersLoading(false);
            }
        }
    };

    const handleAssign = async () => {
        if (!selectedMentorId || !selectedStudentId) return;
        if (selectedMentorId === selectedStudentId) return;
        setSaving(true);
        try {
            const created = await lmsApi.assignMentor(courseId, selectedMentorId, selectedStudentId, notes || undefined);
            setMentorships(prev => {
                // Si ya existía (upsert), reemplazar; si no, añadir
                const exists = prev.find(m => m.id === created.id);
                if (exists) return prev.map(m => m.id === created.id ? created : m);
                return [created, ...prev];
            });
            setIsModalOpen(false);
            setSelectedMentorId("");
            setSelectedStudentId("");
            setNotes("");
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (mentorshipId: string) => {
        try {
            await lmsApi.deleteMentorship(courseId, mentorshipId);
            setMentorships(prev => prev.filter(m => m.id !== mentorshipId));
        } catch (e) {
            console.error(e);
        }
    };

    const filteredMentors = orgUsers.filter(u =>
        (u.full_name + u.email).toLowerCase().includes(searchMentor.toLowerCase())
    );
    const filteredStudents = orgUsers.filter(u =>
        (u.full_name + u.email).toLowerCase().includes(searchStudent.toLowerCase())
    );

    // Agrupar por mentor para mostrar vista compacta
    const grouped = mentorships.reduce<Record<string, StudioMentorshipView[]>>((acc, m) => {
        if (!acc[m.mentor_id]) acc[m.mentor_id] = [];
        acc[m.mentor_id].push(m);
        return acc;
    }, {});

    return (
        <CourseEditorLayout
            activeTab="mentorships"
            pageTitle="Sistema de Mentoría"
            pageDescription="Asigna mentores a alumnos para acompañamiento personalizado durante el curso."
            pageActions={
                <button
                    onClick={openModal}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95"
                >
                    <Plus size={18} /> Nueva Asignación
                </button>
            }
        >
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={32} className="text-blue-400 animate-spin" />
                </div>
            ) : mentorships.length === 0 ? (
                <div className="py-20 text-center rounded-3xl border border-white/5 bg-white/[0.02]">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                        <Award size={28} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Sin asignaciones de mentoría</h3>
                    <p className="text-slate-500 text-sm">Asigna un mentor a un alumno para comenzar el acompañamiento.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        {mentorships.length} asignación{mentorships.length > 1 ? "es" : ""} — {Object.keys(grouped).length} mentor{Object.keys(grouped).length > 1 ? "es" : ""}
                    </p>
                    {Object.entries(grouped).map(([mentorId, items]) => (
                        <MentorGroup
                            key={mentorId}
                            items={items}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Modal de asignación */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Award size={18} className="text-blue-500" />
                                </div>
                                <div>
                                    <h2 className="font-black text-sm text-slate-900 dark:text-white">Nueva Asignación</h2>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Selecciona un mentor y un alumno</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {orgUsersLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 size={24} className="text-blue-400 animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* Selector mentor */}
                                    <UserSelector
                                        label="Mentor"
                                        users={filteredMentors}
                                        search={searchMentor}
                                        onSearch={setSearchMentor}
                                        selectedId={selectedMentorId}
                                        onSelect={setSelectedMentorId}
                                        excludeId={selectedStudentId}
                                    />

                                    {/* Selector alumno */}
                                    <UserSelector
                                        label="Alumno"
                                        users={filteredStudents}
                                        search={searchStudent}
                                        onSearch={setSearchStudent}
                                        selectedId={selectedStudentId}
                                        onSelect={setSelectedStudentId}
                                        excludeId={selectedMentorId}
                                    />

                                    {/* Notas */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                            Notas internas (opcional)
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Ej: Apoyo en módulos 3-5, seguimiento semanal…"
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-6 pb-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-black text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={saving || !selectedMentorId || !selectedStudentId || selectedMentorId === selectedStudentId}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-all active:scale-95"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Asignar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </CourseEditorLayout>
    );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function UserSelector({
    label,
    users,
    search,
    onSearch,
    selectedId,
    onSelect,
    excludeId,
}: {
    label: string;
    users: User[];
    search: string;
    onSearch: (v: string) => void;
    selectedId: string;
    onSelect: (id: string) => void;
    excludeId: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = users.find(u => u.id === selectedId);

    return (
        <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                {label}
            </label>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm transition-all hover:border-blue-400/50"
            >
                <span className={selected ? "text-slate-900 dark:text-white font-bold" : "text-slate-400"}>
                    {selected ? `${selected.full_name} (${selected.email})` : `Selecciona ${label.toLowerCase()}…`}
                </span>
                {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>

            {open && (
                <div className="mt-1 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-white/5">
                        <Search size={14} className="text-slate-400" />
                        <input
                            autoFocus
                            value={search}
                            onChange={e => onSearch(e.target.value)}
                            placeholder="Buscar…"
                            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                        />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                        {users.filter(u => u.id !== excludeId).slice(0, 30).map(u => (
                            <button
                                key={u.id}
                                onClick={() => { onSelect(u.id); setOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all ${u.id === selectedId ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}
                            >
                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                    {u.avatar_url ? (
                                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserCircle size={16} className="text-slate-400" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.full_name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                </div>
                            </button>
                        ))}
                        {users.filter(u => u.id !== excludeId).length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-4">Sin resultados</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function MentorGroup({
    items,
    onDelete,
}: {
    items: StudioMentorshipView[];
    onDelete: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const mentor = items[0];

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
            {/* Header del mentor */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
            >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {mentor.mentor_avatar ? (
                        <img src={mentor.mentor_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <UserCircle size={20} className="text-blue-400" />
                    )}
                </div>
                <div className="text-left flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-900 dark:text-white truncate">{mentor.mentor_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{mentor.mentor_email}</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full">
                        {items.length} mentoreado{items.length > 1 ? "s" : ""}
                    </span>
                    {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
                    {items.map(m => (
                        <div key={m.id} className="flex items-center gap-4 px-4 py-3 group hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 overflow-hidden ml-6">
                                {m.student_avatar ? (
                                    <img src={m.student_avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle size={16} className="text-slate-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{m.student_name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{m.student_email}</p>
                            </div>
                            {m.notes && (
                                <p className="text-[10px] text-slate-400 italic max-w-[180px] truncate hidden md:block" title={m.notes}>
                                    {m.notes}
                                </p>
                            )}
                            <button
                                onClick={() => onDelete(m.id)}
                                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                title="Eliminar asignación"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
