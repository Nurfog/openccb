"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Layout, CheckCircle2, Calendar, BarChart2, Settings } from "lucide-react";

interface CourseEditorLayoutProps {
    children: React.ReactNode;
    activeTab: "outline" | "grading" | "calendar" | "analytics" | "settings";
}

export default function CourseEditorLayout({ children, activeTab }: CourseEditorLayoutProps) {
    const { id } = useParams() as { id: string };

    const tabs = [
        { key: "outline", label: "Outline", icon: Layout, href: `/courses/${id}` },
        { key: "grading", label: "Grading", icon: CheckCircle2, href: `/courses/${id}/grading` },
        { key: "calendar", label: "Calendar", icon: Calendar, href: `/courses/${id}/calendar` },
        { key: "analytics", label: "Analytics", icon: BarChart2, href: `/courses/${id}/analytics` },
        { key: "settings", label: "Settings", icon: Settings, href: `/courses/${id}/settings` },
    ];

    return (
        <div className="space-y-8">
            {/* Tabs Navigation */}
            <div className="glass p-1">
                <div className="flex border-b border-white/10">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = tab.key === activeTab;
                        return (
                            <Link
                                key={tab.key}
                                href={tab.href}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${isActive
                                        ? "border-b-2 border-blue-500 bg-white/5"
                                        : "text-gray-500 hover:text-white"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
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
