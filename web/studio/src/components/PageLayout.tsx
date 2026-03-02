"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageLayoutProps {
    /** Título principal de la página */
    title: string;
    /** Descripción/subtítulo opcional */
    description?: string;
    /** Acciones que van a la derecha del título (botones, etc.) */
    actions?: React.ReactNode;
    /** Componente de navegación secundaria (ej: pestañas del editor) */
    navigation?: React.ReactNode;
    /** Link de "volver atrás" — mostrar solo cuando sea necesario */
    backHref?: string;
    backLabel?: string;
    /** Contenido principal de la página */
    children: React.ReactNode;
    /** Ancho máximo del contenedor: 'default' (max-w-7xl) o 'narrow' (max-w-5xl) */
    maxWidth?: "default" | "narrow" | "wide";
}

const MAX_WIDTH_CLASS = {
    default: "max-w-7xl",
    narrow: "max-w-5xl",
    wide: "max-w-screen-2xl",
};

/**
 * Componente de layout estándar para todas las páginas del Studio.
 * Garantiza: mismo padding superior, misma jerarquía tipográfica, mismo max-width.
 */
export default function PageLayout({
    title,
    description,
    actions,
    navigation,
    backHref,
    backLabel = "Volver",
    children,
    maxWidth = "default",
}: PageLayoutProps) {
    const containerClass = MAX_WIDTH_CLASS[maxWidth];

    return (
        <div className="min-h-screen bg-transparent">
            <div className={`${containerClass} mx-auto px-6 pt-10 pb-12`}>

                {/* Back link */}
                {backHref && (
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-100 transition-colors mb-5"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {backLabel}
                    </Link>
                )}

                {/* Page header */}
                <div className="flex items-start justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                            {title}
                        </h1>
                        {description && (
                            <p className="mt-1.5 text-sm text-slate-500 dark:text-gray-400">
                                {description}
                            </p>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-3 shrink-0">
                            {actions}
                        </div>
                    )}
                </div>

                {/* Optional secondary navigation (tabs, breadcrumbs, etc.) */}
                {navigation && (
                    <div className="mb-6">
                        {navigation}
                    </div>
                )}

                {/* Main content */}
                {children}
            </div>
        </div>
    );
}
