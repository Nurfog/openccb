"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cmsApi, AuditLog } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Clock, ShieldAlert, X } from 'lucide-react';

export default function AuditLogsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
                return;
            }
            loadLogs();
        }
    }, [user, authLoading, router]);

    const loadLogs = async () => {
        try {
            const data = await cmsApi.getAuditLogs();
            setLogs(data);
        } catch (err) {
            console.error("Failed to load audit logs", err);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5 py-4 px-8">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/')} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <ShieldAlert size={20} />
                            </div>
                            <h1 className="text-xl font-bold">System Audit Logs</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-12">
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-400">
                            <thead className="bg-white/5 uppercase font-bold text-xs tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Entity</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">
                                            {log.user_full_name || 'System / Unknown'}
                                            <div className="text-xs text-gray-600 font-mono mt-0.5">{log.user_id.slice(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                ${log.action === 'CREATE' ? 'bg-green-500/10 text-green-400' :
                                                    log.action === 'UPDATE' ? 'bg-blue-500/10 text-blue-400' :
                                                        log.action === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                                                            'bg-gray-500/10 text-gray-400'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-300">{log.entity_type}</div>
                                            <div className="text-xs text-gray-600 font-mono mt-0.5">{log.entity_id}</div>
                                        </td>
                                        <td className="px-6 py-4 flex items-center gap-2">
                                            <Clock size={14} />
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="text-blue-400 hover:text-blue-300 font-bold text-xs uppercase tracking-wider"
                                            >
                                                View Changes
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Changes Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gray-900">
                            <h3 className="text-lg font-bold text-white">Change Details</h3>
                            <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto font-mono text-xs text-gray-300 bg-black/30">
                            <pre className="whitespace-pre-wrap">
                                {JSON.stringify(selectedLog.changes, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
