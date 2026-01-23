"use client";

import { useEffect, useState } from "react";
import { lmsApi, Course, Lesson } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Rocket, CheckCircle2, ArrowRight, Star, Calendar, Clock, AlertCircle, Zap, TrendingUp } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";

export default function CatalogPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [gamification, setGamification] = useState<{ points: number, level: number, badges: any[] } | null>(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<{ lesson: Lesson, courseTitle: string, courseId: string }[]>([]);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const coursesData = await lmsApi.getCatalog(user?.organization_id, user?.id);
        setCourses(coursesData);

        if (user) {
          const enrollmentData = await lmsApi.getEnrollments(user.id);
          setEnrollments(enrollmentData.map(e => e.course_id));

          const gamificationData = await lmsApi.getGamification(user.id);
          setGamification(gamificationData);

          // Fetch deadlines for enrolled courses
          const deadlines: { lesson: Lesson, courseTitle: string, courseId: string }[] = [];
          for (const enrollment of enrollmentData) {
            try {
              const { course, modules } = await lmsApi.getCourseOutline(enrollment.course_id);
              modules.forEach(mod => {
                mod.lessons.forEach(l => {
                  if (l.due_date && new Date(l.due_date) >= new Date()) {
                    deadlines.push({ lesson: l, courseTitle: course.title, courseId: enrollment.course_id });
                  }
                });
              });
            } catch (err) {
              console.error(`No se pudo cargar el esquema del curso ${enrollment.course_id}`, err);
            }
          }
          setUpcomingDeadlines(deadlines.sort((a, b) => new Date(a.lesson.due_date!).getTime() - new Date(b.lesson.due_date!).getTime()).slice(0, 3));
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
      console.error("Falló la inscripción", err);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-20">
      <div className="mb-12 md:mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8 text-center md:text-left">
        <div className="space-y-4">
          <div className="flex items-center justify-center md:justify-start gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">
            <Star size={14} className="fill-blue-500" />
            <span>Currículo Premier</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight md:leading-none">
            Explorar <span className="block sm:inline text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">Cursos</span>
          </h1>
          <p className="text-gray-500 font-medium max-w-xl text-base md:text-lg mx-auto md:mx-0">
            Domina las habilidades del futuro con nuestro contenido educativo de alta fidelidad.
          </p>
        </div>
        {!user && (
          <Link href="/auth/register" className="btn-premium !bg-white !text-black shadow-none !px-8 w-full sm:w-auto">
            Comienza Gratis
          </Link>
        )}
      </div>

      {user && gamification && (
        <div className="mb-16 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-10 bg-gradient-to-br from-blue-600/20 via-indigo-700/10 to-transparent border-blue-500/20 rounded-3xl relative overflow-hidden group">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-10">
                <div className="flex-shrink-0 relative">
                  <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <Zap className="text-white fill-white/20" size={48} />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-black text-xs border-4 border-[#050505]">
                    {gamification.level}
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-1">Posición Actual</div>
                    <h2 className="text-3xl font-black text-white">Nivel {gamification.level} Pionero</h2>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {gamification.points} / {Math.pow(gamification.level, 2) * 100} XP
                      </div>
                      <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                        {Math.floor(((gamification.points - Math.pow(gamification.level - 1, 2) * 100) / (Math.pow(gamification.level, 2) * 100 - Math.pow(gamification.level - 1, 2) * 100)) * 100)}% para el Nivel {gamification.level + 1}
                      </div>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-1000"
                        style={{ width: `${Math.min(100, Math.max(0, ((gamification.points - Math.pow(gamification.level - 1, 2) * 100) / (Math.pow(gamification.level, 2) * 100 - Math.pow(gamification.level - 1, 2) * 100)) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Flair */}
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-500"></div>
            </div>

            <div className="glass-card p-8 bg-white/[0.01] border-white/5 rounded-3xl">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                <CheckCircle2 size={14} /> Mis Insignias
              </h3>
              <div className="flex flex-wrap gap-4">
                {gamification.badges.length === 0 ? (
                  <p className="text-sm text-gray-600 italic">Aún no has ganado insignias. ¡Comienza a aprender para desbloquear logros!</p>
                ) : (
                  gamification.badges.map(badge => (
                    <div key={badge.id} className="group/badge relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg transition-all hover:scale-110 hover:bg-amber-500/20 cursor-help" title={badge.description}>
                        <span className="text-2xl">🏆</span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[#050505] flex items-center justify-center text-[8px] font-bold">✓</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <Leaderboard />
          </div>
        </div>
      )}

      {user && upcomingDeadlines.length > 0 && (
        <div className="mb-16 animate-in fade-in slide-in-from-top-4 duration-700 delay-200">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-6 flex items-center gap-2">
            <Calendar size={14} /> Próximos Vencimientos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingDeadlines.map(({ lesson, courseTitle, courseId }) => (
              <Link key={lesson.id} href={`/courses/${courseId}/lessons/${lesson.id}`} className="block group">
                <div className="glass-card p-6 border-blue-500/10 bg-blue-500/2 rounded-3xl hover:border-blue-500/30 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 group-hover:text-blue-300 transition-colors">
                      {lesson.important_date_type || 'Actividad'}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-white">{new Date(lesson.due_date!).toLocaleDateString()}</div>
                      <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Vencimiento</div>
                    </div>
                  </div>
                  <h4 className="font-bold text-sm text-gray-200 mb-1 group-hover:text-white transition-colors line-clamp-1">{lesson.title}</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{courseTitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="py-20 text-center glass-card border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <p className="text-gray-500 font-bold uppercase tracking-widest">Aún no se han publicado cursos.</p>
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
                      Inscrito
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black text-white mb-4 leading-tight group-hover:text-blue-400 transition-colors">
                  {course.title}
                </h2>

                <div className="flex-1">
                  <p className="text-gray-500 text-sm font-medium line-clamp-3 mb-10 leading-relaxed">
                    {course.description || "Currículo detallado que cubre desde los principios fundamentales hasta el dominio avanzado, elaborado por veteranos de la industria."}
                  </p>
                </div>

                <div className="pt-8 border-t border-white/5 flex items-center justify-between mt-auto">
                  {isEnrolled ? (
                    <Link href={`/courses/${course.id}`} className="btn-premium w-full !bg-blue-600/10 !text-blue-400 border border-blue-500/20 hover:!bg-blue-600/20 !shadow-none gap-2">
                      Continuar Aprendiendo <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      className="btn-premium w-full group-hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 group/btn"
                    >
                      <CheckCircle2 size={18} className="text-white/50 group-hover/btn:text-white transition-colors" />
                      Inscribirse Gratis
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
