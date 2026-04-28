'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, Users, AlertTriangle, DollarSign, Activity, Edit2, Save, X, Gauge } from 'lucide-react';
import { cmsApi } from '@/lib/api';

interface TokenUsage {
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    ai_requests: number;
    last_used: string;
    estimated_cost_usd: number;
    monthly_token_limit?: number;
    token_limit_reset_day?: number;
}

interface TokenStats {
    total_tokens: number;
    total_input: number;
    total_output: number;
    total_requests: number;
    total_cost_usd: number;
    top_user_tokens: number;
    avg_tokens_per_user: number;
}

interface UserLimit {
    user_id: string;
    monthly_limit: number;
    used_tokens: number;
    remaining_tokens: number;
    percentage_used: number;
    reset_day: number;
}

export default function AdminTokenTracking() {
    const [usage, setUsage] = useState<TokenUsage[]>([]);
    const [stats, setStats] = useState<TokenStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterRole, setFilterRole] = useState<string>('');
    const [sortBy, setSortBy] = useState<'total_tokens' | 'ai_requests' | 'estimated_cost_usd' | 'percentage_used'>('total_tokens');
    const [editingLimit, setEditingLimit] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [userLimits, setUserLimits] = useState<Record<string, UserLimit>>({});

    useEffect(() => {
        loadTokenUsage();
    }, []);

    const loadTokenUsage = async () => {
        try {
            const token = localStorage.getItem('studio_token');
            
            if (!token) {
                console.error('[TokenUsage] No authentication token found!');
                alert('No authentication token found. Please login again.');
                window.location.href = '/auth/login';
                return;
            }
            
            const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/admin/token-usage`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 401) {
                console.error('[TokenUsage] Unauthorized - Token may be expired');
                alert('Session expired. Please login again.');
                window.location.href = '/auth/login';
                return;
            }

            if (response.ok) {
                const data = await response.json();
                setUsage(data.usage || []);
                setStats(data.stats);
                
                // Load limits for each user
                const limits: Record<string, UserLimit> = {};
                for (const user of data.usage || []) {
                    try {
                        const limitResp = await fetch(
                            `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/admin/users/${user.user_id}/token-limit/check`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('studio_token')}`,
                                },
                            }
                        );
                        if (limitResp.ok) {
                            const limitData = await limitResp.json();
                            limits[user.user_id] = {
                                user_id: user.user_id,
                                monthly_limit: limitData.monthly_limit,
                                used_tokens: limitData.used_tokens,
                                remaining_tokens: limitData.remaining_tokens,
                                percentage_used: limitData.monthly_limit > 0 
                                    ? Math.round((limitData.used_tokens / limitData.monthly_limit) * 100)
                                    : 0,
                                reset_day: 1,
                            };
                        }
                    } catch (err) {
                        console.error(`Failed to load limit for user ${user.user_id}:`, err);
                    }
                }
                setUserLimits(limits);
            }
        } catch (error) {
            console.error('Failed to load token usage:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateLimit = async (userId: string) => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/admin/users/${userId}/token-limit`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('studio_token')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        monthly_token_limit: editValue,
                        token_limit_reset_day: 1,
                    }),
                }
            );

            if (response.ok) {
                // Reload limits
                const limitResp = await fetch(
                    `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/admin/users/${userId}/token-limit/check`,
                    {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('studio_token')}`,
                        },
                    }
                );
                if (limitResp.ok) {
                    const limitData = await limitResp.json();
                    setUserLimits(prev => ({
                        ...prev,
                        [userId]: {
                            user_id: userId,
                            monthly_limit: limitData.monthly_limit,
                            used_tokens: limitData.used_tokens,
                            remaining_tokens: limitData.remaining_tokens,
                            percentage_used: limitData.monthly_limit > 0 
                                ? Math.round((limitData.used_tokens / limitData.monthly_limit) * 100)
                                : 0,
                            reset_day: 1,
                        },
                    }));
                }
                setEditingLimit(null);
            }
        } catch (error) {
            console.error('Failed to update limit:', error);
            alert('Failed to update token limit');
        }
    };

    const getLimitColor = (percentage: number) => {
        if (percentage >= 100) return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        if (percentage >= 90) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
        if (percentage >= 80) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
        return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    };

    const getProgressBarColor = (percentage: number) => {
        if (percentage >= 100) return 'bg-red-600';
        if (percentage >= 90) return 'bg-orange-600';
        if (percentage >= 80) return 'bg-yellow-600';
        return 'bg-green-600';
    };

    const filteredUsage = usage
        .filter(u => !filterRole || u.role === filterRole)
        .sort((a, b) => {
            if (sortBy === 'percentage_used') {
                const aPct = userLimits[a.user_id]?.percentage_used || 0;
                const bPct = userLimits[b.user_id]?.percentage_used || 0;
                return bPct - aPct;
            }
            return b[sortBy] - a[sortBy];
        });

    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
    const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-8 h-8 text-indigo-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Control Global - Token Usage
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Monitoreo de tokens de IA, límites mensuales y costos del sistema
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {stats && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {formatNumber(stats.total_tokens)}
                                        </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-blue-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Input: {formatNumber(stats.total_input)} | Output: {formatNumber(stats.total_output)}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Requests IA</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {formatNumber(stats.total_requests)}
                                        </p>
                                    </div>
                                    <Activity className="w-8 h-8 text-green-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Avg: {formatNumber(stats.avg_tokens_per_user)} tokens/user
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Costo Estimado</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(stats.total_cost_usd)}
                                        </p>
                                    </div>
                                    <DollarSign className="w-8 h-8 text-green-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Top user: {formatNumber(stats.top_user_tokens)} tokens
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Usuarios Activos</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {usage.length}
                                        </p>
                                    </div>
                                    <Users className="w-8 h-8 text-purple-600" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Monitoreando uso de IA
                                </div>
                            </div>
                        </div>

                        {/* Alerts */}
                        {Object.values(userLimits).some(ul => ul.percentage_used >= 80) && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 text-sm">
                                        Usuarios cerca del límite
                                    </h4>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                        {Object.values(userLimits).filter(ul => ul.percentage_used >= 80 && ul.percentage_used < 100).length} usuario(s) han usado ≥80% de su límite mensual.
                                    </p>
                                </div>
                            </div>
                        )}

                        {Object.values(userLimits).some(ul => ul.percentage_used >= 100) && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-red-900 dark:text-red-100 text-sm">
                                        Límite excedido
                                    </h4>
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                        {Object.values(userLimits).filter(ul => ul.percentage_used >= 100).length} usuario(s) han excedido su límite mensual.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Filters */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        Filtrar por Rol
                                    </label>
                                    <select
                                        value={filterRole}
                                        onChange={(e) => setFilterRole(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">Todos</option>
                                        <option value="student">Estudiantes</option>
                                        <option value="instructor">Instructores</option>
                                        <option value="admin">Admins</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        Ordenar por
                                    </label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="total_tokens">Total Tokens</option>
                                        <option value="ai_requests">Requests IA</option>
                                        <option value="estimated_cost_usd">Costo USD</option>
                                        <option value="percentage_used">% Usado</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Usage Table */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    Uso por Usuario
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Gauge className="w-4 h-4" />
                                    <span>Límites mensuales configurables</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Usuario
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Rol
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Límite Mensual
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                % Usado
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Total Tokens
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Requests
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Costo USD
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {filteredUsage.map((user) => {
                                            const limit = userLimits[user.user_id];
                                            const percentage = limit?.percentage_used || 0;
                                            const isUnlimited = limit?.monthly_limit === 0;

                                            return (
                                                <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {user.full_name}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                                                            user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                            user.role === 'instructor' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-green-100 text-green-800'
                                                        }`}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {editingLimit === user.user_id ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                                                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                                                                    placeholder="0 = unlimited"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={() => handleUpdateLimit(user.user_id)}
                                                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                                >
                                                                    <Save className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingLimit(null)}
                                                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className={`text-sm font-medium ${
                                                                    isUnlimited ? 'text-gray-400' :
                                                                    percentage >= 100 ? 'text-red-600' :
                                                                    percentage >= 80 ? 'text-yellow-600' :
                                                                    'text-gray-900 dark:text-white'
                                                                }`}>
                                                                    {isUnlimited ? '∞' : formatNumber(limit?.monthly_limit || 0)}
                                                                </span>
                                                                {!isUnlimited && limit && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingLimit(user.user_id);
                                                                            setEditValue(limit.monthly_limit);
                                                                        }}
                                                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                        title="Edit limit"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {isUnlimited ? (
                                                            <span className="text-xs text-gray-400">Unlimited</span>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`text-xs font-bold px-2 py-1 rounded ${getLimitColor(percentage)}`}>
                                                                    {percentage}%
                                                                </span>
                                                                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${getProgressBarColor(percentage)} transition-all duration-500`}
                                                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <span className={`text-sm font-medium ${
                                                            user.total_tokens > 1000000 ? 'text-red-600' :
                                                            user.total_tokens > 500000 ? 'text-yellow-600' :
                                                            'text-gray-900 dark:text-white'
                                                        }`}>
                                                            {formatNumber(user.total_tokens)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                                                        {formatNumber(user.ai_requests)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(user.estimated_cost_usd)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando estadísticas de tokens...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
