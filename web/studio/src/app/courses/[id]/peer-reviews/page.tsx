"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cmsApi, lmsApi, Course, Lesson, SubmissionWithReviews, PeerReview } from "@/lib/api";
import {
    Users,
    MessageSquare,
    Search,
    ArrowLeft,
    Loader2,
    CheckCircle,
    Clock,
    ChevronRight,
    Award
} from "lucide-react";
import CourseEditorLayout from "@/components/CourseEditorLayout";

export default function PeerReviewDashboard() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<SubmissionWithReviews[]>([]);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [reviews, setReviews] = useState<PeerReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const courseData = await cmsApi.getCourseWithFullOutline(id);
                setCourse(courseData);

                const peerReviewLessons: Lesson[] = [];
                courseData.modules?.forEach(m => {
                    m.lessons.forEach(l => {
                        const hasPeerReview = l.metadata?.blocks?.some((b: any) => b.type === 'peer-review');
                        if (hasPeerReview) {
                            peerReviewLessons.push(l);
                        }
                    });
                });
                setLessons(peerReviewLessons);

                if (peerReviewLessons.length > 0) {
                    setSelectedLessonId(peerReviewLessons[0].id);
                }
            } catch (error) {
                console.error("Error loading course data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id]);

    useEffect(() => {
        if (!selectedLessonId) return;

        const loadSubmissions = async () => {
            try {
                setSubmissionsLoading(true);
                const data = await lmsApi.listLessonSubmissions(id, selectedLessonId);
                setSubmissions(data);
            } catch (error) {
                console.error("Error loading submissions:", error);
            } finally {
                setSubmissionsLoading(false);
            }
        };
        loadSubmissions();
    }, [id, selectedLessonId]);

    useEffect(() => {
        if (!selectedSubmissionId) {
            setReviews([]);
            return;
        }

        const loadReviews = async () => {
            try {
                setReviewsLoading(true);
                const data = await lmsApi.getSubmissionReviews(selectedSubmissionId);
                setReviews(data);
            } catch (error) {
                console.error("Error loading reviews:", error);
            } finally {
                setReviewsLoading(false);
            }
        };
        loadReviews();
    }, [selectedSubmissionId]);

    const filteredSubmissions = submissions.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                Peer Review Management
                            </h1>
                            <p className="text-gray-400 mt-1">Monitor and manage student peer assessments</p>
                        </div>
                    </div>
                </div>

                <CourseEditorLayout activeTab="peer-reviews">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Lessons List */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2">Activities</h3>
                            <div className="space-y-2">
                                {lessons.length === 0 ? (
                                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-500 italic">
                                        No peer review activities found in this course.
                                    </div>
                                ) : (
                                    lessons.map(lesson => (
                                        <button
                                            key={lesson.id}
                                            onClick={() => {
                                                setSelectedLessonId(lesson.id);
                                                setSelectedSubmissionId(null);
                                            }}
                                            className={`w-full text-left p-4 rounded-xl border transition-all ${selectedLessonId === lesson.id
                                                    ? "bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-lg shadow-purple-500/5"
                                                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                                                }`}
                                        >
                                            <div className="font-bold truncate">{lesson.title}</div>
                                            <div className="text-[10px] uppercase font-black tracking-tighter opacity-70 mt-1">Peer Assessment</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Submissions List */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="glass p-6 border-white/10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <Users className="text-blue-400" />
                                        Submissions
                                    </h2>
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                                        />
                                    </div>
                                </div>

                                {submissionsLoading ? (
                                    <div className="flex justify-center py-20">
                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    </div>
                                ) : filteredSubmissions.length === 0 ? (
                                    <div className="text-center py-20 bg-black/20 rounded-2xl border border-dashed border-white/10">
                                        <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                        <p className="text-gray-500 italic">No submissions found for this activity.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                        {filteredSubmissions.map(sub => (
                                            <div key={sub.id} className="group">
                                                <div
                                                    onClick={() => setSelectedSubmissionId(selectedSubmissionId === sub.id ? null : sub.id)}
                                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedSubmissionId === sub.id
                                                            ? "bg-blue-500/5 border-blue-500/30"
                                                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/20"
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm">
                                                                {sub.full_name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{sub.full_name}</div>
                                                                <div className="text-xs text-gray-500">{sub.email}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-8">
                                                            <div className="text-right">
                                                                <div className="text-sm font-black text-white flex items-center gap-1.5 justify-end">
                                                                    <Award className="w-4 h-4 text-yellow-400" />
                                                                    {sub.average_score !== null ? `${(sub.average_score).toFixed(1)}/10` : '—'}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Avg. Score</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`text-sm font-black flex items-center gap-1.5 justify-end ${sub.review_count >= 2 ? 'text-green-400' : 'text-orange-400'}`}>
                                                                    <CheckCircle className="w-4 h-4" />
                                                                    {sub.review_count}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Reviews</div>
                                                            </div>
                                                            <div className="text-right hidden md:block">
                                                                <div className="text-sm font-medium text-gray-400 flex items-center gap-1.5 justify-end">
                                                                    <Clock className="w-4 h-4" />
                                                                    {new Date(sub.submitted_at).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Submitted</div>
                                                            </div>
                                                            <ChevronRight className={`w-5 h-5 text-gray-600 transition-transform ${selectedSubmissionId === sub.id ? 'rotate-90' : ''}`} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Reviews Detail Drawer-like expansion */}
                                                {selectedSubmissionId === sub.id && (
                                                    <div className="mt-2 ml-4 p-6 bg-black/40 border-l-2 border-blue-500/50 rounded-r-xl space-y-4 animate-in slide-in-from-left-2 duration-200">
                                                        <h4 className="text-sm font-bold uppercase tracking-widest text-blue-400">Review Details</h4>
                                                        {reviewsLoading ? (
                                                            <div className="flex py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                                                        ) : reviews.length === 0 ? (
                                                            <p className="text-sm text-gray-500 italic">No reviews received yet.</p>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {reviews.map(review => (
                                                                    <div key={review.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-xs font-bold text-gray-400">Review Task</span>
                                                                            <span className="text-sm font-black text-yellow-500">{review.score}/10</span>
                                                                        </div>
                                                                        <p className="text-sm text-gray-300 leading-relaxed italic">"{review.feedback}"</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CourseEditorLayout>
            </div>
        </div>
    );
}
