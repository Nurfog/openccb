"use client";

import React, { useState, useEffect } from "react";
import { lmsApi, DropoutRisk } from "@/lib/api";
import {
    AlertCircle,
    User,
    Mail,
    Calendar,
    Activity,
    Send,
    ChevronRight,
    Search
} from "lucide-react";

interface DropoutRiskDashboardProps {
    courseId: string;
}

export default function DropoutRiskDashboard({ courseId }: DropoutRiskDashboardProps) {
    const [risks, setRisks] = useState<DropoutRisk[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchRisks = async () => {
            try {
                const data = await lmsApi.getDropoutRisks(courseId);
                setRisks(data);
            } catch (err) {
                console.error("Failed to fetch dropout risks", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRisks();
    }, [courseId]);

    const filteredRisks = risks.filter(r =>
        (r.user_full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.user_email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Calculating risk scores...</div>;

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-green-500 bg-green-500/10 border-green-500/20';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
                        <AlertCircle className="text-red-600 dark:text-red-500" />
                        Dropout Risk Analysis
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 font-medium">AI-powered detection based on grades, activity, and engagement.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search student..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-64 text-slate-900 dark:text-white font-bold"
                    />
                </div>
            </div>

            {filteredRisks.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredRisks.map((risk) => (
                        <div key={risk.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-50 dark:hover:bg-white/[0.07] transition-all group shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xl font-bold">
                                        {risk.user_full_name?.[0] || <User />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{risk.user_full_name || "Unknown Student"}</h3>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-500 mt-1 font-medium">
                                            <span className="flex items-center gap-1"><Mail size={12} className="text-slate-400" /> {risk.user_email || "N/A"}</span>
                                            <span className="flex items-center gap-1"><Calendar size={12} className="text-slate-400" /> Last active: {new Date(risk.last_calculated_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                    <div className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${getRiskColor(risk.risk_level)}`}>
                                        {risk.risk_level} Risk
                                    </div>

                                    <div className="flex flex-col items-end min-w-[100px]">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-400">Score: {Math.round(risk.score * 100)}%</div>
                                        <div className="w-24 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full mt-1.5 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ${risk.score > 0.8 ? 'bg-red-500' : risk.score > 0.5 ? 'bg-orange-500' : 'bg-green-500'}`}
                                                style={{ width: `${risk.score * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <button className="p-3 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>

                            {risk.reasons && risk.reasons.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-2">
                                    {risk.reasons.map((reason, _idx) => (
                                        <div key={_idx} className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-lg px-3 py-1.5 text-[10px] font-black text-slate-500 dark:text-gray-400 flex items-center gap-2 uppercase tracking-wide">
                                            <Activity size={10} className="text-blue-600 dark:text-blue-500" />
                                            {reason.description}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-20 text-center shadow-sm">
                    <User size={48} className="text-slate-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-800 dark:text-gray-300 uppercase tracking-widest">No students at risk</h3>
                    <p className="text-sm text-slate-500 dark:text-gray-500 mt-2 font-medium">Everyone seems to be doing great in this course!</p>
                </div>
            )}
        </div>
    );
}
