"use client";

import React, { useState, useEffect } from "react";
import {
    History,
    Search,
    User as UserIcon,
    Calendar,
    ArrowRight,
    AlertCircle
} from "lucide-react";

// We'll define a local type or import if available
interface AuditLog {
    id: string;
    organization_id?: string;
    user_id?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    event_type: string;
    changes?: Record<string, unknown>;
    created_at: string;
    user_full_name?: string;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [entityFilter, setEntityFilter] = useState("");

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // Mocking API call for now since we haven't implemented the specific endpoint
                // In a real scenario: const data = await cmsApi.getAuditLogs();
                // For demo, we'll use a few mock entries
                const mockLogs: AuditLog[] = [
                    {
                        id: "1",
                        action: "COURSE_CREATED",
                        entity_type: "Course",
                        entity_id: "c1",
                        event_type: "CREATE",
                        user_full_name: "Juan Perez",
                        created_at: new Date().toISOString(),
                    },
                    {
                        id: "2",
                        action: "USER_ROLE_UPDATED",
                        entity_type: "User",
                        entity_id: "u1",
                        event_type: "UPDATE",
                        user_full_name: "System Admin",
                        created_at: new Date(Date.now() - 3600000).toISOString(),
                    },
                    {
                        id: "3",
                        action: "AI_COURSE_GENERATED",
                        entity_type: "Course",
                        entity_id: "c2",
                        event_type: "AI_GEN",
                        user_full_name: "Juan Perez",
                        created_at: new Date(Date.now() - 7200000).toISOString(),
                    }
                ];
                setLogs(mockLogs);
            } catch (err) {
                console.error("Failed to fetch audit logs", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        (log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user_full_name?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (entityFilter === "" || log.entity_type === entityFilter)
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <History className="text-indigo-400" size={32} />
                    Audit Logs
                </h1>
                <p className="text-gray-400 mt-1">Track every action across the platform.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by action or user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                </div>
                <select
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                >
                    <option value="">All Entities</option>
                    <option value="Course">Course</option>
                    <option value="User">User</option>
                    <option value="Organization">Organization</option>
                </select>
            </div>

            {/* Log List */}
            <div className="glass-card rounded-3xl border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/[0.03] border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Timestamp</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">User</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Action</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Entity</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-white/5 rounded-full w-full" /></td>
                                </tr>
                            ))
                        ) : filteredLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.01] transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                        <Calendar size={12} />
                                        {new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                            <UserIcon size={12} />
                                        </div>
                                        <span className="text-sm font-bold text-gray-200">{log.user_full_name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-md bg-white/5 text-gray-300">
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-gray-400">
                                        {log.entity_type} <span className="opacity-30">#</span>{log.entity_id.slice(0, 8)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all">
                                        <ArrowRight size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!loading && filteredLogs.length === 0 && (
                    <div className="p-20 text-center flex flex-col items-center gap-4">
                        <AlertCircle className="text-gray-600" size={48} />
                        <p className="text-gray-500 font-bold uppercase tracking-widest">No activities found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
