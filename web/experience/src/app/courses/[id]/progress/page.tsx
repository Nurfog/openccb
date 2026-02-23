"use client";

import React from 'react';
import ProgressDashboard from '@/components/ProgressDashboard';
import { ChevronLeft, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export default function ProgressPage({ params }: { params: { id: string } }) {
    return (
        <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <Link
                        href={`/courses/${params.id}`}
                        className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest mb-6 hover:text-white transition-colors group"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Volver al curso
                    </Link>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl glass border-blue-500/20 bg-blue-500/10 flex items-center justify-center">
                            <LayoutDashboard size={24} className="text-blue-400" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-white">Tu Progreso de Aprendizaje</h1>
                    </div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Análisis detallado de tu avance y predicción de finalización</p>
                </div>
            </div>

            <ProgressDashboard courseId={params.id} />

            <div className="mt-12 p-8 glass rounded-[2.5rem] border-white/5 bg-blue-500/[0.02]">
                <h3 className="text-lg font-black text-white tracking-tight mb-4">¿Cómo se calcula mi progreso?</h3>
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Completado</span>
                        <p className="text-sm text-gray-400 leading-relaxed">Consideramos una lección como completada cuando has visualizado el contenido o aprobado la evaluación correspondiente.</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Predicción</span>
                        <p className="text-sm text-gray-400 leading-relaxed">Calculamos tu fecha estimada analizando cuántas lecciones completas por día desde que iniciaste el curso.</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Recomendaciones</span>
                        <p className="text-sm text-gray-400 leading-relaxed">Si tu ritmo es bajo, verás sugerencias personalizadas en la página principal para ayudarte a retomar el camino.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
