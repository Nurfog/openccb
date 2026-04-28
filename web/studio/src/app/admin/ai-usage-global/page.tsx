'use client';

import React, { useState, useEffect } from 'react';
import { cmsApi } from '@/lib/api';
import { 
    ShieldCheck, 
    TrendingUp, 
    DollarSign, 
    Users, 
    Activity, 
    PieChart, 
    BarChart3, 
    MessageCircle,
    GraduationCap,
    Building2,
    ArrowUpRight,
    Save
} from 'lucide-react';

interface DailyUsage {
    date: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
}

interface UsageByEndpoint {
    endpoint: string;
    request_type: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
}

interface UsageByOrganization {
    org_id: string;
    org_name: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
    active_users: number;
}

interface UsageByRequestType {
    request_type: string;
    total_tokens: number;
    cost_usd: number;
    requests: number;
}

interface TopUserUsage {
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    org_name: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    requests: number;
}

interface StudentChatUsage {
    user_id: string;
    email: string;
    full_name: string;
    org_name: string;
    total_tokens: number;
    cost_usd: number;
    chat_requests: number;
    last_chat: string;
}

interface GlobalAiSummary {
    total_tokens: number;
    total_input: number;
    total_output: number;
    total_requests: number;
    total_cost_usd: number;
    savings_vs_openai_usd: number;
    savings_percentage: number;
    openai_equivalent_cost_usd: number;
    total_organizations: number;
    total_active_users: number;
}

interface StudentChatSummary {
    total_tokens: number;
    total_requests: number;
    total_cost_usd: number;
    active_students: number;
}

interface GlobalAiUsageResponse {
    summary: GlobalAiSummary;
    student_chat_summary: StudentChatSummary | null;
    daily_usage: DailyUsage[];
    by_endpoint: UsageByEndpoint[];
    by_organization: UsageByOrganization[];
    by_request_type: UsageByRequestType[];
    top_users: TopUserUsage[];
    student_chat_usage: StudentChatUsage[];
}

