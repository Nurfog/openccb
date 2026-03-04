"use client";

import React, { useState, useEffect } from "react";
import {
    cmsApi,
    Course,
    getImageUrl
} from "@/lib/api";
import {
    Save,
    Sparkles,
    Image as ImageIcon,
    Type,
    Target,
    AlertCircle,
    CheckCircle2,
    Clock,
    Award,
    Zap,
    Maximize,
    Monitor,
    Square,
    Smartphone,
    X
} from "lucide-react";

interface MarketingTabProps {
    courseId: string;
}

const RESOLUTIONS = [
    { label: "16:9 Landscape", width: 1024, height: 576, icon: Monitor },
    { label: "1:1 Square", width: 1024, height: 1024, icon: Square },
    { label: "4:3 Classic", width: 1024, height: 768, icon: Maximize },
    { label: "9:16 Portrait", width: 576, height: 1024, icon: Smartphone },
];

export default function MarketingTab({ courseId }: MarketingTabProps) {
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [selectedRes, setSelectedRes] = useState(RESOLUTIONS[0]);
    const [isGenerating, setIsGenerating] = useState(false);

    // Form states
    const [objectives, setObjectives] = useState("");
    const [requirements, setRequirements] = useState("");
    const [duration, setDuration] = useState("");
    const [modulesSummary, setModulesSummary] = useState("");
    const [certificationInfo, setCertificationInfo] = useState("");

    const loadCourse = async () => {
        try {
            setLoading(true);
            const data = await cmsApi.getCourse(courseId);
            setCourse(data);

            // Initialize form from metadata
            const meta = data.marketing_metadata || {};
            setObjectives(meta.objectives || "");
            setRequirements(meta.requirements || "");
            setDuration(meta.duration || "");
            setModulesSummary(meta.modules_summary || "");
            setCertificationInfo(meta.certification_info || "");

            if (data.generation_status === 'processing' || data.generation_status === 'queued') {
                setIsGenerating(true);
            } else {
                setIsGenerating(false);
            }
        } catch (err) {
            console.error("Failed to load course", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCourse();
    }, [courseId]);

    // Polling for generation status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isGenerating) {
            interval = setInterval(async () => {
                const updated = await cmsApi.getCourse(courseId);
                setCourse(updated);
                if (updated.generation_status === 'completed' || updated.generation_status === 'error') {
                    setIsGenerating(false);
                    clearInterval(interval);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isGenerating, courseId]);

    const handleSaveMetadata = async () => {
        try {
            setSaving(true);
            await cmsApi.updateCourse(courseId, {
                marketing_metadata: {
                    objectives,
                    requirements,
                    duration,
                    modules_summary: modulesSummary,
                    certification_info: certificationInfo
                }
            });
            alert("Marketing metadata saved successfully!");
        } catch (err) {
            console.error("Save failed", err);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateImage = async () => {
        try {
            setIsGenerating(true);
            await cmsApi.generateCourseImage(courseId, {
                prompt: prompt || course?.title,
                width: selectedRes.width,
                height: selectedRes.height
            });
        } catch (err) {
            console.error("Generation failed", err);
            alert("Failed to start generation.");
            setIsGenerating(false);
        }
    };

    const handleCancelGeneration = async () => {
        try {
            await cmsApi.updateCourse(courseId, {
                generation_status: 'idle'
            } as any);
            setIsGenerating(false);
            setCourse(prev => prev ? { ...prev, generation_status: 'idle' } : null);
        } catch (err) {
            console.error("Cancel failed", err);
            alert("Failed to cancel generation.");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── SECTION: COURSE IMAGE AI ── */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[3rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500">
                <div className="p-10 lg:p-14 flex flex-col lg:flex-row gap-12">

                    {/* Left: Preview */}
                    <div className="lg:w-1/2 space-y-6">
                        <div className="group relative aspect-video rounded-[2.5rem] bg-slate-100 dark:bg-black/20 overflow-hidden border border-slate-200 dark:border-white/5 shadow-inner">
                            {course?.course_image_url ? (
                                <img
                                    src={getImageUrl(course.course_image_url)}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                                    alt="Course Preview"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <ImageIcon size={64} className="opacity-20 stroke-[1]" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">No preview generated</p>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="absolute inset-0 bg-white/60 dark:bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center">
                                    <Zap size={48} className="text-blue-500 animate-pulse mb-6" />
                                    <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-4">Generating Visual Intelligence...</h4>

                                    <div className="w-full h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mb-4 border border-white/10">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 ease-out"
                                            style={{ width: `${course?.generation_progress || 0}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-8">
                                        Analysis Phase: {course?.generation_progress || 0}% Complete
                                    </p>

                                    <button
                                        onClick={handleCancelGeneration}
                                        className="flex items-center gap-2 px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full border border-red-500/20 transition-all active:scale-95 group/cancel"
                                    >
                                        <X size={14} className="group-hover/cancel:rotate-90 transition-transform" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.1em]">Abort Mission</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {course?.generation_error && (
                            <div className="p-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-3xl flex items-center gap-4 text-red-600 dark:text-red-400">
                                <AlertCircle size={24} />
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1">Neural Engine Error</p>
                                    <p className="text-sm font-medium">{course.generation_error}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Controls */}
                    <div className="lg:w-1/2 space-y-10">
                        <div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-4">
                                <Sparkles className="text-blue-500" />
                                AI Visual Identity
                            </h3>
                            <p className="text-slate-500 dark:text-gray-500 mt-2 font-medium">Generate a cinematic landing page image using Stable Diffusion.</p>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2">Creative Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder={course?.title || "Describe the visual mood of your course..."}
                                className="w-full h-32 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none font-medium shadow-inner"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2">Resolution Matrix</label>
                            <div className="grid grid-cols-2 gap-4">
                                {RESOLUTIONS.map((res) => {
                                    const Icon = res.icon;
                                    const isSelected = selectedRes.label === res.label;
                                    return (
                                        <button
                                            key={res.label}
                                            onClick={() => setSelectedRes(res)}
                                            className={`p-5 rounded-3xl border transition-all flex items-center gap-4 group ${isSelected
                                                ? "bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20 active:scale-95"
                                                : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/10 active:scale-95 shadow-sm"
                                                }`}
                                        >
                                            <div className={`p-2 rounded-xl ${isSelected ? "bg-white/20" : "bg-slate-100 dark:bg-white/10 group-hover:scale-110 transition-transform"}`}>
                                                <Icon size={20} />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-xs font-black uppercase tracking-tight">{res.label}</p>
                                                <p className={`text-[10px] font-black opacity-60 ${isSelected ? "text-white" : "text-slate-400"}`}>{res.width}x{res.height}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={handleGenerateImage}
                            disabled={isGenerating}
                            className={`w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-4 group ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                                    Synthesizing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                                    Energize Neural Engine
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── SECTION: CORE MARKETING DATA ── */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[3rem] p-10 lg:p-14 space-y-12 shadow-sm">
                <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div>
                        <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-4">
                            <Megaphone className="text-indigo-500" />
                            Marketing Manifesto
                        </h3>
                        <p className="text-slate-500 dark:text-gray-500 mt-2 font-medium">Define the core value proposition and educational objectives.</p>
                    </div>
                    <button
                        onClick={handleSaveMetadata}
                        disabled={saving}
                        className="flex items-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                        {saving ? 'Saving Manifest...' : 'Update Manifesto'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 ml-2 flex items-center gap-2">
                                <Target size={14} /> Learning Objectives
                            </label>
                            <textarea
                                value={objectives}
                                onChange={(e) => setObjectives(e.target.value)}
                                placeholder="What will the student achieve?"
                                className="w-full h-40 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none font-medium shadow-inner"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 ml-2 flex items-center gap-2">
                                <Zap size={14} /> Requirements & Prerequisites
                            </label>
                            <textarea
                                value={requirements}
                                onChange={(e) => setRequirements(e.target.value)}
                                placeholder="What should they know before starting?"
                                className="w-full h-40 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all resize-none font-medium shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2 flex items-center gap-2">
                                <Clock size={14} /> Estimated Duration
                            </label>
                            <input
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                placeholder="e.g. 10 weeks, 40 hours"
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[1.5rem] px-6 py-4 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-black uppercase tracking-tight shadow-inner"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2 flex items-center gap-2">
                                <Award size={14} /> Certification Info
                            </label>
                            <textarea
                                value={certificationInfo}
                                onChange={(e) => setCertificationInfo(e.target.value)}
                                placeholder="Details about the final certificate or credential."
                                className="w-full h-32 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none font-medium shadow-inner"
                            />
                        </div>

                        <div className="p-8 bg-blue-50 dark:bg-blue-500/5 rounded-[2.5rem] border border-blue-100 dark:border-blue-500/10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <AlertCircle size={20} />
                                </div>
                                <h4 className="font-black uppercase tracking-tight text-blue-900 dark:text-blue-300">Public Preview</h4>
                            </div>
                            <p className="text-sm text-blue-700/70 dark:text-blue-400/70 font-medium leading-relaxed">
                                This information will be displayed on the public landing page. Use compelling language to increase student enrollment.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-6">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-2 flex items-center gap-2">
                        <Type size={14} /> Modules Deep-Dive (Sales Summary)
                    </label>
                    <textarea
                        value={modulesSummary}
                        onChange={(e) => setModulesSummary(e.target.value)}
                        placeholder="Highlight the key modules and what's unique about them."
                        className="w-full h-40 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-[2rem] p-8 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none font-medium shadow-inner"
                    />
                </div>
            </div>
        </div>
    );
}

import { Megaphone } from "lucide-react";
