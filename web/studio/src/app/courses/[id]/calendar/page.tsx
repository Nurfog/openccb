"use client";

import { useEffect, useState } from "react";
import { cmsApi, Course, Lesson } from "@/lib/api";
import Link from "next/link";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Layout,
    CheckCircle2,
    BarChart2,
    Settings,
    AlertCircle
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function CourseCalendarPage({ params }: { params: { id: string } }) {
    const [course, setCourse] = useState<Course | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const loadData = async () => {
            try {
                const courseData = await cmsApi.getCourseWithFullOutline(params.id);
                setCourse(courseData);

                // Flatten lessons from modules
                const allLessons: Lesson[] = [];
                courseData.modules?.forEach(mod => {
                    mod.lessons.forEach(lesson => {
                        allLessons.push(lesson);
                    });
                });
                setLessons(allLessons);
            } catch (err) {
                console.error("Failed to load course data", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [params.id]);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Padding for first week
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 border border-white/5 bg-white/2"></div>);
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayLessons = lessons.filter(l => l.due_date && l.due_date.startsWith(dateStr));

            days.push(
                <div key={day} className="h-32 border border-white/5 p-2 relative hover:bg-white/5 transition-colors group">
                    <span className="text-sm font-bold text-gray-400">{day}</span>
                    <div className="mt-1 space-y-1 overflow-y-auto max-h-24">
                        {dayLessons.map(lesson => (
                            <div
                                key={lesson.id}
                                className={`text-[10px] p-1 rounded truncate flex items-center gap-1 ${lesson.important_date_type === 'exam' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                    lesson.important_date_type === 'assignment' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                        lesson.important_date_type === 'live-session' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                            'bg-green-500/20 text-green-400 border border-green-500/30'
                                    }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                {lesson.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return days;
    };

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));

    if (loading) return <div className="py-20 text-center">Loading calendar...</div>;

    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4 text-sm text-gray-400">
                <Link href="/" className="hover:text-white transition-colors">Courses</Link>
                <span>/</span>
                <span className="text-white">{course?.title}</span>
            </div>

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold">{course?.title}</h2>
                    <div className="flex items-center gap-3 mt-1 text-gray-400 text-sm">
                        <CalendarIcon className="w-4 h-4" />
                        <span>Course Calendar</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link href={`/courses/${params.id}`} className="px-4 py-2 glass hover:bg-white/10 transition-colors text-sm font-medium">
                        Back to Outline
                    </Link>
                </div>
            </div>

            <CourseEditorLayout activeTab="calendar">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-6">
                            <h3 className="text-2xl font-black uppercase tracking-tight">{monthName} <span className="text-blue-500">{year}</span></h3>
                            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 border border-white/10">
                                <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold uppercase tracking-widest hover:text-blue-400 transition-colors">Today</button>
                                <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span> Exam
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Assignment
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Live
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Lesson
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 border-t border-l border-white/5 rounded-xl overflow-hidden shadow-2xl overflow-hidden">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="bg-white/5 py-4 text-center text-xs font-black uppercase tracking-widest text-gray-500 border-r border-b border-white/5">
                                {day}
                            </div>
                        ))}
                        {renderCalendar()}
                    </div>

                    <div className="mt-12 space-y-4">
                        <h4 className="text-lg font-bold flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-blue-500" />
                            Upcoming Deadlines
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {lessons
                                .filter(l => l.due_date && new Date(l.due_date) >= new Date())
                                .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                                .slice(0, 6)
                                .map(lesson => (
                                    <div key={lesson.id} className="glass p-4 border-white/5 hover:border-blue-500/30 transition-all group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${lesson.important_date_type === 'exam' ? 'text-red-400' :
                                                    lesson.important_date_type === 'assignment' ? 'text-blue-400' :
                                                        'text-green-400'
                                                    }`}>
                                                    {lesson.important_date_type || 'Activity'}
                                                </div>
                                                <h5 className="font-bold group-hover:text-blue-400 transition-colors">{lesson.title}</h5>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-black">{new Date(lesson.due_date!).toLocaleDateString()}</div>
                                                <div className="text-[10px] text-gray-500 uppercase font-bold">Due Date</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </CourseEditorLayout>
        </div>
    );
}
