"use client";

import { useEffect, useState } from "react";
import { lmsApi, Lesson, Course, Module, UserGrade } from "@/lib/api";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Menu, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

import DescriptionPlayer from "@/components/blocks/DescriptionPlayer";
import MediaPlayer from "@/components/blocks/MediaPlayer";
import QuizPlayer from "@/components/blocks/QuizPlayer";
import FillInTheBlanksPlayer from "@/components/blocks/FillInTheBlanksPlayer";
import MatchingPlayer from "@/components/blocks/MatchingPlayer";
import OrderingPlayer from "@/components/blocks/OrderingPlayer";
import ShortAnswerPlayer from "@/components/blocks/ShortAnswerPlayer";
import CodeExercisePlayer from "@/components/blocks/CodeExercisePlayer";
import HotspotPlayer from "@/components/blocks/HotspotPlayer";
import MemoryPlayer from "@/components/blocks/MemoryPlayer";
import DocumentPlayer from "@/components/blocks/DocumentPlayer";
import AudioResponsePlayer from "@/components/blocks/AudioResponsePlayer";
import InteractiveTranscript from "@/components/InteractiveTranscript";
import { ListMusic } from "lucide-react";

export default function LessonPlayerPage({ params }: { params: { id: string, lessonId: string } }) {
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [course, setCourse] = useState<(Course & { modules: Module[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [transcriptOpen, setTranscriptOpen] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [userGrade, setUserGrade] = useState<UserGrade | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [lessonData, courseData] = await Promise.all([
                    lmsApi.getLesson(params.lessonId),
                    lmsApi.getCourseOutline(params.id)
                ]);
                setLesson(lessonData);
                setCourse(courseData);

                if (user) {
                    const grades = await lmsApi.getUserGrades(user.id, params.id);
                    const currentGrade = grades.find((g: UserGrade) => g.lesson_id === params.lessonId);
                    setUserGrade(currentGrade || null);
                }
            } catch (err) {
                console.error("Error al cargar los datos de la lección", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [params.id, params.lessonId, user]);

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-500 font-bold uppercase tracking-widest">Cargando Experiencia...</div>;
    if (!lesson || !course) return <div className="p-20 text-center text-red-400">Contenido no encontrado.</div>;

    const allLessons = course.modules.flatMap(m => m.lessons);
    const currentIndex = allLessons.findIndex(l => l.id === params.lessonId);
    const prevLesson = allLessons[currentIndex - 1];
    const nextLesson = allLessons[currentIndex + 1];

    const hasTranscription = lesson.transcription && lesson.transcription.cues && lesson.transcription.cues.length > 0 &&
        !(lesson.metadata?.blocks || []).some(b => b.type === 'media' && b.config?.show_transcript === false);

    const handleSeek = (time: number) => {
        const videoElement = document.querySelector('video');
        if (videoElement) {
            videoElement.currentTime = time;
            videoElement.play();
        }
    };

    const handleBlockComplete = async (blockId: string, score: number) => {
        if (user) {
            try {
                // Update the score for the specific block in metadata
                const currentBlockScores = (userGrade?.metadata?.block_scores as Record<string, number>) || {};
                const newBlockScores = {
                    ...currentBlockScores,
                    [blockId]: score
                };

                const res = await lmsApi.submitScore(
                    user.id,
                    params.id,
                    params.lessonId,
                    userGrade?.score || 0, // Keep overall score for now, or calculate average/sum
                    { ...userGrade?.metadata, block_scores: newBlockScores }
                );
                setUserGrade(res);
                console.log(`Score for block ${blockId} submitted: ${score}`);
            } catch (err) {
                console.error(`Failed to submit score for block ${blockId}`, err);
            }
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* Navigation Sidebar */}
            <aside
                className={`glass border-r border-white/5 transition-all duration-500 bg-black/40 flex flex-col ${sidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-none'}`}
            >
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-1">Contenido del Curso</h2>
                    <p className="text-sm font-bold text-white truncate">{course.title}</p>
                </div>

                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
                    {course.modules.map((module) => (
                        <div key={module.id} className="space-y-2">
                            <h4 className="px-3 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">{module.title}</h4>
                            <div className="space-y-1">
                                {module.lessons.map((l) => (
                                    <Link
                                        key={l.id}
                                        href={`/courses/${params.id}/lessons/${l.id}`}
                                        className={`sidebar-link ${l.id === params.lessonId ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
                                    >
                                        <div className="flex-1 truncate">{l.title}</div>
                                        {/* Placeholder for progress checkmark */}
                                        <div className="w-4 h-4 rounded-full border border-white/10" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-3 rounded-xl glass border-white/10 text-gray-400 hover:text-white transition-all bg-black/40"
                        title="Alternar Barra Lateral"
                    >
                        <Menu size={20} />
                    </button>
                    {hasTranscription && (
                        <button
                            onClick={() => setTranscriptOpen(!transcriptOpen)}
                            className={`p-3 rounded-xl glass border-white/10 transition-all bg-black/40 ${transcriptOpen ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
                            title="Alternar Transcripción"
                        >
                            <ListMusic size={20} />
                        </button>
                    )}
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-12">
                        <div className="max-w-4xl mx-auto space-y-20 pb-40">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400">
                                    <span>{lesson.content_type === 'activity' ? 'Actividad Interactiva' : 'Lección en Video'}</span>
                                </div>
                                <h1 className="text-4xl font-black tracking-tighter text-white">{lesson.title}</h1>
                            </div>

                            {lesson.summary && (
                                <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 animate-in fade-in slide-in-from-top-4 duration-1000">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-4 flex items-center gap-2">
                                        <span className="text-base">✨</span> Resumen
                                    </h3>
                                    <p className="text-lg text-gray-300 leading-relaxed font-medium italic">
                                        &quot;{lesson.summary}&quot;
                                    </p>
                                </div>
                            )}

                            {/* Render Blocks */}
                            {(lesson.metadata?.blocks || []).length > 0 ? (
                                <div className="space-y-24">
                                    {lesson.metadata?.blocks?.map((block) => {
                                        const renderBlock = () => {
                                            switch (block.type) {
                                                case 'description':
                                                    return <DescriptionPlayer id={block.id} title={block.title} content={block.content || ""} />;
                                                case 'media':
                                                    return (
                                                        <MediaPlayer
                                                            id={block.id}
                                                            lessonId={params.lessonId}
                                                            title={block.title}
                                                            url={block.url || ""}
                                                            media_type={block.media_type || 'video'}
                                                            config={block.config}
                                                            onTimeUpdate={setCurrentTime}
                                                            initialPlayCount={
                                                                userGrade?.metadata?.play_counts
                                                                    ? (userGrade.metadata.play_counts as Record<string, number>)[block.id] || 0
                                                                    : 0
                                                            }
                                                            onPlay={async () => {
                                                                if (user && lesson.max_attempts && (!userGrade || userGrade.attempts_count < lesson.max_attempts)) {
                                                                    const currentPlayCounts = (userGrade?.metadata?.play_counts as Record<string, number>) || {};
                                                                    const newPlayCounts = {
                                                                        ...currentPlayCounts,
                                                                        [block.id]: (currentPlayCounts[block.id] || 0) + 1
                                                                    };

                                                                    try {
                                                                        const res = await lmsApi.submitScore(
                                                                            user.id,
                                                                            params.id,
                                                                            params.lessonId,
                                                                            userGrade?.score || 0,
                                                                            { ...userGrade?.metadata, play_counts: newPlayCounts }
                                                                        );
                                                                        setUserGrade(res);
                                                                    } catch (err) {
                                                                        console.error("Error al guardar el recuento de reproducciones", err);
                                                                    }
                                                                }
                                                            }}
                                                            isGraded={lesson.is_graded}
                                                        />
                                                    );
                                                case 'document':
                                                    return <DocumentPlayer id={block.id} title={block.title} url={block.url || ""} />;
                                                case 'quiz':
                                                    return (
                                                        <QuizPlayer
                                                            id={block.id}
                                                            title={block.title}
                                                            quizData={block.quiz_data || { questions: [] }}
                                                            allowRetry={lesson.allow_retry}
                                                            maxAttempts={lesson.max_attempts || undefined}
                                                            initialAttempts={
                                                                userGrade?.metadata?.block_attempts
                                                                    ? (userGrade.metadata.block_attempts as Record<string, number>)[block.id] || 0
                                                                    : 0
                                                            }
                                                            onAttempt={async () => {
                                                                if (user) {
                                                                    const currentAttempts = (userGrade?.metadata?.block_attempts as Record<string, number>) || {};
                                                                    const newAttempts = {
                                                                        ...currentAttempts,
                                                                        [block.id]: (currentAttempts[block.id] || 0) + 1
                                                                    };

                                                                    try {
                                                                        const res = await lmsApi.submitScore(
                                                                            user.id,
                                                                            params.id,
                                                                            params.lessonId,
                                                                            userGrade?.score || 0,
                                                                            { ...userGrade?.metadata, block_attempts: newAttempts }
                                                                        );
                                                                        setUserGrade(res);
                                                                    } catch (err) {
                                                                        console.error("Error al guardar los intentos del bloque", err);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    );
                                                case 'fill-in-the-blanks':
                                                    return <FillInTheBlanksPlayer id={block.id} title={block.title} content={block.content || ""} allowRetry={lesson.allow_retry} />;
                                                case 'matching':
                                                    return <MatchingPlayer id={block.id} title={block.title} pairs={block.pairs || []} allowRetry={lesson.allow_retry} />;
                                                case 'ordering':
                                                    return <OrderingPlayer id={block.id} title={block.title} items={block.items || []} allowRetry={lesson.allow_retry} />;
                                                case 'short-answer':
                                                    return (
                                                        <ShortAnswerPlayer
                                                            id={block.id}
                                                            title={block.title}
                                                            prompt={block.prompt || ""}
                                                            correctAnswers={block.correctAnswers || []}
                                                            allowRetry={lesson.allow_retry}
                                                        />
                                                    );
                                                case 'audio-response':
                                                    return (
                                                        <AudioResponsePlayer
                                                            id={block.id}
                                                            prompt={block.prompt || ""}
                                                            keywords={block.keywords}
                                                            timeLimit={block.timeLimit}
                                                            isGraded={lesson.is_graded}
                                                            onComplete={(score) => handleBlockComplete(block.id, score)}
                                                        />
                                                    );
                                                case 'code':
                                                    return (
                                                        <CodeExercisePlayer
                                                            title={block.title}
                                                            instructions={block.instructions || ""}
                                                            initialCode={block.initialCode || ""}
                                                            onComplete={(score) => handleBlockComplete(block.id, score)}
                                                        />
                                                    );
                                                case 'hotspot':
                                                    return (
                                                        <HotspotPlayer
                                                            title={block.title}
                                                            description={block.content || ""}
                                                            imageUrl={block.url || ""}
                                                            hotspots={block.metadata?.hotspots || []}
                                                            onComplete={(score) => handleBlockComplete(block.id, score)}
                                                        />
                                                    );
                                                case 'memory-match':
                                                    return (
                                                        <MemoryPlayer
                                                            title={block.title}
                                                            pairs={block.metadata?.pairs || []}
                                                            onComplete={(score) => handleBlockComplete(block.id, score)}
                                                        />
                                                    );
                                                default:
                                                    return <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-500 uppercase tracking-widest">Tipo de Bloque Desconocido: {block.type}</div>;
                                            }
                                        };

                                        return (
                                            <div key={block.id} className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                                                {renderBlock()}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-20 text-center glass-card border-dashed border-white/10">
                                    <p className="text-gray-500 font-bold uppercase tracking-widest">Actualmente, esta lección no tiene contenido.</p>
                                </div>
                            )}

                            {lesson.is_graded && (
                                <div className="pt-20 border-t border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                                    {userGrade && lesson.max_attempts && userGrade.attempts_count >= lesson.max_attempts ? (
                                        <div className="space-y-4">
                                            <div className="inline-flex items-center gap-2 px-6 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-black uppercase tracking-widest">
                                                Bloqueado: Se alcanzó el máximo de intentos ({lesson.max_attempts})
                                            </div>
                                            <div className="text-4xl font-black text-white">
                                                Puntuación: <span className="text-blue-500">{userGrade.score * 100}%</span>
                                            </div>
                                            <p className="text-gray-500 text-xs italic">Esta evaluación ya está cerrada para futuras entregas.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={async () => {
                                                    if (user) {
                                                        try {
                                                            // In a real scenario, we'd calculate the actual score from blocks
                                                            const res = await lmsApi.submitScore(user.id, params.id, params.lessonId, 1.0);
                                                            setUserGrade(res);
                                                            alert("¡Puntuación enviada con éxito!");
                                                        } catch (err) {
                                                            console.error("Falló el envío", err);
                                                            alert("Error al enviar la puntuación. Por favor, inténtalo de nuevo.");
                                                        }
                                                    }
                                                }}
                                                className="btn-premium px-12 py-4 rounded-2xl shadow-blue-500/40 shadow-xl group/btn"
                                            >
                                                <span className="flex items-center gap-2 font-black italic">
                                                    {userGrade ? `ENVIAR INTENTO ${userGrade.attempts_count + 1}` : 'ENVIAR PARA CALIFICAR'}
                                                    <CheckCircle2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                </span>
                                            </button>
                                            {lesson.max_attempts && (
                                                <p className="mt-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    Intento {userGrade ? userGrade.attempts_count : 0} de {lesson.max_attempts} usado
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Interactive Transcript Panel */}
                    {hasTranscription && transcriptOpen && (
                        <aside className="w-[400px] border-l border-white/5 bg-black/20 animate-in slide-in-from-right duration-500">
                            <InteractiveTranscript
                                transcription={lesson.transcription!}
                                currentTime={currentTime}
                                onSeek={handleSeek}
                            />
                        </aside>
                    )}
                </div>

                {/* Footer Controls */}
                <footer className="h-20 glass border-t border-white/5 px-6 flex items-center justify-between bg-black/60 backdrop-blur-3xl shrink-0">
                    {prevLesson ? (
                        <Link href={`/courses/${params.id}/lessons/${prevLesson.id}`} className="group flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl glass border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-all text-gray-400 group-hover:text-white">
                                <ChevronLeft size={20} />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Anterior</p>
                                <p className="text-xs font-bold text-gray-300 group-hover:text-white truncate max-w-[120px]">{prevLesson.title}</p>
                            </div>
                        </Link>
                    ) : <div />}

                    <div className="hidden lg:flex items-center gap-2">
                        <div className="flex gap-1">
                            {allLessons.map((l, i) => (
                                <div key={l.id} className={`w-8 h-1 rounded-full ${i <= currentIndex ? 'bg-blue-500' : 'bg-white/10'}`} />
                            ))}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">
                            {currentIndex + 1} OF {allLessons.length} COMPLETADO
                        </span>
                    </div>

                    {nextLesson ? (
                        <Link href={`/courses/${params.id}/lessons/${nextLesson.id}`} className="btn-premium !py-3 !px-6 text-xs !shadow-none">
                            Siguiente Lección <ChevronRight size={18} />
                        </Link>
                    ) : (
                        <Link href="/" className="btn-premium !bg-green-600 !py-3 !px-6 text-xs !shadow-none">
                            Finalizar Curso <CheckCircle2 size={18} />
                        </Link>
                    )}
                </footer>
            </main>
        </div>
    );
}
