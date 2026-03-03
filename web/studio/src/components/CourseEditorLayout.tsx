"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    Layout, CheckCircle2, BarChart2, Settings, Folder,
    GraduationCap, Megaphone, Users, Award, Video,
    BookOpen, ShieldCheck, Radio, TrendingUp, ChevronLeft
} from "lucide-react";
import { cmsApi, Course } from "@/lib/api";

type TabKey =
    | "outline"
    | "grading"
    | "rubrics"
    | "calendar"
    | "analytics"
    | "settings"
    | "files"
    | "grades"
    | "announcements"
    | "team"
    | "peer-reviews"
    | "students"
    | "sessions";

interface CourseEditorLayoutProps {
    children: React.ReactNode;
    activeTab: TabKey;
    /** Título de la sección específica (ej: "Grading Policy"). Si se omite, usa el nombre del curso. */
    pageTitle?: string;
    /** Descripción de la sección específica. */
    pageDescription?: string;
    /** Acciones extra que van a la derecha del header (Preview, Publish, etc.) */
    pageActions?: React.ReactNode;
}

interface Tab {
    key: TabKey;
    label: string;
    icon: React.ElementType;
    href: string;
}

interface Group {
    key: string;
    label: string;
    icon: React.ElementType;
    tabs: Tab[];
}

export default function CourseEditorLayout({
    children,
    activeTab,
    pageTitle,
    pageDescription,
    pageActions,
}: CourseEditorLayoutProps) {
    const params = useParams() as { id: string };
    const id = params.id;
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);

    useEffect(() => {
        cmsApi.getCourse(id).then(setCourse).catch(console.error);
    }, [id]);

    const groups: Group[] = [
        {
            key: "content",
            label: "Contenido",
            icon: BookOpen,
            tabs: [
                { key: "outline", label: "Outline", icon: Layout, href: `/courses/${id}` },
                { key: "files", label: "Archivos", icon: Folder, href: `/courses/${id}/files` },
                { key: "sessions", label: "Sesiones en Vivo", icon: Video, href: `/courses/${id}/sessions` },
            ],
        },
        {
            key: "assessment",
            label: "Evaluación",
            icon: CheckCircle2,
            tabs: [
                { key: "grading", label: "Política de Notas", icon: CheckCircle2, href: `/courses/${id}/grading` },
                { key: "rubrics", label: "Rúbricas", icon: Award, href: `/courses/${id}/rubrics` },
                { key: "grades", label: "Libro de Notas", icon: GraduationCap, href: `/courses/${id}/grades` },
                { key: "peer-reviews", label: "Revisión entre Pares", icon: ShieldCheck, href: `/courses/${id}/peer-reviews` },
            ],
        },
        {
            key: "people",
            label: "Personas",
            icon: Users,
            tabs: [
                { key: "team", label: "Equipo", icon: Users, href: `/courses/${id}/team` },
                { key: "students", label: "Estudiantes y Grupos", icon: GraduationCap, href: `/courses/${id}/students` },
            ],
        },
        {
            key: "communication",
            label: "Comunicación",
            icon: Radio,
            tabs: [
                { key: "announcements", label: "Anuncios", icon: Megaphone, href: `/courses/${id}/announcements` },
                { key: "calendar", label: "Calendario", icon: Radio, href: `/courses/${id}/calendar` },
            ],
        },
        {
            key: "admin",
            label: "Administración",
            icon: TrendingUp,
            tabs: [
                { key: "analytics", label: "Analíticas", icon: BarChart2, href: `/courses/${id}/analytics` },
                { key: "settings", label: "Configuración", icon: Settings, href: `/courses/${id}/settings` },
            ],
        },
    ];

    // Find which group contains the active tab
    const activeGroup = groups.find((g) => g.tabs.some((t) => t.key === activeTab));
    const subTabs = activeGroup?.tabs ?? [];

    // Determine header text
    const displayTitle = pageTitle || "Course Editor";
    const displayDescription = pageDescription
        || (course ? `${course.title}` : "Cargando curso...");

    return (
        <div className="min-h-screen bg-transparent">
            <div className="max-w-7xl mx-auto px-6 pt-8 pb-12">

                {/* ── PAGE HEADER ── */}
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/")}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-gray-200"
                            aria-label="Volver al inicio"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="heading-premium">
                                {displayTitle}
                            </h1>
                            <p className="text-description-premium mt-1.5 flex items-center gap-2">
                                {displayDescription}
                                {course?.pacing_mode && (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${course.pacing_mode === "instructor_led"
                                        ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400"
                                        : "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                                        }`}>
                                        {course.pacing_mode.replace("_", " ").toUpperCase()}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    {pageActions && (
                        <div className="flex items-center gap-3 shrink-0">
                            {pageActions}
                        </div>
                    )}
                </div>

                {/* ── TAB NAVIGATION ── */}
                <nav
                    className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden mb-6 shadow-sm"
                    aria-label="Grupos del editor de cursos"
                >
                    <ul className="flex border-b border-slate-200 dark:border-white/10">
                        {groups.map((group) => {
                            const Icon = group.icon;
                            const isGroupActive = group.key === activeGroup?.key;
                            const groupHref = group.tabs[0].href;
                            return (
                                <li key={group.key} className="flex-shrink-0">
                                    <Link
                                        href={groupHref}
                                        className={`flex items-center gap-2 px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${isGroupActive
                                            ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10"
                                            : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-100 hover:bg-slate-50 dark:hover:bg-white/5"
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                                        {group.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>

                    {/* SECONDARY SUB-TAB NAV */}
                    {subTabs.length > 1 && (
                        <ul
                            className="flex bg-slate-50 dark:bg-white/[0.03] px-2 gap-1"
                            aria-label="Sub-secciones"
                        >
                            {subTabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = tab.key === activeTab;
                                return (
                                    <li key={tab.key} className="flex-shrink-0">
                                        <Link
                                            href={tab.href}
                                            aria-current={isActive ? "page" : undefined}
                                            className={`flex items-center gap-1.5 px-4 py-2 my-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${isActive
                                                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                                                : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-100 hover:bg-slate-200/50 dark:hover:bg-white/5"
                                                }`}
                                        >
                                            <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                            {tab.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </nav>

                {/* ── PAGE CONTENT ── */}
                <div className="space-y-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
