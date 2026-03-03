"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, Course } from "@/lib/api";
import { Save, Settings as SettingsIcon, BookOpen, Calendar, Clock, Download, Upload } from "lucide-react";

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
import TeamManagementSection from "./TeamManagementSection";

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
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [price, setPrice] = useState(0);
    const [currency, setCurrency] = useState("USD");

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
                setPrice(data.price || 0);
                setCurrency(data.currency || "USD");
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
                end_date: endDate ? new Date(endDate).toISOString() : undefined,
                price: price,
                currency: currency
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

    const handleExport = async () => {
        setExporting(true);
        try {
            const data = await cmsApi.exportCourse(id);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `course_${id}_export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export failed", err);
            alert("Error al exportar el curso");
        } finally {
            setExporting(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const newCourse = await cmsApi.importCourse(data);
            alert(`Curso importado con éxito: ${newCourse.title}`);
            router.push(`/courses/${newCourse.id}/settings`);
        } catch (err) {
            console.error("Import failed", err);
            alert("Error al importar el curso. Asegúrate de que el formato sea válido.");
        } finally {
            setImporting(false);
            if (e.target) e.target.value = ''; // Reset input
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    return (
        <CourseEditorLayout
            activeTab="settings"
            pageTitle="Configuración del Curso"
            pageDescription="Configura las propiedades generales del curso y las plantillas de certificados."
            pageActions={
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95 ${saving ? "opacity-75 cursor-wait" : ""}`}
                >
                    <Save size={18} />
                    {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
            }
        >
            <div className="space-y-8">
                <TeamManagementSection courseId={id} />

                {/* Passing Percentage Section */}
                <section className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-purple-600/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <SettingsIcon size={24} />
                        </div>
                        <h2 className="section-title">Configuración de Calificaciones</h2>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-black text-slate-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                                Passing Percentage
                            </label>
                            <div className="flex items-center gap-6">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={passingPercentage}
                                    onChange={(e) => setPassingPercentage(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                                />
                                <div className="text-4xl font-black text-blue-600 dark:text-blue-400 w-24 text-right">
                                    {passingPercentage}%
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-gray-500 mt-3 font-medium">
                                Students must achieve at least this percentage to pass the course.
                            </p>
                        </div>

                        {/* Performance Tiers Preview */}
                        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-xs font-black text-slate-400 dark:text-gray-500 mb-4 uppercase tracking-[0.2em]">Performance Tiers Preview</h3>
                            <div className="space-y-3 text-xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-red-500 rounded shadow-sm"></div>
                                    <span className="text-red-600 dark:text-red-400 font-bold">Reprobado:</span>
                                    <span className="text-slate-500 dark:text-gray-400 font-medium">0% - {Math.max(0, passingPercentage - 1)}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-orange-500 rounded shadow-sm"></div>
                                    <span className="text-orange-600 dark:text-orange-400 font-bold">Rendimiento Bajo:</span>
                                    <span className="text-slate-500 dark:text-gray-400 font-medium">{passingPercentage}% - {passingPercentage + 9}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-yellow-500 rounded shadow-sm"></div>
                                    <span className="text-yellow-600 dark:text-yellow-400 font-bold">Rendimiento Medio:</span>
                                    <span className="text-slate-500 dark:text-gray-400 font-medium">{passingPercentage + 10}% - {passingPercentage + 15}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-green-500 rounded shadow-sm"></div>
                                    <span className="text-green-600 dark:text-green-400 font-bold">Buen Rendimiento:</span>
                                    <span className="text-slate-500 dark:text-gray-400 font-medium">{passingPercentage + 16}% - 90%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-4 bg-blue-500 rounded shadow-sm"></div>
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">Excelente:</span>
                                    <span className="text-slate-500 dark:text-gray-400 font-medium">91% - 100%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Course Pacing Section */}
                <section className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600 dark:text-green-400">
                            <Clock size={24} />
                        </div>
                        <h2 className="section-title">Ritmo y Calendario del Curso</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="block text-sm font-black text-slate-700 dark:text-gray-300 uppercase tracking-wider">Pacing Mode</label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setPacingMode('self_paced')}
                                    className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left shadow-sm ${pacingMode === 'self_paced' ? 'border-blue-600 bg-blue-100/30' : 'border-slate-200 bg-white dark:border-white/5 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/10'}`}
                                >
                                    <div className={`font-bold ${pacingMode === 'self_paced' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-white'}`}>Self-Paced</div>
                                    <div className="text-xs text-slate-500 dark:text-gray-500 font-medium">Learners go at their own speed.</div>
                                </button>
                                <button
                                    onClick={() => setPacingMode('instructor_led')}
                                    className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left shadow-sm ${pacingMode === 'instructor_led' ? 'border-purple-600 bg-purple-100/30' : 'border-slate-200 bg-white dark:border-white/5 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/10'}`}
                                >
                                    <div className={`font-bold ${pacingMode === 'instructor_led' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-white'}`}>Instructor-Led</div>
                                    <div className="text-xs text-slate-500 dark:text-gray-500 font-medium">Cohort-based with specific dates.</div>
                                </button>
                            </div>
                        </div>

                        {pacingMode === 'instructor_led' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <label className="block text-sm font-black text-slate-700 dark:text-gray-300 uppercase tracking-wider">Course Schedule</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-widest">Start Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-widest">End Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Course Pricing Section */}
                <section className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <span className="text-xl font-black">$</span>
                        </div>
                        <h2 className="section-title">Precio del Curso</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="block text-sm font-black text-slate-700 dark:text-gray-300 uppercase tracking-wider">Price</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={price}
                                    onChange={(e) => setPrice(parseFloat(e.target.value))}
                                    className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors font-bold"
                                    placeholder="0.00"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 font-black">
                                    {currency}
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-gray-500 font-medium">Set to 0 for a free course.</p>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-black text-slate-700 dark:text-gray-300 uppercase tracking-wider">Currency</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none font-bold"
                            >
                                <option value="USD">USD - US Dollar</option>
                                <option value="CLP">CLP - Chilean Peso</option>
                                <option value="ARS">ARS - Argentine Peso</option>
                                <option value="BRL">BRL - Brazilian Real</option>
                                <option value="MXN">MXN - Mexican Peso</option>
                                <option value="COP">COP - Colombian Peso</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Certificate Template Section */}
                <section className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <BookOpen size={24} />
                        </div>
                        <h2 className="section-title">Plantilla de Certificado</h2>
                    </div>

                    <div className="space-y-6">
                        <p className="text-slate-500 dark:text-gray-400 font-medium">
                            Design the HTML certificate that students will receive upon passing the course.
                            Available variables: <code className="text-blue-600 dark:text-blue-400 font-black">{"{{student_name}}"}</code>, <code className="text-blue-600 dark:text-blue-400 font-black">{"{{course_title}}"}</code>, <code className="text-blue-600 dark:text-blue-400 font-black">{"{{date}}"}</code>, <code className="text-blue-600 dark:text-blue-400 font-black">{"{{score}}"}</code>.
                        </p>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="block text-sm font-black text-slate-700 dark:text-gray-300 uppercase tracking-wider">HTML Template</label>
                                <textarea
                                    value={certificateTemplate}
                                    onChange={(e) => setCertificateTemplate(e.target.value)}
                                    className="w-full h-[400px] bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-6 font-mono text-sm text-slate-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 transition-colors resize-none shadow-inner"
                                    placeholder="Enter HTML code here..."
                                />
                                <button
                                    onClick={() => setCertificateTemplate(DEFAULT_CERTIFICATE_TEMPLATE)}
                                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                    Reset to Default Template
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-black text-slate-700 dark:text-gray-300 uppercase tracking-wider">Live Preview</label>
                                <div className="w-full h-[400px] bg-white rounded-xl overflow-hidden relative group border border-slate-200 shadow-sm">
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
                {/* Course Portability Section */}
                <section className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Download size={24} />
                        </div>
                        <h2 className="section-title">Portabilidad del Curso</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800 dark:text-gray-300 uppercase tracking-wider">Export Course</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-500 font-medium">
                                Download the entire course structure, modules, and lessons as a JSON file.
                                You can use this to backup or move content between organizations.
                            </p>
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 shadow-sm text-slate-700 dark:text-white"
                            >
                                <Download size={18} />
                                {exporting ? "Exporting..." : "Download JSON"}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800 dark:text-gray-300 uppercase tracking-wider">Import Course</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-500 font-medium">
                                Upload a previously exported course JSON file. This will create a NEW course
                                within the current organization based on that data.
                            </p>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImport}
                                    disabled={importing}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <button
                                    disabled={importing}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-xl font-bold transition-all pointer-events-none"
                                >
                                    <Upload size={18} />
                                    {importing ? "Importing..." : "Upload JSON"}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </CourseEditorLayout>
    );
}
