"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cmsApi, Course } from "@/lib/api";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // Check authentication
    const savedUser = localStorage.getItem("studio_user");
    if (!savedUser) {
      router.push("/auth/login");
      return;
    }

    // The `setUser` function was not defined, causing a linting error.
    // If user data needs to be stored in state, a `useState` for `user` should be added.
    // For now, removing the call to fix the linting error.
    // setUser(JSON.parse(savedUser));

    // Fetch courses
    const loadCourses = async () => {
      try {
        setLoading(true);
        const data = await cmsApi.getCourses();
        setCourses(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch courses:", err);
        setError("Could not connect to CMS service. showing offline mode.");
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [router]);



  const handleCreateCourse = async () => {
    const title = prompt("Enter course title:");
    if (!title) return;

    try {
      const newCourse = await cmsApi.createCourse(title);
      setCourses([...courses, newCourse]);
    } catch {
      alert("Failed to create course. Is the backend running?");
    }
  };

  const placeholderCourses: Course[] = [
    {
      id: "p1",
      title: "Introduction to Rust (Demo)",
      description: "A demo course to get started",
      instructor_id: "demo",
      passing_percentage: 70,
      created_at: new Date().toISOString()
    },
  ];

  const displayCourses = courses.length > 0 ? courses : (loading ? [] : placeholderCourses);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">My Courses</h2>
          <p className="text-gray-400">Manage and create your learning content</p>
        </div>
        <button onClick={handleCreateCourse} className="btn-premium">
          + New Course
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <p>Loading your courses...</p>
          </div>
        ) : (
          <>
            {displayCourses.map((course) => (
              <Link href={`/courses/${course.id}`} key={course.id}>
                <div className="glass p-6 hover:border-blue-500/50 transition-all group cursor-pointer h-full">
                  <div className="h-32 bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-lg mb-4 flex items-center justify-center border border-white/5">
                    <span className="text-4xl group-hover:scale-110 transition-transform">📚</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-400">{course.title}</h3>
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <span suppressHydrationWarning className="text-xs text-gray-500">
                      Created {mounted ? new Date(course.created_at).toLocaleDateString() : "---"}
                    </span>
                    <span className="text-xs font-medium text-blue-400">View Details →</span>
                  </div>
                </div>
              </Link>
            ))}

            <div
              onClick={handleCreateCourse}
              className="glass p-6 border-dashed border-2 border-white/10 flex flex-col items-center justify-center text-gray-500 hover:border-white/20 transition-all cursor-pointer min-h-[300px]"
            >
              <span className="text-3xl mb-2">➕</span>
              <span className="text-sm">Add New Course</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
