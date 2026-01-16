"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course, Organization } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Plus, BookOpen } from "lucide-react";
import OrganizationSelector from "@/components/OrganizationSelector";
import Modal from "@/components/Modal";

export default function StudioDashboard() {
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
  const [newCourseTitle, setNewCourseTitle] = useState("");

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

  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">
              My Courses
            </h1>
            <p className="text-gray-400 mt-2">Manage and monitor your educational content</p>
          </div>
          <button
            onClick={handleCreateCourse}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus size={20} />
            New Course
          </button>
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
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                      <BookOpen className="text-blue-400" />
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