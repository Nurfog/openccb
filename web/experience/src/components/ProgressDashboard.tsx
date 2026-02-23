"use client";

import React, { useEffect, useState } from 'react';
import { lmsApi, ProgressStats } from '@/lib/api';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { Calendar, CheckCircle2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProgressDashboardProps {
    courseId: string;
}

const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ courseId }) => {
    const [stats, setStats] = useState<ProgressStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await lmsApi.getProgressStats(courseId);
                setStats(data);
            } catch (err) {
                console.error("Error fetching progress stats:", err);
                setError("No se pudieron cargar las estadísticas de progreso.");
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [courseId]);

    if (loading) return <div className="p-8 animate-pulse space-y-4">
        <div className="h-40 bg-white/5 rounded-3xl" />
        <div className="h-64 bg-white/5 rounded-3xl" />
    </div>;

    if (error || !stats) return <div className="p-8 text-center text-red-400">
        <AlertTriangle className="mx-auto mb-2" />
        {error || "Error al cargar datos."}
    </div>;

    const chartData = stats.daily_completions.map(d => ({
        date: format(parseISO(d.date), 'dd MMM', { locale: es }),
        count: d.count
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-3xl border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Progreso Total</span>
                        <TrendingUp size={16} className="text-blue-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{Math.round(stats.progress_percentage)}%</span>
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Completado</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000"
                            style={{ width: `${stats.progress_percentage}%` }}
                        />
                    </div>
                </div>

                <div className="glass p-6 rounded-3xl border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Lecciones</span>
                        <CheckCircle2 size={16} className="text-green-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{stats.completed_lessons}</span>
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">de {stats.total_lessons}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">Lecciones finalizadas con éxito</p>
                </div>

                <div className="glass p-6 rounded-3xl border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Predicción</span>
                        <Clock size={16} className="text-indigo-400" />
                    </div>
                    <div className="space-y-1">
                        <span className="text-sm font-black text-white block">
                            {stats.estimated_completion_date
                                ? format(parseISO(stats.estimated_completion_date), "d 'de' MMMM", { locale: es })
                                : "N/A"
                            }
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Fecha estimada de cierre</span>
                    </div>
                </div>

                <div className="glass p-6 rounded-3xl border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Estado</span>
                        <Calendar size={16} className="text-purple-400" />
                    </div>
                    <div className="space-y-1">
                        <span className="text-sm font-black text-white block uppercase">
                            {stats.progress_percentage >= 80 ? 'Excelente' : stats.progress_percentage >= 50 ? 'Buen Ritmo' : 'En Progreso'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Según tu ritmo actual</span>
                    </div>
                </div>
            </div>

            {/* Activity Chart */}
            <div className="glass p-8 rounded-[2.5rem] border-white/5">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight">Actividad de Aprendizaje</h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Lecciones completadas por día (Últimos 30 días)</p>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 900 }}
                                dy={10}
                            />
                            <YAxis
                                hide={true}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    backdropFilter: 'blur(10px)',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                                itemStyle={{ color: '#3b82f6' }}
                                cursor={{ stroke: 'rgba(59,130,246,0.2)', strokeWidth: 2 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="#3b82f6"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorCount)"
                                animationDuration={2000}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ProgressDashboard;
