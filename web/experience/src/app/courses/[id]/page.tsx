"use client";

import { useEffect, useState } from "react";
import { lmsApi, Course, Module, Recommendation, UserGrade } from "@/lib/api";
import { Sparkles, AlertTriangle, ArrowRight, CheckCircle2, XCircle, Circle } from "lucide-react";
import Link from "next/link";
import { BookOpen, ChevronRight, PlayCircle, Calendar, Clock, Info, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import DiscussionBoard from "@/components/DiscussionBoard";
import { AnnouncementsList } from "@/components/AnnouncementsList";

export default function CourseOutlinePage({ params }: { params: { id: string } }) {
    const { user } = useAuth();
    const [courseData, setCourseData] = useState<(Course & { modules: Module[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [userGrades, setUserGrades] = useState<UserGrade[]>([]);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [lessonDependencies, setLessonDependencies] = useState<any[]>([]);
    const [instructors, setInstructors] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await lmsApi.getCourseOutline(params.id);
                setCourseData({ ...data.course, modules: data.modules });
                setLessonDependencies(data.dependencies || []);
                setInstructors(data.instructors || []);

                if (user) {
                    const grades = await lmsApi.getUserGrades(user.id, params.id);
                    setUserGrades(grades);

                    const enrollmentData = await lmsApi.getEnrollments(user.id);
                    const enrolled = enrollmentData.some(e => e.course_id === params.id);

                    // Allow preview token to override enrollment status
                    const isPreview = typeof window !== 'undefined' && !!sessionStorage.getItem('preview_token');
                    setIsEnrolled(enrolled || isPreview);
                } else {
                    // Even if not logged in, if there's a preview token, consider "enrolled" for UI
                    const isPreview = typeof window !== 'undefined' && !!sessionStorage.getItem('preview_token');
                    if (isPreview) setIsEnrolled(true);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        setLoadingAI(true);
        lmsApi.getRecommendations(params.id)
            .then(res => setRecommendations(res.recommendations))
            .catch(console.error)
            .finally(() => setLoadingAI(false));
    }, [params.id, user]);

    const handleEnrollOrBuy = async () => {
        if (!user) {
            window.location.href = "/auth/login";
            return;
        }

        try {
            await lmsApi.enroll(params.id, user.id);
            setIsEnrolled(true);
        } catch (err: any) {
            if (err.message.includes("Payment Required")) {
                try {
                    const { init_point } = await lmsApi.createPaymentPreference(params.id);
                    window.location.href = init_point;
                } catch (pErr) {
                    console.error("Falló la creación de preferencia de pago", pErr);
                    alert("No se pudo iniciar el proceso de pago.");
                }
            } else {
                console.error("Falló la inscripción", err);
            }
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-20 animate-pulse">
                <div className="h-12 w-2/3 bg-white/5 rounded-xl mb-6"></div>
                <div className="h-6 w-1/3 bg-white/5 rounded-xl mb-12"></div>
                <div className="space-y-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 glass-card bg-white/5 border-white/5"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!courseData) return <div className="text-center py-20 text-gray-500">Curso no encontrado.</div>;

    const isLessonLocked = (lessonId: string) => {
        if (!isEnrolled) return false;
        const deps = lessonDependencies.filter(d => d.lesson_id === lessonId);
        if (deps.length === 0) return false;

        return deps.some(dep => {
            const prereqGrade = userGrades.find(g => g.lesson_id === dep.prerequisite_lesson_id);
            if (!prereqGrade) return true; // Not completed at all
            if (dep.min_score_percentage && (prereqGrade.score * 100) < dep.min_score_percentage) return true;
            return false;
        });
    };

    const getStatusIcon = (lessonId: string, isGraded: boolean, allowRetry: boolean) => {
        if (isLessonLocked(lessonId)) {
            return <Lock size={18} className="text-gray-600" />;
        }
        const grade = userGrades.find((g: UserGrade) => g.lesson_id === lessonId);
        if (!grade) {
            return <Circle size={18} className="text-white/20" />;
        }

        if (isGraded) {
            const passing = courseData.passing_percentage || 70;
            if (grade.score >= passing) {
                return <CheckCircle2 size={18} className="text-green-500" />;
            } else {
                return (
                    <div className="flex items-center gap-1">
                        <XCircle size={18} className="text-red-500" />
                        {allowRetry && <span className="text-[8px] font-black uppercase text-white/40">Repetible</span>}
                    </div>
                );
            }
        }

        return <CheckCircle2 size={18} className="text-white/40" />;
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-20">
            <div className="mb-16">
                <div className="flex items-center gap-2 mb-6 text-blue-500 font-bold text-xs uppercase tracking-widest">
                    <Link href="/" className="hover:text-white transition-colors">Catálogo</Link>
                    <ChevronRight size={14} className="text-gray-600" />
                    <span>Detalles del Curso</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter mb-6">{courseData.title}</h1>
                <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mb-10">
                    {courseData.description || "Domina los principios básicos y las técnicas avanzadas en este plan de estudios estructurado. Cada módulo está diseñado para proporcionar conocimientos prácticos y experiencia práctica."}
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-10">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest ${courseData.pacing_mode === 'instructor_led'
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }`}>
                        {courseData.pacing_mode === 'instructor_led' ? <Clock size={14} /> : <Info size={14} />}
                        {courseData.pacing_mode === 'instructor_led' ? 'Dirigido por un Instructor' : 'A tu Ritmo'}
                    </div>

                    {courseData.pacing_mode === 'instructor_led' && (courseData.start_date || courseData.end_date) && (
                        <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                            <Calendar size={14} />
                            <span>
                                {courseData.start_date ? new Date(courseData.start_date).toLocaleDateString() : 'Por Determinar'}
                                <span className="mx-2 text-gray-700">→</span>
                                {courseData.end_date ? new Date(courseData.end_date).toLocaleDateString() : 'Por Determinar'}
                            </span>
                        </div>
                    )}
                </div>

                {instructors.length > 0 && (
                    <div className="mb-10 animate-in fade-in slide-in-from-left-4 duration-700">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 block">Equipo docente</span>
                        <div className="flex flex-wrap gap-6">
                            {instructors.map((inst) => (
                                <div key={inst.id} className="flex items-center gap-3 glass border-white/5 px-4 py-2 rounded-2xl hover:bg-white/5 transition-all">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400 font-bold text-xs">
                                        {inst.full_name?.charAt(0) || inst.email?.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-gray-200">{inst.full_name}</div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-blue-500/60">{inst.role === 'primary' ? 'Instructor principal' : inst.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">Módulos</span>
                            <span className="text-xl font-bold text-white">{courseData.modules.length}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">Lecciones Totales</span>
                            <span className="text-xl font-bold text-white">
                                {courseData.modules.reduce((acc, m) => acc + m.lessons.length, 0)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {!isEnrolled && (
                            <button
                                onClick={handleEnrollOrBuy}
                                className="btn-premium px-8 py-3 !bg-blue-600 !text-white shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                            >
                                {courseData.price > 0 ? (
                                    <>
                                        <span className="font-black">{courseData.currency} {courseData.price.toFixed(0)}</span>
                                        Comprar Ahora
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} /> Inscribirse Gratis
                                    </>
                                )}
                            </button>
                        )}
                        <Link href={`/courses/${params.id}/calendar`}>
                            <button className="px-6 py-3 glass hover:border-blue-500/50 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 active:scale-95">
                                <Calendar size={16} /> Cronología
                            </button>
                        </Link>
                        <Link href={`/courses/${params.id}/progress`}>
                            <button className="px-8 py-3 glass hover:border-blue-500/50 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 active:scale-95">
                                📊 Progreso
                            </button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* AI Recommendations Section */}
            {(loadingAI || recommendations.length > 0) && (
                <div className="mb-20">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl glass border-purple-500/20 bg-purple-500/10 flex items-center justify-center">
                            <Sparkles size={18} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Tu Ruta de Aprendizaje IA</h2>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Sugerencias personalizadas basadas en tu rendimiento</p>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {loadingAI ? (
                            <div className="glass-card border-white/5 bg-white/5 animate-pulse p-8">
                                <div className="h-4 w-1/3 bg-white/10 rounded mb-4"></div>
                                <div className="h-3 w-2/3 bg-white/10 rounded"></div>
                            </div>
                        ) : (
                            recommendations.map((rec: Recommendation, i: number) => (
                                <div key={i} className="glass-card border-white/5 hover:border-purple-500/30 transition-all p-6 group">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${rec.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    rec.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                        'bg-green-500/10 text-green-400 border border-green-500/20'
                                                    }`}>
                                                    Prioridad {rec.priority}
                                                </div>
                                                {rec.priority === 'high' && <AlertTriangle size={12} className="text-red-400" />}
                                            </div>
                                            <h3 className="text-lg font-bold text-white">{rec.title}</h3>
                                            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{rec.description}</p>
                                            <div className="bg-white/5 rounded-lg p-3 inline-block">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 italic">¿Por qué?</p>
                                                <p className="text-xs text-gray-300 font-medium">{rec.reason}</p>
                                            </div>
                                        </div>
                                        {rec.lesson_id && (
                                            <Link href={`/courses/${params.id}/lessons/${rec.lesson_id}`}>
                                                <button className="whitespace-nowrap px-6 py-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
                                                    Ir a la Lección <ArrowRight size={14} />
                                                </button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Announcements Section */}
            <div className="mb-16">
                <AnnouncementsList courseId={params.id} isInstructor={user?.role === 'instructor' || user?.role === 'admin'} />
            </div>

            <div className="space-y-12">
                {courseData.modules.map((module: Module, idx: number) => (
                    <div key={module.id} className="relative">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-xl glass border-blue-500/20 bg-blue-500/10 flex items-center justify-center">
                                <span className="text-blue-400 font-black text-xs">{idx + 1}</span>
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{module.title}</h2>
                        </div>

                        <div className="grid gap-3 pl-14">
                            {module.lessons.map((lesson: any) => {
                                const locked = isLessonLocked(lesson.id);
                                const isPreviewable = lesson.is_previewable;
                                return (isEnrolled || isPreviewable) ? (
                                    locked ? (
                                        <div key={lesson.id} className="glass-card !p-4 border-white/5 opacity-60 cursor-not-allowed">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                                        <Lock size={18} className="text-gray-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-gray-400">{lesson.title}</h3>
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Bloqueado por Prerrequisitos</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <Lock size={18} className="text-gray-600" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Link key={lesson.id} href={`/courses/${params.id}/lessons/${lesson.id}`}>
                                            <div className="glass-card !p-4 group hover:bg-white/10 border-white/5 active:scale-[0.99] transition-all">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                                            {lesson.content_type === 'video' ? (
                                                                <PlayCircle size={18} className={`${isPreviewable && !isEnrolled ? 'text-green-400' : 'text-gray-400'} group-hover:text-blue-400`} />
                                                            ) : (
                                                                <BookOpen size={18} className={`${isPreviewable && !isEnrolled ? 'text-green-400' : 'text-gray-400'} group-hover:text-blue-400`} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{lesson.title}</h3>
                                                                {isPreviewable && !isEnrolled && (
                                                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded">Vista previa</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                                                {lesson.content_type === 'activity' ? 'Actividad Interactiva' : 'Lección en Video'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        {getStatusIcon(lesson.id, lesson.is_graded, lesson.allow_retry)}
                                                        {lesson.due_date && (
                                                            <div className="text-right hidden sm:block">
                                                                <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Vencimiento</div>
                                                                <div className={`text-[10px] font-bold ${new Date(lesson.due_date) < new Date() ? 'text-red-400' : 'text-blue-400'}`}>
                                                                    {new Date(lesson.due_date).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ChevronRight size={18} className="text-blue-500" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                ) : (
                                    <div key={lesson.id} onClick={handleEnrollOrBuy} className="glass-card !p-4 group border-white/5 opacity-60 cursor-pointer hover:bg-white/5 transition-all">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                                    <Clock size={18} className="text-gray-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-500">{lesson.title}</h3>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600 flex items-center gap-1">
                                                        Contenido Protegido
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600 font-bold text-[10px] uppercase tracking-widest">
                                                <span>Bloqueado</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Discussions Section */}
            <div className="mt-20">
                <DiscussionBoard courseId={params.id} />
            </div>
        </div>
    );
}
