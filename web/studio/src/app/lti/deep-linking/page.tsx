"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cmsApi, lmsApi, Course, Module, Lesson, LtiDeepLinkingContentItem } from "@/lib/api";
import { Book, ChevronRight, Check, Search, ExternalLink } from "lucide-react";

function DeepLinkingPickerContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedContent, setSelectedContent] = useState<{ type: 'course' | 'module' | 'lesson', id: string, title: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const token = searchParams.get("token");
    const dlToken = searchParams.get("dl_token");

    useEffect(() => {
        if (token) {
            localStorage.setItem("studio_token", token);
        }
        loadCourses();
    }, [token]);

    const loadCourses = async () => {
        try {
            const data = await cmsApi.getCourses();
            setCourses(data);
        } catch (err) {
            console.error("Failed to load courses", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCourse = async (course: Course) => {
        setSelectedCourse(course);
        setSelectedContent({ type: 'course', id: course.id, title: course.title });
        // Fetch full outline to show modules/lessons
        try {
            const full = await cmsApi.getCourseWithFullOutline(course.id);
            setSelectedCourse(full);
        } catch (err) {
            console.error("Failed to load course outline", err);
        }
    };

    const handleConfirm = async () => {
        if (!selectedContent || !dlToken) return;
        setSubmitting(true);

        try {
            // Transform selected content into LTI items
            const item: LtiDeepLinkingContentItem = {
                type: 'ltiResourceLink',
                title: selectedContent.title,
                url: `${window.location.origin.replace('3001', '3003')}/courses/${selectedCourse?.id}${selectedContent.type === 'lesson' ? `/lessons/${selectedContent.id}` : ''}`,
            };

            const response = await lmsApi.getDeepLinkingResponse({
                dl_token: dlToken,
                items: [item]
            });

            // Create a form and auto-post it to the return_url
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = response.return_url;

            const jwtInput = document.createElement('input');
            jwtInput.type = 'hidden';
            jwtInput.name = 'JWT';
            jwtInput.value = response.jwt;
            form.appendChild(jwtInput);

            document.body.appendChild(form);
            form.submit();
        } catch (err) {
            console.error("Failed to generate DL response", err);
            setSubmitting(false);
        }
    };

    const filteredCourses = courses.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-4xl mx-auto p-8 h-full flex flex-col">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white tracking-tighter mb-2">PICK CONTENT TO EMBED</h1>
                <p className="text-gray-400">Select the course or specific lesson you want to link in your platform.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                {/* Right Column: Content Hierarchy */}
                <div className="glass rounded-3xl border border-white/5 p-6 flex flex-col overflow-hidden">
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
                            ))
                        ) : filteredCourses.length > 0 ? (
                            filteredCourses.map(course => (
                                <button
                                    key={course.id}
                                    onClick={() => handleSelectCourse(course)}
                                    className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4 group ${selectedCourse?.id === course.id ? 'bg-blue-600/20 border-blue-500/50' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedCourse?.id === course.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 group-hover:bg-white/20'}`}>
                                        <Book size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-white leading-tight">{course.title}</div>
                                        <div className="text-sm text-gray-500">{course.pacing_mode}</div>
                                    </div>
                                    <ChevronRight size={18} className={`transition-transform ${selectedCourse?.id === course.id ? 'rotate-90 text-blue-400' : 'text-gray-600'}`} />
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-500 italic">No courses found</div>
                        )}
                    </div>
                </div>

                {/* Right Column: Outline Picker */}
                <div className="glass rounded-3xl border border-white/5 p-6 flex flex-col overflow-hidden">
                    {selectedCourse ? (
                        <div className="flex flex-col h-full">
                            <h2 className="font-black text-xl text-white tracking-tight mb-4 flex items-center gap-2">
                                <Book size={18} className="text-blue-400" />
                                {selectedCourse.title}
                            </h2>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                <button
                                    onClick={() => setSelectedContent({ type: 'course', id: selectedCourse.id, title: selectedCourse.title })}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${selectedContent?.type === 'course' ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}
                                >
                                    <span className="font-bold text-white">Full Course Link</span>
                                    {selectedContent?.type === 'course' && <Check size={18} className="text-blue-400" />}
                                </button>

                                {selectedCourse.modules?.map(module => (
                                    <div key={module.id} className="space-y-2">
                                        <div className="text-xs font-black text-gray-500 tracking-widest uppercase px-2">{module.title}</div>
                                        {module.lessons.map(lesson => (
                                            <button
                                                key={lesson.id}
                                                onClick={() => setSelectedContent({ type: 'lesson', id: lesson.id, title: lesson.title })}
                                                className={`w-full text-left p-3 pl-4 rounded-xl border transition-all flex items-center justify-between ${selectedContent?.id === lesson.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}
                                            >
                                                <span className="text-gray-300 text-sm">{lesson.title}</span>
                                                {selectedContent?.id === lesson.id && <Check size={16} className="text-blue-400" />}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleConfirm}
                                disabled={!selectedContent || submitting}
                                className="mt-6 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 transition-all border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
                            >
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        EMBED THIS CONTENT
                                        <ExternalLink size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 mb-4">
                                <Book size={32} />
                            </div>
                            <div className="text-white font-bold mb-2">No Course Selected</div>
                            <p className="text-gray-500 text-sm">Select a course from the left to browse modules and lessons.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function DeepLinkingPicker() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
            <DeepLinkingPickerContent />
        </Suspense>
    );
}
