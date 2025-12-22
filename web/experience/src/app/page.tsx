"use client";

import { useEffect, useState } from "react";
import { lmsApi, Course } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Rocket, CheckCircle2, ArrowRight, Star } from "lucide-react";

export default function CatalogPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const coursesData = await lmsApi.getCatalog();
        setCourses(coursesData);

        if (user) {
          const enrollmentData = await lmsApi.getEnrollments(user.id);
          setEnrollments(enrollmentData.map(e => e.course_id));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    try {
      await lmsApi.enroll(courseId, user.id);
      setEnrollments(prev => [...prev, courseId]);
    } catch (err) {
      console.error("Enrollment failed", err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 glass-card animate-pulse bg-white/5 border-white/5 rounded-3xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-20">
      <div className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">
            <Star size={14} className="fill-blue-500" />
            <span>Premier Curriculum</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter leading-none">
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">Courses</span>
          </h1>
          <p className="text-gray-500 font-medium max-w-xl text-lg">
            Master the skills of the future with our high-fidelity educational content.
          </p>
        </div>
        {!user && (
          <Link href="/auth/register" className="btn-premium !bg-white !text-black shadow-none !px-8">
            Get Started Free
          </Link>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="py-20 text-center glass-card border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <p className="text-gray-500 font-bold uppercase tracking-widest">No courses published yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course) => {
            const isEnrolled = enrollments.includes(course.id);

            return (
              <div key={course.id} className="glass-card group relative overflow-hidden h-full flex flex-col p-8 border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500 rounded-3xl">
                <div className="mb-8 flex items-start justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                    <Rocket size={24} className="text-white fill-white/10" />
                  </div>
                  {isEnrolled && (
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      Enrolled
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black text-white mb-4 leading-tight group-hover:text-blue-400 transition-colors">
                  {course.title}
                </h2>

                <div className="flex-1">
                  <p className="text-gray-500 text-sm font-medium line-clamp-3 mb-10 leading-relaxed">
                    {course.description || "In-depth curriculum covering foundational principles to advanced mastery, crafted by industry veterans."}
                  </p>
                </div>

                <div className="pt-8 border-t border-white/5 flex items-center justify-between mt-auto">
                  {isEnrolled ? (
                    <Link href={`/courses/${course.id}`} className="btn-premium w-full !bg-blue-600/10 !text-blue-400 border border-blue-500/20 hover:!bg-blue-600/20 !shadow-none gap-2">
                      Continue Learning <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      className="btn-premium w-full group-hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 group/btn"
                    >
                      <CheckCircle2 size={18} className="text-white/50 group-hover/btn:text-white transition-colors" />
                      Enroll for Free
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
