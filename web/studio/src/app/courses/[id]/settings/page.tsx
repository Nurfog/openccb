"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, Course } from "@/lib/api";
import { ArrowLeft, Save, Settings as SettingsIcon, BookOpen, Calendar, Clock } from "lucide-react";

const DEFAULT_CERTIFICATE_TEMPLATE = `
<div style="width: 800px; height: 600px; padding: 40px; text-align: center; border: 10px solid #787878; font-family: 'Times New Roman', serif; background-color: #fff; color: #333;">
    <div style="width: 100%; height: 100%; padding: 20px; text-align: center; border: 5px solid #787878; display: flex; flex-direction: column; justify-content: center;">
       <span style="font-size: 50px; font-weight: bold; margin-bottom: 30px; display: block;">Certificate of Completion</span>
       <span style="font-size: 25px; display: block; margin-bottom: 20px;"><i>This is to certify that</i></span>
       <span style="font-size: 30px; font-weight: bold; display: block; margin-bottom: 20px; text-decoration: underline;">{{student_name}}</span>
       <span style="font-size: 25px; display: block; margin-bottom: 20px;"><i>has successfully completed the course</i></span>
       <span style="font-size: 30px; font-weight: bold; display: block; margin-bottom: 20px;">{{course_title}}</span>
       <span style="font-size: 20px; display: block; margin-bottom: 40px;">with a score of <b>{{score}}%</b></span>
       <span style="font-size: 25px; display: block; margin-bottom: 10px;"><i>Dated</i></span>
       <span style="font-size: 20px; display: block;">{{date}}</span>
    </div>
</div>
`;

import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function CourseSettingsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [passingPercentage, setPassingPercentage] = useState(70);
    const [certificateTemplate, setCertificateTemplate] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pacingMode, setPacingMode] = useState<'self_paced' | 'instructor_led'>("self_paced");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        const fetchCourse = async () => {
            try {
                const data = await cmsApi.getCourse(id);
                setCourse(data);
                setPassingPercentage(data.passing_percentage || 70);
                setCertificateTemplate(data.certificate_template || DEFAULT_CERTIFICATE_TEMPLATE);
                setPacingMode(data.pacing_mode || "self_paced");
                setStartDate(data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : "");
                setEndDate(data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : "");
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
            const updated = await cmsApi.updateCourse(id, {
                passing_percentage: passingPercentage,
                certificate_template: certificateTemplate,
                pacing_mode: pacingMode,
                start_date: startDate ? new Date(startDate).toISOString() : undefined,
                end_date: endDate ? new Date(endDate).toISOString() : undefined
            });
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
        <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    if (!course) return (
        <div className="min-h-screen bg-[#0f1115] text-white p-20 text-center">
            Course not found.
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                Course Settings
                            </h1>
                            <p className="text-gray-400 mt-1">Configure general course properties and certificates for {course?.title}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 ${saving ? "opacity-75 cursor-wait" : ""}`}
                    >
                        <Save size={18} />
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>

                <CourseEditorLayout activeTab="settings">

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

                    {/* Course Pacing Section */}
                    <section className="bg-white/5 border border-white/10 rounded-3xl p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400">
                                <Clock size={24} />
                            </div>
                            <h2 className="text-2xl font-black">Course Pacing & Schedule</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-gray-300">Pacing Mode</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setPacingMode('self_paced')}
                                        className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${pacingMode === 'self_paced' ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="font-bold">Self-Paced</div>
                                        <div className="text-xs text-gray-500">Learners go at their own speed.</div>
                                    </button>
                                    <button
                                        onClick={() => setPacingMode('instructor_led')}
                                        className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${pacingMode === 'instructor_led' ? 'border-purple-500 bg-purple-500/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="font-bold">Instructor-Led</div>
                                        <div className="text-xs text-gray-500">Cohort-based with specific dates.</div>
                                    </button>
                                </div>
                            </div>

                            {pacingMode === 'instructor_led' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-sm font-bold text-gray-300">Course Schedule</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-500">Start Date</label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-500">End Date</label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Certificate Template Section */}
                    <section className="bg-white/5 border border-white/10 rounded-3xl p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <BookOpen size={24} />
                            </div>
                            <h2 className="text-2xl font-black">Certificate Template</h2>
                        </div>

                        <div className="space-y-6">
                            <p className="text-gray-400">
                                Design the HTML certificate that students will receive upon passing the course.
                                Available variables: <code className="text-blue-400">{"{{student_name}}"}</code>, <code className="text-blue-400">{"{{course_title}}"}</code>, <code className="text-blue-400">{"{{date}}"}</code>, <code className="text-blue-400">{"{{score}}"}</code>.
                            </p>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-300">HTML Template</label>
                                    <textarea
                                        value={certificateTemplate}
                                        onChange={(e) => setCertificateTemplate(e.target.value)}
                                        className="w-full h-[400px] bg-black/30 border border-white/10 rounded-xl p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                        placeholder="Enter HTML code here..."
                                    />
                                    <button
                                        onClick={() => setCertificateTemplate(DEFAULT_CERTIFICATE_TEMPLATE)}
                                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                                    >
                                        Reset to Default Template
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-300">Live Preview</label>
                                    <div className="w-full h-[400px] bg-white rounded-xl overflow-hidden relative group">
                                        <iframe
                                            srcDoc={certificateTemplate
                                                .replace(/{{student_name}}/g, "Jane Doe")
                                                .replace(/{{course_title}}/g, course?.title || "Demo Course")
                                                .replace(/{{date}}/g, new Date().toLocaleDateString())
                                                .replace(/{{score}}/g, "95")
                                            }
                                            className="w-full h-full transform scale-75 origin-top-left w-[133%] h-[133%]"
                                            style={{ border: "none" }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 pointer-events-none transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
