"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course, Organization } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { Plus, BookOpen, Download, Upload, Sparkles, Wand2 } from "lucide-react";
import OrganizationSelector from "@/components/OrganizationSelector";
import Modal from "@/components/Modal";

export default function StudioDashboard() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadCourses = async () => {
      if (!user) {
        setLoading(false);
        return;
      };
      try {
        const data = await cmsApi.getCourses();
        setCourses(data);
      } catch (err) {
        console.error("Failed to load courses", err);
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, [user]);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const loadOrgs = async () => {
      if (user?.role === 'admin' && user?.organization_id === '00000000-0000-0000-0000-000000000001') {
        try {
          const orgs = await cmsApi.getOrganizations();
          setOrganizations(orgs);
        } catch (err) {
          console.error("Failed to load organizations", err);
        }
      }
    };
    loadOrgs();
  }, [user]);

  const handleCreateCourse = async () => {
    setIsTitleModalOpen(true);
  };

  const onTitleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle) return;
    setIsTitleModalOpen(false);

    const isSuperAdmin = user?.role === 'admin' && user?.organization_id === '00000000-0000-0000-0000-000000000001';
    if (isSuperAdmin && organizations.length > 0) {
      setIsOrgModalOpen(true);
    } else {
      createCourse();
    }
  };

  const createCourse = async (targetOrgId?: string) => {
    try {
      const newCourse = await cmsApi.createCourse(newCourseTitle, targetOrgId);
      setCourses((prev: Course[]) => [...prev, newCourse]);
      setNewCourseTitle("");
    } catch (err) {
      console.error("Failed to create course", err);
      alert("Failed to create course. Please ensure the backend is running.");
    }
  };

  const handleAIGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt) return;

    setIsGenerating(true);
    try {
      const newCourse = await cmsApi.generateCourse(aiPrompt);
      setCourses((prev: Course[]) => [...prev, newCourse]);
      setAiPrompt("");
      setIsAIModalOpen(false);
      alert("Course generated successfully with AI!");
    } catch (err) {
      console.error("AI generation failed", err);
      alert("Failed to generate course with AI. Check backend logs and AI provider status.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (e: React.MouseEvent, courseId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = await cmsApi.exportCourse(courseId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `course_${title.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export course");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const newCourse = await cmsApi.importCourse(json);
        setCourses((prev: Course[]) => [...prev, newCourse]);
        alert("Course imported successfully!");
      } catch (err) {
        console.error("Import failed", err);
        alert("Failed to import course. Ensure the file is a valid OpenCCB course export.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">
              {t('nav.courses')}
            </h1>
            <p className="text-gray-400 mt-2">{t('dashboard.title')}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all cursor-pointer active:scale-95">
              <Upload size={18} />
              Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 group"
            >
              <Sparkles size={18} className="text-amber-300 group-hover:rotate-12 transition-transform" />
              AI Wizard
            </button>
            <button
              onClick={handleCreateCourse}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all active:scale-95"
            >
              <Plus size={20} />
              Manual
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 glass-card animate-pulse bg-white/5 border-white/5"></div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 glass-card border-dashed border-white/10">
            <p className="text-gray-500">You haven&apos;t created any courses yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course: Course) => (
              <Link href={`/courses/${course.id}`} key={course.id}>
                <div className="glass-card h-full flex flex-col group hover:border-blue-500/50 transition-all">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <BookOpen className="text-blue-400" />
                      </div>
                      <button
                        onClick={(e) => handleExport(e, course.id, course.title)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all"
                        title="Export Course"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-blue-400 transition-colors">{course.title}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{course.description || "No description provided."}</p>
                  </div>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5 text-xs text-gray-500">
                    <span>Last updated: {new Date(course.updated_at).toLocaleDateString()}</span>
                    <span>ID: {course.id.slice(0, 4)}...</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Course Title Modal */}
      <Modal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        title="Create New Course"
      >
        <form onSubmit={onTitleConfirm} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Course Title
            </label>
            <input
              autoFocus
              required
              type="text"
              value={newCourseTitle}
              onChange={(e) => setNewCourseTitle(e.target.value)}
              placeholder="e.g. Advanced Rust Development"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsTitleModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 font-bold text-sm"
            >
              Next
            </button>
          </div>
        </form>
      </Modal>

      {/* AI Wizard Modal */}
      <Modal
        isOpen={isAIModalOpen}
        onClose={() => !isGenerating && setIsAIModalOpen(false)}
        title="AI Course Wizard"
      >
        <form onSubmit={handleAIGenerate} className="space-y-6">
          <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 mb-2">
            <p className="text-xs text-indigo-300 leading-relaxed font-medium">
              Describe the course topic and target audience. Our AI will structure the modules and lessons for you in seconds.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Course Topic or Description
            </label>
            <textarea
              autoFocus
              required
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. A comprehensive guide to building distributed systems with Rust and Axum for intermediate developers."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-white resize-none"
              disabled={isGenerating}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAIModalOpen(false)}
              disabled={isGenerating}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="flex-[2] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg shadow-indigo-500/20 font-bold text-sm flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  Magic Create
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Organization Selector Modal */}
      <OrganizationSelector
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        organizations={organizations}
        title="Target Organization"
        actionLabel="Create Course"
        onConfirm={(orgId) => createCourse(orgId)}
      />
    </div>
  );
}