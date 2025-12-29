"use client";

import { useEffect, useState } from "react";
import { lmsApi, Course, Module } from "@/lib/api";
import Link from "next/link";
import { BookOpen, ChevronRight, PlayCircle, Calendar, Clock, Info } from "lucide-react";

export default function CourseOutlinePage({ params }: { params: { id: string } }) {
    const [courseData, setCourseData] = useState<(Course & { modules: Module[] }) | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        lmsApi.getCourseOutline(params.id)
            .then(setCourseData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [params.id]);

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

    if (!courseData) return <div className="text-center py-20 text-gray-500">Course not found.</div>;

    return (
        <div className="max-w-4xl mx-auto px-6 py-20">
            <div className="mb-16">
                <div className="flex items-center gap-2 mb-6 text-blue-500 font-bold text-xs uppercase tracking-widest">
                    <Link href="/" className="hover:text-white transition-colors">Catalog</Link>
                    <ChevronRight size={14} className="text-gray-600" />
                    <span>Course Details</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter mb-6">{courseData.title}</h1>
                <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mb-10">
                    {courseData.description || "Master the core principles and advanced techniques in this structured curriculum. Each module is designed to provide actionable insights and hands-on experience."}
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-10">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest ${courseData.pacing_mode === 'instructor_led' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }`}>
                        {courseData.pacing_mode === 'instructor_led' ? <Clock size={14} /> : <Info size={14} />}
                        {courseData.pacing_mode === 'instructor_led' ? 'Instructor-Led' : 'Self-Paced'}
                    </div>

                    {courseData.pacing_mode === 'instructor_led' && (courseData.start_date || courseData.end_date) && (
                        <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                            <Calendar size={14} />
                            <span>
                                {courseData.start_date ? new Date(courseData.start_date).toLocaleDateString() : 'TBD'}
                                <span className="mx-2 text-gray-700">→</span>
                                {courseData.end_date ? new Date(courseData.end_date).toLocaleDateString() : 'TBD'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">Modules</span>
                            <span className="text-xl font-bold text-white">{courseData.modules.length}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">Total Lessons</span>
                            <span className="text-xl font-bold text-white">
                                {courseData.modules.reduce((acc, m) => acc + m.lessons.length, 0)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Link href={`/courses/${params.id}/calendar`}>
                            <button className="px-6 py-3 glass hover:border-blue-500/50 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 active:scale-95">
                                <Calendar size={16} /> Timeline
                            </button>
                        </Link>
                        <Link href={`/courses/${params.id}/progress`}>
                            <button className="px-8 py-3 glass hover:border-blue-500/50 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 active:scale-95">
                                📊 Progress
                            </button>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {courseData.modules.map((module, idx) => (
                    <div key={module.id} className="relative">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-xl glass border-blue-500/20 bg-blue-500/10 flex items-center justify-center">
                                <span className="text-blue-400 font-black text-xs">{idx + 1}</span>
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{module.title}</h2>
                        </div>

                        <div className="grid gap-3 pl-14">
                            {module.lessons.map((lesson) => (
                                <Link key={lesson.id} href={`/courses/${params.id}/lessons/${lesson.id}`}>
                                    <div className="glass-card !p-4 group hover:bg-white/10 border-white/5 active:scale-[0.99] transition-all">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                                    {lesson.content_type === 'video' ? (
                                                        <PlayCircle size={18} className="text-gray-400 group-hover:text-blue-400" />
                                                    ) : (
                                                        <BookOpen size={18} className="text-gray-400 group-hover:text-blue-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{lesson.title}</h3>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                                        {lesson.content_type === 'activity' ? 'Interactive Activity' : 'Video Lesson'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                {lesson.due_date && (
                                                    <div className="text-right hidden sm:block">
                                                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Deadline</div>
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
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
