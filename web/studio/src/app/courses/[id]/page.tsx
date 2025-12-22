"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course, Module, Lesson } from "@/lib/api";
import Link from "next/link";

interface FullModule extends Module {
    lessons: Lesson[];
}

export default function CourseEditor({ params }: { params: { id: string } }) {
    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<FullModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                // Use cmsApi for consistent, typed data fetching
                const data = await cmsApi.getCourseWithFullOutline(params.id);

                setCourse(data);
                setModules(data.modules as FullModule[]);
            } catch (err) {
                console.error("Failed to load course data:", err);
                setError("Failed to load course details. Is the backend running?");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [params.id]);

    const handleAddModule = async () => {
        const title = prompt("Module Title:");
        if (!title) return;

        try {
            const newMod = await cmsApi.createModule(params.id, title, modules.length + 1);
            setModules([...modules, { ...newMod, lessons: [] }]);
        } catch {
            alert("Failed to create module");
        }
    };

    const handleAddLesson = async (moduleId: string) => {
        const title = prompt("Lesson Title:");
        if (!title) return;

        try {
            // Default to 'video' for now as a content type
            const newLesson = await cmsApi.createLesson(moduleId, title, "video", 1);
            setModules(modules.map(mod =>
                mod.id === moduleId
                    ? { ...mod, lessons: [...mod.lessons, newLesson] }
                    : mod
            ));
        } catch {
            alert("Failed to create lesson");
        }
    };

    const [isPublishing, setIsPublishing] = useState(false);

    const handlePublish = async () => {
        if (!course) return;
        setIsPublishing(true);
        try {
            await cmsApi.publishCourse(params.id);
            alert("Course published successfully to LMS!");
        } catch (err) {
            console.error("Publish failed:", err);
            alert("Failed to publish course. Check if LMS service is reachable.");
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) return <div className="py-20 text-center">Loading editor...</div>;
    if (error) return <div className="py-20 text-center text-red-400">{error}</div>;

    return (
        <div className="space-y-8">
            {/* ... navigation ... */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
                <Link href="/" className="hover:text-white cursor-pointer underline">Courses</Link>
                <span>/</span>
                <span className="text-white">{course?.title}</span>
            </div>

            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold">{course?.title}</h2>
                    <p className="text-gray-400">Editor - Outline (ID: {params.id})</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 glass hover:bg-white/10 transition-colors text-sm font-medium">Preview</button>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className={`btn-premium flex items-center gap-2 ${isPublishing ? "opacity-75 cursor-wait" : ""}`}
                    >
                        {isPublishing ? (
                            <>
                                <span className="animate-spin text-lg">⏳</span>
                                Publishing...
                            </>
                        ) : (
                            "Publish to LMS"
                        )}
                    </button>
                </div>
            </div>

            <div className="glass p-1">
                <div className="flex border-b border-white/10">
                    <Link href={`/courses/${params.id}`} className="px-6 py-3 text-sm font-medium border-b-2 border-blue-500 bg-white/5">Outline</Link>
                    <Link href={`/courses/${params.id}/grading`} className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-white transition-colors">Grading</Link>
                    <button className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-white transition-colors">Settings</button>
                    <button className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-white transition-colors">Files</button>
                </div>

                <div className="p-6 space-y-4">
                    {modules.map((module) => (
                        <div key={module.id} className="glass overflow-hidden">
                            <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/5">
                                <span className="font-medium text-blue-400">Module {module.position}: {module.title}</span>
                                <button className="text-xs text-gray-400 hover:text-white">Options</button>
                            </div>
                            <div className="p-4 space-y-2">
                                {module.lessons.map(lesson => (
                                    <Link href={`/courses/${params.id}/lessons/${lesson.id}`} key={lesson.id}>
                                        <div className="glass border-white/5 p-3 flex items-center justify-between text-sm hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer group/lesson">
                                            <div className="flex items-center gap-3">
                                                <span className="text-blue-400 text-lg group-hover/lesson:scale-110 transition-transform">
                                                    {lesson.content_type === 'video' ? '🎬' : '📄'}
                                                </span>
                                                <span>{lesson.title}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {lesson.transcription && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">CC</span>}
                                                <span className="text-xs text-gray-500 capitalize">{lesson.content_type}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}

                                <button
                                    onClick={() => handleAddLesson(module.id)}
                                    className="w-full py-2 border border-dashed border-white/10 rounded-lg text-xs text-gray-500 hover:text-white hover:border-white/20 transition-all mt-2"
                                >
                                    + New Lesson
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleAddModule}
                        className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl font-medium text-gray-500 hover:text-white hover:border-white/20 transition-all"
                    >
                        + Add Module
                    </button>
                </div>
            </div>
        </div>
    );
}
