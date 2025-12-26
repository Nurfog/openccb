"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Plus, BookOpen } from "lucide-react";

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

  const handleCreateCourse = async () => {
    const title = prompt("Enter new course title:");
    if (title) {
      try {
        const newCourse = await cmsApi.createCourse(title);
        setCourses(prev => [...prev, newCourse]);
      } catch (err) {
        alert("Failed to create course. Please ensure the backend is running.");
      }
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Courses</h1>
        <button onClick={handleCreateCourse} className="btn-premium flex items-center gap-2">
          <Plus size={18} />
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
          <p className="text-gray-500">You haven't created any courses yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => (
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
  );
}