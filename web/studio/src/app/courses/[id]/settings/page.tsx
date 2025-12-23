"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, Course } from "@/lib/api";
import { ArrowLeft, Save, Settings as SettingsIcon } from "lucide-react";

export default function CourseSettingsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [passingPercentage, setPassingPercentage] = useState(70);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchCourse = async () => {
            try {
                const data = await cmsApi.getCourse(id);
                setCourse(data);
                setPassingPercentage(data.passing_percentage || 70);
            } catch (err) {
                console.error("Failed to load course", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCourse();
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await cmsApi.updateCourse(id, { passing_percentage: passingPercentage });
            setCourse(updated);
            alert("Course settings updated successfully!");
        } catch (err) {
            console.error("Failed to save", err);
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    if (!course) return (
        <div className="min-h-screen bg-gray-900 text-white p-20 text-center">
            Course not found.
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 text-white pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5 py-4 px-8">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <h1 className="text-xl font-bold">{course.title} - Settings</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        <Save size={18} />
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-8 mt-12 space-y-8">
                {/* Passing Percentage Section */}
                <section className="bg-white/5 border border-white/10 rounded-3xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                            <SettingsIcon size={24} />
                        </div>
                        <h2 className="text-2xl font-black">Grading Configuration</h2>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-3">
                                Passing Percentage
                            </label>
                            <div className="flex items-center gap-6">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={passingPercentage}
                                    onChange={(e) => setPassingPercentage(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="text-4xl font-black text-blue-400 w-24 text-right">
                                    {passingPercentage}%
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                                Students must achieve at least this percentage to pass the course.
                            </p>
                        </div>

                        {/* Performance Tiers Preview */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-gray-300 mb-4">Performance Tiers Preview</h3>
                            <div className="space-y-3 text-xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-red-500 rounded"></div>
                                    <span className="text-red-400 font-bold">Reprobado:</span>
                                    <span className="text-gray-400">0% - {Math.max(0, passingPercentage - 1)}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-orange-500 rounded"></div>
                                    <span className="text-orange-400 font-bold">Rendimiento Bajo:</span>
                                    <span className="text-gray-400">{passingPercentage}% - {passingPercentage + 9}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-yellow-500 rounded"></div>
                                    <span className="text-yellow-400 font-bold">Rendimiento Medio:</span>
                                    <span className="text-gray-400">{passingPercentage + 10}% - {passingPercentage + 15}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-green-500 rounded"></div>
                                    <span className="text-green-400 font-bold">Buen Rendimiento:</span>
                                    <span className="text-gray-400">{passingPercentage + 16}% - 90%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-blue-500 rounded"></div>
                                    <span className="text-blue-400 font-bold">Excelente:</span>
                                    <span className="text-gray-400">91% - 100%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
