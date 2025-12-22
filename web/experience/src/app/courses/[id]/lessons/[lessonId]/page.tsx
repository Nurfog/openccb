"use client";

import { useEffect, useState } from "react";
import { lmsApi, Lesson, Course, Module } from "@/lib/api";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Menu, CheckCircle2 } from "lucide-react";

import DescriptionPlayer from "@/components/blocks/DescriptionPlayer";
import MediaPlayer from "@/components/blocks/MediaPlayer";
import QuizPlayer from "@/components/blocks/QuizPlayer";
import FillInTheBlanksPlayer from "@/components/blocks/FillInTheBlanksPlayer";
import MatchingPlayer from "@/components/blocks/MatchingPlayer";
import OrderingPlayer from "@/components/blocks/OrderingPlayer";
import ShortAnswerPlayer from "@/components/blocks/ShortAnswerPlayer";

export default function LessonPlayerPage({ params }: { params: { id: string, lessonId: string } }) {
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [course, setCourse] = useState<(Course & { modules: Module[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [lessonData, courseData] = await Promise.all([
                    lmsApi.getLesson(params.lessonId),
                    lmsApi.getCourseOutline(params.id)
                ]);
                setLesson(lessonData);
                setCourse(courseData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [params.id, params.lessonId]);

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-500 font-bold uppercase tracking-widest">Loading Experience...</div>;
    if (!lesson || !course) return <div className="p-20 text-center text-red-400">Content not found.</div>;

    const allLessons = course.modules.flatMap(m => m.lessons);
    const currentIndex = allLessons.findIndex(l => l.id === params.lessonId);
    const prevLesson = allLessons[currentIndex - 1];
    const nextLesson = allLessons[currentIndex + 1];

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* Navigation Sidebar */}
            <aside
                className={`glass border-r border-white/5 transition-all duration-500 bg-black/40 flex flex-col ${sidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-none'}`}
            >
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-1">Course Content</h2>
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
            <main className="flex-1 flex flex-col relative">
                <div className="absolute top-4 left-4 z-10">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-3 rounded-xl glass border-white/10 text-gray-400 hover:text-white transition-all bg-black/40"
                    >
                        <Menu size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-12">
                    <div className="max-w-4xl mx-auto space-y-20 pb-40">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400">
                                <span>{lesson.content_type === 'activity' ? 'Interactive Activity' : 'Video Lesson'}</span>
                            </div>
                            <h1 className="text-4xl font-black tracking-tighter text-white">{lesson.title}</h1>
                        </div>

                        {/* Render Blocks */}
                        {(lesson.metadata?.blocks || []).length > 0 ? (
                            <div className="space-y-24">
                                {lesson.metadata?.blocks?.map((block) => (
                                    <div key={block.id} className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                                        {block.type === 'description' && (
                                            <DescriptionPlayer id={block.id} title={block.title} content={block.content || ""} />
                                        )}
                                        {block.type === 'media' && (
                                            <MediaPlayer
                                                id={block.id}
                                                title={block.title}
                                                url={block.url || ""}
                                                media_type={block.media_type || 'video'}
                                                config={block.config}
                                            />
                                        )}
                                        {block.type === 'quiz' && (
                                            <QuizPlayer id={block.id} title={block.title} quizData={block.quiz_data || { questions: [] }} />
                                        )}
                                        {block.type === 'fill-in-the-blanks' && (
                                            <FillInTheBlanksPlayer id={block.id} title={block.title} content={block.content || ""} />
                                        )}
                                        {block.type === 'matching' && (
                                            <MatchingPlayer id={block.id} title={block.title} pairs={block.pairs || []} />
                                        )}
                                        {block.type === 'ordering' && (
                                            <OrderingPlayer id={block.id} title={block.title} items={block.items || []} />
                                        )}
                                        {block.type === 'short-answer' && (
                                            <ShortAnswerPlayer
                                                id={block.id}
                                                title={block.title}
                                                prompt={block.prompt || ""}
                                                correctAnswers={block.correctAnswers || []}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center glass-card border-dashed border-white/10">
                                <p className="text-gray-500 font-bold uppercase tracking-widest">This lesson currently has no content.</p>
                            </div>
                        )}

                        {lesson.is_graded && (
                            <div className="pt-20 border-t border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                                <div className="bg-blue-600/10 border border-blue-500/20 rounded-[2rem] p-12 text-center relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all duration-700"></div>
                                    <h3 className="text-2xl font-black mb-4">Complete & Submit</h3>
                                    <p className="text-gray-400 max-w-sm mx-auto mb-8 text-sm">
                                        This activity is graded. Make sure you&apos;ve completed all blocks before submitting your work for evaluation.
                                    </p>

                                    <button
                                        onClick={async () => {
                                            const userData = localStorage.getItem("user");
                                            if (userData) {
                                                const u = JSON.parse(userData);
                                                try {
                                                    // In a real scenario, we'd calculate the actual score from blocks
                                                    await lmsApi.submitScore(u.id, params.id, params.lessonId, 100);
                                                    alert("Score submitted successfully!");
                                                } catch (err) {
                                                    console.error("Submission failed", err);
                                                }
                                            }
                                        }}
                                        className="btn-premium px-12 py-4 rounded-2xl shadow-blue-500/40 shadow-xl group/btn"
                                    >
                                        <span className="flex items-center gap-2 font-black italic">
                                            SUBMIT FOR GRADING <CheckCircle2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <footer className="h-20 glass border-t border-white/5 px-6 flex items-center justify-between bg-black/60 backdrop-blur-3xl">
                    {prevLesson ? (
                        <Link href={`/courses/${params.id}/lessons/${prevLesson.id}`} className="group flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl glass border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-all text-gray-400 group-hover:text-white">
                                <ChevronLeft size={20} />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Previous</p>
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
                            {currentIndex + 1} OF {allLessons.length} COMPLETED
                        </span>
                    </div>

                    {nextLesson ? (
                        <Link href={`/courses/${params.id}/lessons/${nextLesson.id}`} className="btn-premium !py-3 !px-6 text-xs !shadow-none">
                            Next Lesson <ChevronRight size={18} />
                        </Link>
                    ) : (
                        <Link href="/" className="btn-premium !bg-green-600 !py-3 !px-6 text-xs !shadow-none">
                            Finish Course <CheckCircle2 size={18} />
                        </Link>
                    )}
                </footer>
            </main>
        </div>
    );
}