export default function GlobalAiControl() {
    const [data, setData] = useState<GlobalAiUsageResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        loadGlobalUsage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange]);

    const loadGlobalUsage = async () => {
        try {
            const endDate = new Date();
            const startDate = new Date();
            
            if (dateRange === '7d') {
                startDate.setDate(startDate.getDate() - 7);
            } else if (dateRange === '30d') {
                startDate.setDate(startDate.getDate() - 30);
            } else {
                startDate.setDate(startDate.getDate() - 90);
            }

            const token = localStorage.getItem('studio_token');
            
            if (!token) {
                console.error('No token found. Please login again.');
                setAuthError(true);
                setLoading(false);
                return;
            }

            const jsonData = await cmsApi.getGlobalAiUsage(
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );
            
            setData(jsonData);
            setAuthError(false);
        } catch (error) {
            console.error('Failed to load global AI usage:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                setAuthError(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en-US').format(num);
    };

    const formatCurrency = (num: number) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        }).format(num);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short'
        });
    };

    // Calculate max value for chart scaling
    const maxDailyTokens = data?.daily_usage.reduce((max, d) => Math.max(max, d.total_tokens), 0) || 1;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando métricas globales...</p>
                </div>
            </div>
        );
    }

    if (authError) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">
                            Error de Autenticación
                        </h3>
                        <p className="text-red-600 dark:text-red-300 text-sm mb-4">
                            No se pudo cargar los datos. Esto puede deberse a:
                        </p>
                        <ul className="text-red-600 dark:text-red-300 text-sm text-left list-disc list-inside space-y-1">
                            <li>Tu sesión ha expirado</li>
                            <li>No has iniciado sesión</li>
                            <li>El token no es válido</li>
                        </ul>
                    </div>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => {
                                setAuthError(false);
                                loadGlobalUsage();
                            }}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                        >
                            Reintentar
                        </button>
                        <a
                            href="/auth/login"
                            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Iniciar Sesión
                        </a>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                        Token en localStorage: {localStorage.getItem('studio_token') ? '✓ Existe' : '✗ No existe'}
                    </p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center text-red-600">
                    <p>Error al cargar los datos. Por favor, recarga la página.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-800 dark:to-purple-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-10 h-10 text-white" />
                            <div>
                                <h1 className="text-3xl font-bold text-white">
                                    Control Global - Uso de IA
                                </h1>
                                <p className="text-indigo-100 text-sm mt-1">
                                    Monitoreo integral de tokens, costos y ahorro en todo el sistema
                                </p>
                            </div>
                        </div>
                        
                        {/* Date Range Selector */}
                        <div className="flex gap-2">
                            {(['7d', '30d', '90d'] as const).map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        dateRange === range
                                            ? 'bg-white text-indigo-600'
                                            : 'bg-indigo-500/50 text-white hover:bg-indigo-500'
                                    }`}
                                >
                                    {range === '7d' ? 'Últimos 7 días' : range === '30d' ? 'Últimos 30 días' : 'Últimos 90 días'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Tokens */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Activity className="w-6 h-6 text-blue-600" />
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatNumber(data.summary.total_tokens)}
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                            Input: {formatNumber(data.summary.total_input)} | Output: {formatNumber(data.summary.total_output)}
                        </div>
                    </div>

                    {/* Costo Total */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-green-600" />
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Costo Total (IA Local)</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatCurrency(data.summary.total_cost_usd)}
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                            Requests: {formatNumber(data.summary.total_requests)}
                        </div>
                    </div>

                    {/* Ahorro vs OpenAI */}
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                <Save className="w-6 h-6 text-emerald-600" />
                            </div>
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Ahorro vs OpenAI GPT-4</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                            {formatCurrency(data.summary.savings_vs_openai_usd)}
                        </p>
                        <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {data.summary.savings_percentage.toFixed(1)}% más económico
                        </div>
                    </div>

                    {/* Usuarios Activos */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <Users className="w-6 h-6 text-purple-600" />
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Usuarios Activos</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {data.summary.total_active_users}
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                            Organizaciones: {data.summary.total_organizations}
                        </div>
                    </div>
                </div>

                {/* Student Chat Summary */}
                {data.student_chat_summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <MessageCircle className="w-6 h-6 text-blue-600" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Uso del Chat por Alumnos
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Tokens Consumidos</p>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                    {formatNumber(data.student_chat_summary.total_tokens)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Requests de Chat</p>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                    {formatNumber(data.student_chat_summary.total_requests)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Costo Total</p>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                    {formatCurrency(data.student_chat_summary.total_cost_usd)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Alumnos Activos</p>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                    {data.student_chat_summary.active_students}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Daily Usage Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Uso Diario de Tokens</h3>
                        </div>
                        <div className="h-64 flex items-end gap-1 overflow-x-auto">
                            {data.daily_usage.slice(-30).map((day, idx) => (
                                <div key={idx} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
                                    <div 
                                        className="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t transition-all hover:from-indigo-400 hover:to-purple-400"
                                        style={{ 
                                            height: `${Math.max((day.total_tokens / maxDailyTokens) * 200, 4)}px`,
                                            minHeight: '4px'
                                        }}
                                        title={`${formatNumber(day.total_tokens)} tokens - ${formatCurrency(day.cost_usd)}`}
                                    />
                                    <span className="text-[10px] text-gray-500 rotate-45 origin-top-left translate-y-2">
                                        {formatDate(day.date)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Usage by Request Type */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <PieChart className="w-5 h-5 text-purple-600" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Uso por Tipo de Request</h3>
                        </div>
                        <div className="space-y-3">
                            {data.by_request_type.map((type, idx) => {
                                const percentage = data.summary.total_tokens > 0 
                                    ? (type.total_tokens / data.summary.total_tokens) * 100 
                                    : 0;
                                const colors = [
                                    'bg-blue-500',
                                    'bg-green-500',
                                    'bg-purple-500',
                                    'bg-orange-500',
                                    'bg-pink-500'
                                ];
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="capitalize text-gray-700 dark:text-gray-300">
                                                {type.request_type}
                                            </span>
                                            <span className="text-gray-500">
                                                {formatNumber(type.total_tokens)} tokens ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div 
                                                className={`${colors[idx % colors.length]} h-2 rounded-full transition-all`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Usage by Organization */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-gray-900 dark:text-white">Uso por Organización</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Organización</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Tokens</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Requests</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Usuarios Activos</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Costo USD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.by_organization.map((org) => (
                                    <tr key={org.org_id.toString()} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{org.org_name}</td>
                                        <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatNumber(org.total_tokens)}</td>
                                        <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatNumber(org.requests)}</td>
                                        <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">{org.active_users}</td>
                                        <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(org.cost_usd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Users */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <GraduationCap className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-gray-900 dark:text-white">Top 20 Usuarios por Consumo</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Usuario</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Organización</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Rol</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Tokens</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Requests</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Costo USD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.top_users.map((user, idx) => (
                                    <tr key={user.user_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="py-3 px-4">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{user.org_name}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                                                user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                user.role === 'instructor' ? 'bg-blue-100 text-blue-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">{formatNumber(user.total_tokens)}</td>
                                        <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatNumber(user.requests)}</td>
                                        <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(user.cost_usd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Student Chat Usage Detail */}
                {data.student_chat_usage.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageCircle className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                Detalle de Uso del Chat por Alumnos (Top 50)
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Alumno</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Organización</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Tokens</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Requests</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Costo USD</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Último Chat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.student_chat_usage.map((student) => (
                                        <tr key={student.user_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="py-3 px-4">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{student.full_name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{student.email}</div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{student.org_name}</td>
                                            <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">{formatNumber(student.total_tokens)}</td>
                                            <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatNumber(student.chat_requests)}</td>
                                            <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(student.cost_usd)}</td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(student.last_chat).toLocaleDateString('es-ES')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
