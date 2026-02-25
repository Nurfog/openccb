"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Layout, CheckCircle2, Calendar, BarChart2, Settings, Folder, GraduationCap, Megaphone, Users, Award, Video } from "lucide-react";

interface CourseEditorLayoutProps {
    children: React.ReactNode;
    activeTab: "outline" | "grading" | "rubrics" | "calendar" | "analytics" | "settings" | "files" | "grades" | "announcements" | "team" | "peer-reviews" | "students" | "sessions";
}

export default function CourseEditorLayout({ children, activeTab }: CourseEditorLayoutProps) {
    const { id } = useParams() as { id: string };

    const tabs = [
        { key: "outline", label: "Outline", icon: Layout, href: `/courses/${id}` },
        { key: "grading", label: "Grading Policy", icon: CheckCircle2, href: `/courses/${id}/grading` },
        { key: "rubrics", label: "Rubrics", icon: Layout, href: `/courses/${id}/rubrics` },
        { key: "team", label: "Team", icon: GraduationCap, href: `/courses/${id}/team` },
        { key: "students", label: "Students & Groups", icon: Users, href: `/courses/${id}/students` },
        { key: "grades", label: "Gradebook", icon: GraduationCap, href: `/courses/${id}/grades` },
        { key: "peer-reviews", label: "Peer Reviews", icon: Award, href: `/courses/${id}/peer-reviews` },
        { key: "sessions", label: "Live Sessions", icon: Video, href: `/courses/${id}/sessions` },
        { key: "announcements", label: "Announcements", icon: Megaphone, href: `/courses/${id}/announcements` },
        { key: "calendar", label: "Calendar", icon: Calendar, href: `/courses/${id}/calendar` },
        { key: "analytics", label: "Analytics", icon: BarChart2, href: `/courses/${id}/analytics` },
        { key: "files", label: "Files & Uploads", icon: Folder, href: `/courses/${id}/files` },
        { key: "settings", label: "Settings", icon: Settings, href: `/courses/${id}/settings` },
    ];

    return (
        <div className="space-y-8">
            {/* Tabs Navigation */}
            <div className="glass p-1">
                <div className="flex border-b border-white/10 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = tab.key === activeTab;
                        return (
                            <Link
                                key={tab.key}
                                href={tab.href}
                                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${isActive
                                    ? "border-b-2 border-blue-500 bg-white/5 text-white"
                                    : "text-gray-500 hover:text-white"
                                    }`}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {children}
            </div>
        </div>
    );
}
