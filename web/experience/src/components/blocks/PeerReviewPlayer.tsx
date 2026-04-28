"use client";

import { useState, useEffect, useCallback } from "react";
import { lmsApi, Block, CourseSubmission, PeerReview, PeerReviewSettings } from "@/lib/api";

interface PeerReviewPlayerProps {
    courseId: string;
    lessonId: string;
    block: Block;
}

export default function PeerReviewPlayer({ courseId, lessonId, block }: PeerReviewPlayerProps) {
    const [view, setView] = useState<'submit' | 'dashboard' | 'reviewing'>('submit');
    const [submissionContent, setSubmissionContent] = useState("");
    const [mySubmission, setMySubmission] = useState<CourseSubmission | null>(null);
    const [peerAssignment, setPeerAssignment] = useState<CourseSubmission | null>(null);
    const [feedbackReceived, setFeedbackReceived] = useState<PeerReview[]>([]);
    const [settings, setSettings] = useState<PeerReviewSettings | null>(null);

    // Review form state
    const [reviewScore, setReviewScore] = useState(80);
    const [reviewFeedback, setReviewFeedback] = useState("");
    const [loading, setLoading] = useState(false);
    const [initLoading, setInitLoading] = useState(true);
    const [message, setMessage] = useState("");

    const loadStatus = useCallback(async () => {
        try {
            const [sub, reviews, cfg] = await Promise.all([
                lmsApi.getMySubmission(courseId, lessonId).catch(() => null),
                lmsApi.getMySubmissionFeedback(courseId, lessonId).catch(() => [] as PeerReview[]),
                lmsApi.getPeerReviewSettings(courseId, lessonId).catch(() => null),
            ]);
            if (sub) {
                setMySubmission(sub);
                setSubmissionContent(sub.content);
                setView('dashboard');
            }
            setFeedbackReceived(reviews);
            setSettings(cfg);
        } finally {
            setInitLoading(false);
        }
    }, [courseId, lessonId]);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const sub = await lmsApi.submitAssignment(courseId, lessonId, submissionContent);
            setMySubmission(sub);
            setView('dashboard');
            setMessage("Entrega guardada correctamente.");
            await loadStatus();
        } catch (err: any) {
            setMessage("Error al enviar: " + (err.message ?? "Intenta de nuevo."));
        } finally {
            setLoading(false);
        }
    };

    const handleStartReview = async () => {
        setLoading(true);
        try {
            const assignment = await lmsApi.getPeerReviewAssignment(courseId, lessonId);
            if (!assignment) {
                setMessage("No hay entregas disponibles para revisar. Inténtalo más tarde.");
            } else {
                setPeerAssignment(assignment);
                setView('reviewing');
                setMessage("");
            }
        } catch (err: any) {
            setMessage("Error al obtener asignación: " + (err.message ?? ""));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitReview = async () => {
        if (!peerAssignment) return;
        setLoading(true);
        try {
            await lmsApi.submitPeerReview(courseId, lessonId, peerAssignment.id, reviewScore, reviewFeedback);
            setMessage("Revisión enviada. ¡Gracias por tu feedback!");
            setPeerAssignment(null);
            setReviewFeedback("");
            setView('dashboard');
            await loadStatus();
        } catch (err: any) {
            setMessage("Error al enviar la revisión: " + (err.message ?? ""));
        } finally {
            setLoading(false);
        }
    };

    // ─── Calificación final ponderada ──────────────────────────────────────────
    const peerReviews = feedbackReceived.filter(r => !r.is_instructor_review);
    const instructorReview = feedbackReceived.find(r => r.is_instructor_review);
    const peerAvg = peerReviews.length > 0
        ? peerReviews.reduce((a, r) => a + r.score, 0) / peerReviews.length
        : null;

    let finalScore: number | null = null;
    if (mySubmission?.final_score != null) {
        finalScore = mySubmission.final_score;
    } else if (settings && peerAvg !== null && instructorReview) {
        finalScore = peerAvg * (settings.peer_weight / 100) + instructorReview.score * (settings.instructor_weight / 100);
    } else if (peerAvg !== null && !instructorReview) {
        finalScore = peerAvg;
    } else if (instructorReview && peerAvg === null) {
        finalScore = instructorReview.score;
    }

    const statusLabel = mySubmission?.status === 'graded' ? '✅ Calificado'
        : mySubmission?.status === 'under_review' ? '🔄 En revisión'
        : '⏳ Pendiente de revisiones';

    if (initLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (view === 'reviewing' && peerAssignment) {
        return (
            <div className="space-y-6">
                <button onClick={() => setView('dashboard')} className="text-sm text-gray-400 hover:text-white mb-4">
                    &larr; Volver al panel
                </button>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                    <h3 className="font-bold text-lg text-purple-400">Revisando entrega de un compañero</h3>
                    <div className="p-4 bg-black/30 rounded-xl text-gray-300 whitespace-pre-wrap">
                        {peerAssignment.content}
                    </div>
                </div>

                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-6">
                    <h4 className="font-bold text-white">Tu Feedback</h4>

                    {block.reviewCriteria && (
                        <div className="text-sm text-gray-400 bg-blue-500/10 p-4 rounded-xl">
                            <strong>Criterios:</strong> {block.reviewCriteria}
                        </div>
                    )}

                    {settings && (
                        <div className="text-xs text-slate-400 bg-purple-500/5 border border-purple-500/10 rounded-xl p-3">
                            Revisiones requeridas por entrega: <strong>{settings.required_reviews}</strong> ·
                            Peso pares: <strong>{settings.peer_weight}%</strong> · Peso instructor: <strong>{settings.instructor_weight}%</strong>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
                            Puntuación: <span className="text-purple-400">{reviewScore}/100</span>
                        </label>
                        <input
                            type="range" min={0} max={100} step={1}
                            value={reviewScore}
                            onChange={(e) => setReviewScore(parseInt(e.target.value))}
                            className="w-full accent-purple-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Comentarios</label>
                        <textarea
                            value={reviewFeedback}
                            onChange={(e) => setReviewFeedback(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 min-h-[120px] text-white focus:outline-none focus:border-purple-500"
                            placeholder="Proporciona feedback constructivo y detallado..."
                        />
                    </div>

                    <button
                        onClick={handleSubmitReview}
                        disabled={loading || !reviewFeedback.trim()}
                        className="w-full py-3 font-bold uppercase tracking-widest text-xs rounded-xl bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Enviando..." : "Enviar Revisión"}
                    </button>
                    {message && <p className="text-center text-sm text-red-400">{message}</p>}
                </div>
            </div>
        );
    }

    if (view === 'dashboard') {
        return (
            <div className="space-y-8">
                {/* Estado y nota final */}
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-start gap-4">
                    <div className="text-2xl">✅</div>
                    <div className="flex-1">
                        <h3 className="font-bold text-green-400">Trabajo Entregado</h3>
                        <p className="text-xs text-green-300/70 mt-1">{statusLabel}</p>

                        {/* Nota final ponderada */}
                        {finalScore !== null && (
                            <div className="mt-3 flex items-center gap-3">
                                <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                    <span className="text-xs text-yellow-400/70 font-bold uppercase tracking-wider">Nota final</span>
                                    <div className="text-2xl font-black text-yellow-400">{finalScore.toFixed(1)}<span className="text-sm font-normal text-yellow-400/60">/100</span></div>
                                </div>
                                {settings && (
                                    <div className="text-xs text-slate-400">
                                        <div>Pares ({settings.peer_weight}%): {peerAvg !== null ? peerAvg.toFixed(1) : '—'}</div>
                                        <div>Instructor ({settings.instructor_weight}%): {instructorReview ? instructorReview.score : '—'}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase text-gray-500 tracking-widest">Acciones</h4>
                        <button
                            onClick={handleStartReview}
                            disabled={loading}
                            className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-purple-500/10 hover:border-purple-500/30 transition-all text-left group disabled:opacity-50"
                        >
                            <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">👀</span>
                            <div className="font-bold text-purple-400">Revisar a un compañero</div>
                            <div className="text-xs text-gray-500 mt-1">Gana crédito revisando el trabajo de otros alumnos.</div>
                        </button>

                        <button
                            onClick={() => setView('submit')}
                            className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left"
                        >
                            <span className="text-2xl mb-2 block">📝</span>
                            <div className="font-bold text-blue-400">Editar mi entrega</div>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase text-gray-500 tracking-widest">
                            Feedback Recibido ({feedbackReceived.length})
                        </h4>
                        {feedbackReceived.length === 0 ? (
                            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center text-gray-500 italic text-sm">
                                Aún no has recibido revisiones. ¡Vuelve pronto!
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-80 overflow-y-auto">
                                {feedbackReceived.map(review => (
                                    <div
                                        key={review.id}
                                        className={`p-4 border rounded-xl space-y-2 ${review.is_instructor_review
                                            ? "bg-yellow-500/5 border-yellow-500/20"
                                            : "bg-white/5 border-white/10"
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${review.is_instructor_review ? "text-yellow-400" : "text-gray-500"}`}>
                                                {review.is_instructor_review ? "⭐ Instructor" : "Par evaluador"}
                                            </span>
                                            <span className={`text-sm font-bold ${review.is_instructor_review ? "text-yellow-400" : "text-purple-400"}`}>
                                                {review.score}/100
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-300">{review.feedback}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {message && <p className="text-center text-sm text-gray-400">{message}</p>}
            </div>
        );
    }

    // Default: Submit View
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-purple-400">👥</span> {block.title || "Evaluación entre Pares"}
                </h3>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl whitespace-pre-wrap text-gray-300">
                    {block.prompt || "Entrega tu trabajo a continuación."}
                </div>
            </div>

            {settings && (
                <div className="text-xs text-slate-400 bg-purple-500/5 border border-purple-500/10 rounded-xl p-3">
                    Se requieren <strong>{settings.required_reviews}</strong> revisiones ·
                    Nota final: <strong>{settings.peer_weight}%</strong> pares + <strong>{settings.instructor_weight}%</strong> instructor
                </div>
            )}

            <div className="space-y-4">
                <textarea
                    value={submissionContent}
                    onChange={(e) => setSubmissionContent(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-6 min-h-[200px] text-white focus:outline-none focus:border-purple-500 transition-all"
                    placeholder="Escribe tu entrega aquí o pega un enlace..."
                />

                <div className="flex items-center justify-between">
                    {mySubmission && (
                        <button onClick={() => setView('dashboard')} className="text-sm text-gray-500 hover:text-white">
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !submissionContent.trim()}
                        className="px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 ml-auto"
                    >
                        {loading ? "Enviando..." : (mySubmission ? "Actualizar Entrega" : "Entregar Tarea")}
                    </button>
                </div>
                {message && <p className="text-center text-sm text-gray-400">{message}</p>}
            </div>
        </div>
    );
}


interface PeerReviewPlayerProps {
    courseId: string;
    lessonId: string;
    block: Block;
}

export default function PeerReviewPlayer({ courseId, lessonId, block }: PeerReviewPlayerProps) {
    const [view, setView] = useState<'submit' | 'dashboard' | 'reviewing'>('submit');
    const [submissionContent, setSubmissionContent] = useState("");
    const [mySubmission, setMySubmission] = useState<CourseSubmission | null>(null);
    const [peerAssignment, setPeerAssignment] = useState<CourseSubmission | null>(null);
    const [feedbackReceived, setFeedbackReceived] = useState<PeerReview[]>([]);

    // Review form state
    const [reviewScore, setReviewScore] = useState(80);
    const [reviewFeedback, setReviewFeedback] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Initial check - do we have a submission?
    // We don't have an endpoint for "get my submission" directly in the list I made,
    // but I can infer it or try to fetch feedback.
    // Actually, I missed adding "get my submission" endpoint. 
    // Additionaly `getPeerReviewAssignment` excludes my own.
    // For now, let's assume if I can fetch feedback, I have submitted.
    // Or I can add a check endpoint. 
    // Let's try to fetch feedback first.

    useEffect(() => {
        const checkStatus = async () => {
            // For simplify, we just check feedback. If error or empty, maybe no submission?
            // Actually, `getMySubmissionFeedback` returns array.
            try {
                const reviews = await lmsApi.getMySubmissionFeedback(courseId, lessonId);
                setFeedbackReceived(reviews);
                // If we get reviews (or even empty array), it implies we might have submitted?
                // Not necessarily. 
                // I should have added `getMySubmission`.
                // But for now, let's rely on local storage or just show "Submit" if no local state.
                // Ideally backend check.
            } catch (err) {
                // Error might mean not authorized or something.
            }
        };
        checkStatus();
    }, [courseId, lessonId]);

    // Workaround: We will use a "saved" state in localStorage for "submitted" to avoid needing another endpoint right now,
    // or better: just try to submit. If it says "already submitted", handle it?
    // The backend `submit_assignment` UPDATES if exists. So it's safe to show form with previous content if we had it.
    // But we don't have "get my content".

    // Let's add a "View my submission" button if I assume I submitted?
    // Maybe just show the dashboard if I have feedback.

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const sub = await lmsApi.submitAssignment(courseId, lessonId, submissionContent);
            setMySubmission(sub);
            setView('dashboard');
            setMessage("Submission saved successfully!");
        } catch (err: any) {
            setMessage("Failed to submit: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStartReview = async () => {
        setLoading(true);
        try {
            const assignment = await lmsApi.getPeerReviewAssignment(courseId, lessonId);
            if (!assignment) {
                setMessage("No assignments available for review at the moment. Please try again later.");
            } else {
                setPeerAssignment(assignment);
                setView('reviewing');
                setMessage("");
            }
        } catch (err: any) {
            setMessage("Error fetching assignment: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitReview = async () => {
        if (!peerAssignment) return;
        setLoading(true);
        try {
            await lmsApi.submitPeerReview(courseId, lessonId, peerAssignment.id, reviewScore, reviewFeedback);
            setMessage("Review submitted successfully! Thank you.");
            setPeerAssignment(null);
            setReviewFeedback("");
            setView('dashboard');
        } catch (err: any) {
            setMessage("Failed to submit review: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (view === 'reviewing' && peerAssignment) {
        return (
            <div className="space-y-6">
                <button onClick={() => setView('dashboard')} className="text-sm text-gray-400 hover:text-white mb-4">
                    &larr; Back to Dashboard
                </button>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                    <h3 className="font-bold text-lg text-purple-400">Reviewing Peer Submission</h3>
                    <div className="p-4 bg-black/30 rounded-xl text-gray-300 whitespace-pre-wrap">
                        {peerAssignment.content}
                    </div>
                </div>

                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-6">
                    <h4 className="font-bold text-white">Your Feedback</h4>

                    {block.reviewCriteria && (
                        <div className="text-sm text-gray-400 bg-blue-500/10 p-4 rounded-xl">
                            <strong>Criteria:</strong> {block.reviewCriteria}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Score (0-100)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={reviewScore}
                            onChange={(e) => setReviewScore(parseInt(e.target.value))}
                            className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white w-24"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Comments</label>
                        <textarea
                            value={reviewFeedback}
                            onChange={(e) => setReviewFeedback(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 min-h-[120px] text-white focus:outline-none focus:border-purple-500"
                            placeholder="Provide constructive feedback..."
                        />
                    </div>

                    <button
                        onClick={handleSubmitReview}
                        disabled={loading || !reviewFeedback}
                        className="btn-primary w-full py-3 font-bold uppercase tracking-widest text-xs rounded-xl bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Submitting..." : "Submit Review"}
                    </button>
                    {message && <p className="text-center text-sm text-red-400">{message}</p>}
                </div>
            </div>
        );
    }

    if (view === 'dashboard') {
        return (
            <div className="space-y-8">
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-4">
                    <div className="text-2xl">✅</div>
                    <div>
                        <h3 className="font-bold text-green-400">Work Submitted</h3>
                        <p className="text-xs text-green-300/70">You can update your submission below or start reviewing peers.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase text-gray-500 tracking-widest">Actions</h4>
                        <button
                            onClick={handleStartReview}
                            className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-purple-500/10 hover:border-purple-500/30 transition-all text-left group"
                        >
                            <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">👀</span>
                            <div className="font-bold text-purple-400">Review a Peer</div>
                            <div className="text-xs text-gray-500 mt-1">Earn credit by reviewing other students&apos; work.</div>
                        </button>

                        <button
                            onClick={() => setView('submit')}
                            className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left"
                        >
                            <span className="text-2xl mb-2 block">📝</span>
                            <div className="font-bold text-blue-400">Edit My Submission</div>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase text-gray-500 tracking-widest">Feedback Received</h4>
                        {feedbackReceived.length === 0 ? (
                            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center text-gray-500 italic text-sm">
                                No reviews received yet. Check back later!
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {feedbackReceived.map(review => (
                                    <div key={review.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-gray-500">Peer Review</span>
                                            <span className="text-sm font-bold text-yellow-400">{review.score}/100</span>
                                        </div>
                                        <p className="text-sm text-gray-300">{review.feedback}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {message && <p className="text-center text-sm text-gray-400">{message}</p>}
            </div>
        );
    }

    // Default: Submit View
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-purple-400">👥</span> {block.title || "Peer Assessment"}
                </h3>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl whitespace-pre-wrap text-gray-300">
                    {block.prompt || "Please submit your work below."}
                </div>
            </div>

            <div className="space-y-4">
                <textarea
                    value={submissionContent}
                    onChange={(e) => setSubmissionContent(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-6 min-h-[200px] text-white focus:outline-none focus:border-purple-500 transition-all"
                    placeholder="Type your submission here or paste a link..."
                />

                <div className="flex items-center justify-between">
                    {feedbackReceived.length > 0 && (
                        <button onClick={() => setView('dashboard')} className="text-sm text-gray-500 hover:text-white">
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !submissionContent}
                        className="btn-primary px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 ml-auto"
                    >
                        {loading ? "Submitting..." : (mySubmission ? "Update Submission" : "Submit Assignment")}
                    </button>
                </div>
                {message && <p className="text-center text-sm text-gray-400">{message}</p>}
            </div>
        </div>
    );
}
