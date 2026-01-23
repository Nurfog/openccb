"use client";

import { useEffect, useState } from "react";
import { lmsApi, UserGrade } from "@/lib/api";
import { Trophy, Award, BookOpen, RotateCcw, Bot, Loader2, Star, Sparkles, CheckCircle2 } from "lucide-react";

interface LessonLockedViewProps {
    lessonId: string;
    courseId: string;
    grade: UserGrade;
    maxAttempts?: number;
}

export default function LessonLockedView({ lessonId, courseId, grade, maxAttempts }: LessonLockedViewProps) {
    const [feedback, setFeedback] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const res = await lmsApi.getLessonFeedback(lessonId);
                setFeedback(res.response);
            } catch (err) {
                console.error("Error fetching AI feedback:", err);
                setFeedback("¡Buen trabajo completando esta evaluación! Sigue así para mejorar tus resultados en las próximas lecciones.");
            } finally {
                setLoading(false);
            }
        };
        fetchFeedback();
    }, [lessonId]);

    const scorePct = Math.round(grade.score * 100);
    const isPassing = scorePct >= 70; // Assuming 70% is passing

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header / Score Card */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative glass p-10 md:p-16 rounded-[2.5rem] border border-white/10 bg-black/40 text-center space-y-8 overflow-hidden">
                    {/* Background visual flair */}
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Sparkles size={120} className="text-blue-500" />
                    </div>

                    <div className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                        <CheckCircle2 size={12} /> Evaluación Finalizada
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                            Tu Puntuación: <span className={isPassing ? "text-blue-500" : "text-amber-500"}>{scorePct}%</span>
                        </h2>
                        <div className="flex justify-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                    key={s}
                                    size={32}
                                    className={`${s <= Math.ceil(scorePct / 20) ? "text-yellow-500 fill-yellow-500" : "text-white/5"} transition-all`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 pt-4">
                        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/5">
                            <RotateCcw size={20} className="text-gray-500" />
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Intentos Usados</p>
                                <p className="text-lg font-black text-white">{grade.attempts_count} {maxAttempts ? `de ${maxAttempts}` : ""}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/5">
                            <Trophy size={20} className="text-amber-500" />
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Estado</p>
                                <p className={`text-lg font-black uppercase ${isPassing ? "text-green-500" : "text-amber-500"}`}>
                                    {isPassing ? "Aprobado" : "No Alcanzado"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Feedback Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass p-8 md:p-12 rounded-[2.5rem] border border-white/5 bg-blue-600/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full group-hover:bg-blue-600/20 transition-all duration-1000"></div>

                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-8 flex items-center gap-3">
                            <Bot size={20} className="animate-bounce" /> Retroalimentación de tu Tutor de IA
                        </h3>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                <p className="text-xs font-black uppercase tracking-widest text-gray-500">Generando análisis personalizado...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-xl md:text-2xl text-gray-200 leading-relaxed font-medium">
                                    {feedback}
                                </div>
                                <div className="h-px w-20 bg-blue-500/40 rounded-full"></div>
                                <p className="text-xs font-bold text-gray-500 italic uppercase tracking-wider">
                                    Este análisis es generado automáticamente basándose en tu desempeño histórico y los contenidos de esta lección.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-8 rounded-[2rem] border border-white/5 bg-white/[0.02]">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                            <BookOpen size={16} className="text-blue-500" /> Próximos Pasos
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 group cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                                    <Award size={16} />
                                </div>
                                <p className="text-xs font-bold text-gray-300 leading-tight group-hover:text-white transition-colors">Continúa con la siguiente lección para seguir sumando XP.</p>
                            </li>
                            <li className="flex items-start gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 group cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                    <BookOpen size={16} />
                                </div>
                                <p className="text-xs font-bold text-gray-300 leading-tight group-hover:text-white transition-colors">Revisa el glosario de términos de esta sección.</p>
                            </li>
                        </ul>
                    </div>

                    <div className="p-8 rounded-[2rem] bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Nota Importante</p>
                        <p className="text-[11px] font-bold text-amber-500/70 leading-relaxed uppercase tracking-tight">
                            Has alcanzado el máximo de intentos. Esta evaluación está bloqueada, pero puedes seguir repasando los materiales del curso.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
