"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, lmsApi, Course, Lesson, SubmissionWithReviews, PeerReview, PeerReviewSettings } from "@/lib/api";
import {
    Users,
    MessageSquare,
    Search,
    ArrowLeft,
    Loader2,
    CheckCircle,
    Clock,
    ChevronRight,
    Award,
    Settings,
    Zap,
    Star,
    SlidersHorizontal,
    BadgeCheck,
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

// ─── Componente: Panel de configuración de rúbrica/pesos ─────────────────────
function PeerSettingsPanel({
    courseId,
    lessonId,
    onAssignDone,
}: {
    courseId: string;
    lessonId: string;
    onAssignDone: () => void;
}) {
    const [settings, setSettings] = useState<PeerReviewSettings | null>(null);
    const [peerWeight, setPeerWeight] = useState(70);
    const [instructorWeight, setInstructorWeight] = useState(30);
    const [requiredReviews, setRequiredReviews] = useState(2);
    const [autoAssign, setAutoAssign] = useState(true);
    const [saving, setSaving] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [assignResult, setAssignResult] = useState<{ submissions_processed: number; assignments_created: number } | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        lmsApi.getPeerReviewSettings(courseId, lessonId).then(s => {
            if (s) {
                setSettings(s);
                setPeerWeight(s.peer_weight);
                setInstructorWeight(s.instructor_weight);
                setRequiredReviews(s.required_reviews);
                setAutoAssign(s.auto_assign);
            }
        }).catch(() => {});
    }, [courseId, lessonId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await lmsApi.upsertPeerReviewSettings(courseId, lessonId, {
                peer_weight: peerWeight,
                instructor_weight: instructorWeight,
                required_reviews: requiredReviews,
                auto_assign: autoAssign,
            });
            setSettings(updated);
        } finally {
            setSaving(false);
        }
    };

    const handleAutoAssign = async () => {
        setAssigning(true);
        setAssignResult(null);
        try {
            const result = await lmsApi.autoAssignPeerReviews(courseId, lessonId);
            setAssignResult(result);
            onAssignDone();
        } finally {
            setAssigning(false);
        }
    };

    const handlePeerWeightChange = (v: number) => {
        setPeerWeight(v);
        setInstructorWeight(100 - v);
    };

    return (
        <div className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-sm mb-8">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-8 py-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    <SlidersHorizontal className="w-4 h-4 text-purple-500" />
                    Configuración de Pesos y Asignación Automática
                </div>
                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
            </button>

            {open && (
                <div className="px-8 pb-8 space-y-6 border-t border-slate-100 dark:border-white/5 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Revisiones requeridas */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                Revisiones requeridas por entrega
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={requiredReviews}
                                onChange={e => setRequiredReviews(Number(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            />
                        </div>

                        {/* Peso de pares */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                Peso pares: <span className="text-purple-500">{peerWeight}%</span>
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={peerWeight}
                                onChange={e => handlePeerWeightChange(Number(e.target.value))}
                                className="w-full accent-purple-500"
                            />
                            <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1">
                                <span>Instructor: {instructorWeight}%</span>
                                <span>Pares: {peerWeight}%</span>
                            </div>
                        </div>

                        {/* Asignación automática */}
                        <div className="flex items-center gap-3 pt-5">
                            <button
                                onClick={() => setAutoAssign(a => !a)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${autoAssign ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-700"}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoAssign ? "translate-x-6" : ""}`} />
                            </button>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                Asignación automática al entregar
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-4 flex-wrap">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-black uppercase tracking-wider disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                            Guardar configuración
                        </button>

                        <button
                            onClick={handleAutoAssign}
                            disabled={assigning}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl text-sm font-black uppercase tracking-wider disabled:opacity-50 transition-all shadow-md shadow-yellow-500/20"
                        >
                            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Asignar revisiones automáticamente
                        </button>
                    </div>

                    {assignResult && (
                        <div className="flex items-center gap-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl px-4 py-3">
                            <CheckCircle className="w-4 h-4" />
                            <span className="font-bold">
                                {assignResult.submissions_processed} entregas procesadas · {assignResult.assignments_created} asignaciones creadas
                            </span>
                        </div>
                    )}

                    {settings && (
                        <p className="text-[10px] text-slate-400 font-medium">
                            Config guardada · Actualizada {new Date(settings.updated_at).toLocaleString()}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Componente: Modal para calificación del instructor ───────────────────────
function InstructorGradeModal({
    courseId,
    lessonId,
    submissionId,
    studentName,
    onClose,
    onGraded,
}: {
    courseId: string;
    lessonId: string;
    submissionId: string;
    studentName: string;
    onClose: () => void;
    onGraded: () => void;
}) {
    const [score, setScore] = useState(75);
    const [feedback, setFeedback] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!feedback.trim()) { setError("El feedback es obligatorio"); return; }
        setSaving(true);
        setError("");
        try {
            await lmsApi.instructorGradeSubmission(courseId, lessonId, submissionId, score, feedback);
            onGraded();
            onClose();
        } catch (e: any) {
            setError(e.message ?? "Error al guardar la calificación");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 flex items-center justify-center">
                        <Star className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Calificación del Instructor</h3>
                        <p className="text-xs text-slate-400">{studentName}</p>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Puntuación: <span className="text-yellow-500">{score}/100</span>
                    </label>
                    <input
                        type="range" min={0} max={100} step={1} value={score}
                        onChange={e => setScore(Number(e.target.value))}
                        className="w-full accent-yellow-500"
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Feedback del instructor *
                    </label>
                    <textarea
                        rows={4}
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="Escribe tu retroalimentación detallada..."
                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/30 resize-none"
                    />
                    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-sm font-black uppercase tracking-wider disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                        Calificar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function PeerReviewDashboard() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<SubmissionWithReviews[]>([]);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [reviews, setReviews] = useState<PeerReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [gradeModal, setGradeModal] = useState<{ submissionId: string; studentName: string } | null>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const courseData = await cmsApi.getCourseWithFullOutline(id);
                setCourse(courseData);

                const peerReviewLessons: Lesson[] = [];
                courseData.modules?.forEach(m => {
                    m.lessons.forEach(l => {
                        const hasPeerReview = l.metadata?.blocks?.some((b: any) => b.type === 'peer-review');
                        if (hasPeerReview) {
                            peerReviewLessons.push(l);
                        }
                    });
                });
                setLessons(peerReviewLessons);

                if (peerReviewLessons.length > 0) {
                    setSelectedLessonId(peerReviewLessons[0].id);
                }
            } catch (error) {
                console.error("Error loading course data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id]);

    const loadSubmissions = useCallback(async () => {
        if (!selectedLessonId) return;
        try {
            setSubmissionsLoading(true);
            const data = await lmsApi.listLessonSubmissions(id, selectedLessonId);
            setSubmissions(data);
        } catch (error) {
            console.error("Error loading submissions:", error);
        } finally {
            setSubmissionsLoading(false);
        }
    }, [id, selectedLessonId]);

    useEffect(() => {
        loadSubmissions();
    }, [loadSubmissions]);

    useEffect(() => {
        if (!selectedSubmissionId) {
            setReviews([]);
            return;
        }

        const loadReviews = async () => {
            try {
                setReviewsLoading(true);
                const data = await lmsApi.getSubmissionReviews(selectedSubmissionId);
                setReviews(data);
            } catch (error) {
                console.error("Error loading reviews:", error);
            } finally {
                setReviewsLoading(false);
            }
        };
        loadReviews();
    }, [selectedSubmissionId]);

    const filteredSubmissions = submissions.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-transparent flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent text-gray-900 dark:text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-tighter">
                                Peer Assessment
                            </h1>
                            <p className="text-slate-500 dark:text-gray-400 mt-1 font-medium">Monitor, asignación automática y calificación con rúbricas configurables</p>
                        </div>
                    </div>
                </div>

                <CourseEditorLayout activeTab="peer-reviews">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                        {/* Lessons List */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] px-4">Actividades</h3>
                            <div className="space-y-2">
                                {lessons.length === 0 ? (
                                    <div className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm text-slate-400 italic">
                                        No se encontraron actividades de peer review.
                                    </div>
                                ) : (
                                    lessons.map(lesson => (
                                        <button
                                            key={lesson.id}
                                            onClick={() => {
                                                setSelectedLessonId(lesson.id);
                                                setSelectedSubmissionId(null);
                                            }}
                                            className={`w-full text-left p-5 rounded-[1.5rem] border transition-all active:scale-95 ${selectedLessonId === lesson.id
                                                ? "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/50 text-purple-600 dark:text-purple-400 shadow-md shadow-purple-500/5 font-black uppercase tracking-tight"
                                                : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:border-purple-500/30 font-bold"
                                                }`}
                                        >
                                            <div className="truncate text-sm">{lesson.title}</div>
                                            <div className="text-[9px] uppercase font-black tracking-widest opacity-60 mt-1">Peer Review</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Main content */}
                        <div className="lg:col-span-3 space-y-0">
                            {/* Panel de configuración — solo cuando hay lección seleccionada */}
                            {selectedLessonId && (
                                <PeerSettingsPanel
                                    courseId={id}
                                    lessonId={selectedLessonId}
                                    onAssignDone={loadSubmissions}
                                />
                            )}

                            {/* Submissions List */}
                            <div className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                    <h2 className="text-2xl font-black flex items-center gap-4 uppercase tracking-tight text-slate-900 dark:text-white">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                                            <Users size={24} />
                                        </div>
                                        Entregas
                                    </h2>
                                    <div className="relative w-full md:w-80 group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-gray-500 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Buscar alumno o email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[1.25rem] py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white transition-all shadow-inner"
                                        />
                                    </div>
                                </div>

                                {submissionsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Cargando entregas...</span>
                                    </div>
                                ) : filteredSubmissions.length === 0 ? (
                                    <div className="text-center py-32 bg-slate-50 dark:bg-black/20 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                                        <div className="w-20 h-20 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-gray-700" />
                                        </div>
                                        <p className="text-slate-500 dark:text-gray-500 font-bold uppercase tracking-tight">No se encontraron entregas para esta actividad.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 overflow-y-auto max-h-[700px] pr-4 custom-scrollbar">
                                        {filteredSubmissions.map(sub => (
                                            <div key={sub.id} className="group">
                                                <div
                                                    onClick={() => setSelectedSubmissionId(selectedSubmissionId === sub.id ? null : sub.id)}
                                                    className={`p-6 rounded-[1.5rem] border transition-all cursor-pointer shadow-sm active:scale-[0.99] ${selectedSubmissionId === sub.id
                                                        ? "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30"
                                                        : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 hover:bg-white dark:hover:bg-white/[0.05] hover:border-blue-500/30"
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20">
                                                                {sub.full_name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">{sub.full_name}</div>
                                                                <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">{sub.email}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6">
                                                            {/* Calificación promedio */}
                                                            <div className="text-right">
                                                                <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 justify-end">
                                                                    <Award className="w-5 h-5 text-yellow-500" />
                                                                    {sub.average_score !== null ? `${(sub.average_score).toFixed(1)}` : '—'}
                                                                </div>
                                                                <div className="text-[9px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">Prom. pares</div>
                                                            </div>
                                                            {/* Nº de revisiones */}
                                                            <div className="text-right">
                                                                <div className={`text-lg font-black flex items-center gap-2 justify-end ${sub.review_count >= 2 ? 'text-green-600' : 'text-orange-500'}`}>
                                                                    <CheckCircle className="w-5 h-5" />
                                                                    {sub.review_count}
                                                                </div>
                                                                <div className="text-[9px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">Revisiones</div>
                                                            </div>
                                                            {/* Fecha */}
                                                            <div className="text-right hidden xl:block">
                                                                <div className="text-sm font-bold text-slate-400 dark:text-gray-500 flex items-center gap-2 justify-end">
                                                                    <Clock className="w-4 h-4" />
                                                                    {new Date(sub.submitted_at).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-[9px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">Entregado</div>
                                                            </div>
                                                            {/* Botón calificar instructor */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setGradeModal({ submissionId: sub.id, studentName: sub.full_name });
                                                                }}
                                                                className="p-2 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-colors"
                                                                title="Calificar como instructor"
                                                            >
                                                                <Star className="w-4 h-4" />
                                                            </button>
                                                            <ChevronRight className={`w-6 h-6 text-slate-300 transition-all ${selectedSubmissionId === sub.id ? 'rotate-90 text-blue-500' : ''}`} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Reviews expandidas */}
                                                {selectedSubmissionId === sub.id && (
                                                    <div className="mt-4 ml-8 p-10 bg-slate-50 dark:bg-black/40 border-l-4 border-blue-500 dark:border-blue-500/50 rounded-r-[2rem] space-y-8 animate-in slide-in-from-left-4 duration-300 shadow-inner">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 ml-1">Revisiones Recibidas</h4>
                                                        {reviewsLoading ? (
                                                            <div className="flex py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                                                        ) : reviews.length === 0 ? (
                                                            <div className="p-8 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-center text-slate-400 italic">
                                                                Aún no hay revisiones para esta entrega.
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                {reviews.map(review => (
                                                                    <div key={review.id} className={`p-6 bg-white dark:bg-white/5 border rounded-2xl space-y-4 shadow-sm transition-all ${review.is_instructor_review ? "border-yellow-200 dark:border-yellow-500/30" : "border-slate-100 dark:border-white/10"}`}>
                                                                        <div className="flex justify-between items-center pb-3 border-b border-slate-50 dark:border-white/5">
                                                                            <span className={`text-[9px] font-black uppercase tracking-widest ${review.is_instructor_review ? "text-yellow-600" : "text-slate-400 dark:text-gray-500"}`}>
                                                                                {review.is_instructor_review ? "⭐ Instructor" : "Par evaluador"}
                                                                            </span>
                                                                            <span className={`px-3 py-1 text-sm font-black rounded-lg ${review.is_instructor_review ? "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500" : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500"}`}>
                                                                                {review.score}/100
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed italic font-medium px-2">
                                                                            "{review.feedback}"
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CourseEditorLayout>
            </div>

            {/* Modal calificación instructor */}
            {gradeModal && (
                <InstructorGradeModal
                    courseId={id}
                    lessonId={selectedLessonId!}
                    submissionId={gradeModal.submissionId}
                    studentName={gradeModal.studentName}
                    onClose={() => setGradeModal(null)}
                    onGraded={loadSubmissions}
                />
            )}
        </div>
    );
}


export default function PeerReviewDashboard() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<SubmissionWithReviews[]>([]);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [reviews, setReviews] = useState<PeerReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const courseData = await cmsApi.getCourseWithFullOutline(id);
                setCourse(courseData);

                const peerReviewLessons: Lesson[] = [];
                courseData.modules?.forEach(m => {
                    m.lessons.forEach(l => {
                        const hasPeerReview = l.metadata?.blocks?.some((b: any) => b.type === 'peer-review');
                        if (hasPeerReview) {
                            peerReviewLessons.push(l);
                        }
                    });
                });
                setLessons(peerReviewLessons);

                if (peerReviewLessons.length > 0) {
                    setSelectedLessonId(peerReviewLessons[0].id);
                }
            } catch (error) {
                console.error("Error loading course data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id]);

    useEffect(() => {
        if (!selectedLessonId) return;

        const loadSubmissions = async () => {
            try {
                setSubmissionsLoading(true);
                const data = await lmsApi.listLessonSubmissions(id, selectedLessonId);
                setSubmissions(data);
            } catch (error) {
                console.error("Error loading submissions:", error);
            } finally {
                setSubmissionsLoading(false);
            }
        };
        loadSubmissions();
    }, [id, selectedLessonId]);

    useEffect(() => {
        if (!selectedSubmissionId) {
            setReviews([]);
            return;
        }

        const loadReviews = async () => {
            try {
                setReviewsLoading(true);
                const data = await lmsApi.getSubmissionReviews(selectedSubmissionId);
                setReviews(data);
            } catch (error) {
                console.error("Error loading reviews:", error);
            } finally {
                setReviewsLoading(false);
            }
        };
        loadReviews();
    }, [selectedSubmissionId]);

    const filteredSubmissions = submissions.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-transparent flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent text-gray-900 dark:text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-tighter">
                                Peer Assessment
                            </h1>
                            <p className="text-slate-500 dark:text-gray-400 mt-1 font-medium">Monitor and manage student peer feedback loops</p>
                        </div>
                    </div>
                </div>

                <CourseEditorLayout activeTab="peer-reviews">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                        {/* Lessons List */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] px-4">Learning Activities</h3>
                            <div className="space-y-2">
                                {lessons.length === 0 ? (
                                    <div className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm text-slate-400 italic">
                                        No peer review activities found.
                                    </div>
                                ) : (
                                    lessons.map(lesson => (
                                        <button
                                            key={lesson.id}
                                            onClick={() => {
                                                setSelectedLessonId(lesson.id);
                                                setSelectedSubmissionId(null);
                                            }}
                                            className={`w-full text-left p-5 rounded-[1.5rem] border transition-all active:scale-95 ${selectedLessonId === lesson.id
                                                ? "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/50 text-purple-600 dark:text-purple-400 shadow-md shadow-purple-500/5 font-black uppercase tracking-tight"
                                                : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:border-purple-500/30 font-bold"
                                                }`}
                                        >
                                            <div className="truncate text-sm">{lesson.title}</div>
                                            <div className="text-[9px] uppercase font-black tracking-widest opacity-60 mt-1">Requirement</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Submissions List */}
                        <div className="lg:col-span-3 space-y-8">
                            <div className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                    <h2 className="text-2xl font-black flex items-center gap-4 uppercase tracking-tight text-slate-900 dark:text-white">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                                            <Users size={24} />
                                        </div>
                                        Submissions
                                    </h2>
                                    <div className="relative w-full md:w-80 group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-gray-500 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Search student or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[1.25rem] py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white transition-all shadow-inner"
                                        />
                                    </div>
                                </div>

                                {submissionsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Loading records...</span>
                                    </div>
                                ) : filteredSubmissions.length === 0 ? (
                                    <div className="text-center py-32 bg-slate-50 dark:bg-black/20 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                                        <div className="w-20 h-20 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-gray-700" />
                                        </div>
                                        <p className="text-slate-500 dark:text-gray-500 font-bold uppercase tracking-tight">No submissions found for this activity.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 overflow-y-auto max-h-[700px] pr-4 custom-scrollbar">
                                        {filteredSubmissions.map(sub => (
                                            <div key={sub.id} className="group">
                                                <div
                                                    onClick={() => setSelectedSubmissionId(selectedSubmissionId === sub.id ? null : sub.id)}
                                                    className={`p-6 rounded-[1.5rem] border transition-all cursor-pointer shadow-sm active:scale-[0.99] ${selectedSubmissionId === sub.id
                                                        ? "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30"
                                                        : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 hover:bg-white dark:hover:bg-white/[0.05] hover:border-blue-500/30"
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20">
                                                                {sub.full_name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">{sub.full_name}</div>
                                                                <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">{sub.email}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-10">
                                                            <div className="text-right">
                                                                <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 justify-end">
                                                                    <Award className="w-5 h-5 text-yellow-500" />
                                                                    {sub.average_score !== null ? `${(sub.average_score).toFixed(1)}/10` : '—'}
                                                                </div>
                                                                <div className="text-[9px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">Rating</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`text-lg font-black flex items-center gap-2 justify-end ${sub.review_count >= 2 ? 'text-green-600' : 'text-orange-500'}`}>
                                                                    <CheckCircle className="w-5 h-5" />
                                                                    {sub.review_count}
                                                                </div>
                                                                <div className="text-[9px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">Feedback</div>
                                                            </div>
                                                            <div className="text-right hidden xl:block">
                                                                <div className="text-sm font-bold text-slate-400 dark:text-gray-500 flex items-center gap-2 justify-end">
                                                                    <Clock className="w-4 h-4" />
                                                                    {new Date(sub.submitted_at).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-[9px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">Delivery</div>
                                                            </div>
                                                            <ChevronRight className={`w-6 h-6 text-slate-300 transition-all ${selectedSubmissionId === sub.id ? 'rotate-90 text-blue-500' : ''}`} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Reviews Detail Drawer-like expansion */}
                                                {selectedSubmissionId === sub.id && (
                                                    <div className="mt-4 ml-8 p-10 bg-slate-50 dark:bg-black/40 border-l-4 border-blue-500 dark:border-blue-500/50 rounded-r-[2rem] space-y-8 animate-in slide-in-from-left-4 duration-300 shadow-inner">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 ml-1">Submission Feedback Details</h4>
                                                        {reviewsLoading ? (
                                                            <div className="flex py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                                                        ) : reviews.length === 0 ? (
                                                            <div className="p-8 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-center text-slate-400 italic">
                                                                No peer reviews have been submitted for this user yet.
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                {reviews.map(review => (
                                                                    <div key={review.id} className="p-6 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl space-y-4 shadow-sm group/review hover:border-blue-500/30 transition-all">
                                                                        <div className="flex justify-between items-center pb-3 border-b border-slate-50 dark:border-white/5">
                                                                            <span className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Peer Evaluator</span>
                                                                            <span className="px-3 py-1 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-sm font-black rounded-lg">
                                                                                {review.score}/10
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed italic font-medium px-2">
                                                                            "{review.feedback}"
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
