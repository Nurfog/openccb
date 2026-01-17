"use client";

import { useEffect, useState } from "react";
import { lmsApi, User } from "@/lib/api";
import { Trophy, Medal, Award } from "lucide-react";

export default function Leaderboard() {
    const [topUsers, setTopUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const data = await lmsApi.getLeaderboard();
                setTopUsers(data);
            } catch (err) {
                console.error("Error al obtener la tabla de clasificación", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    if (loading) {
        return <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-2xl w-full"></div>
            ))}
        </div>;
    }

    return (
        <div className="glass-card p-8 border-white/5 bg-white/[0.01] rounded-3xl overflow-hidden relative">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                <Trophy size={14} className="text-amber-500" /> Tabla de Clasificación
            </h3>

            <div className="space-y-3">
                {topUsers.map((user, index) => (
                    <div
                        key={user.id}
                        className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${index === 0 ? 'bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 shadow-lg shadow-amber-500/5' :
                                'bg-white/5 border border-white/5 hover:bg-white/10'
                            }`}
                    >
                        <div className="flex-shrink-0 w-8 text-center font-black text-xs text-gray-600">
                            {index === 0 ? <Medal className="text-amber-500 mx-auto" size={18} /> :
                                index === 1 ? <Medal className="text-gray-400 mx-auto" size={18} /> :
                                    index === 2 ? <Medal className="text-amber-700 mx-auto" size={18} /> :
                                        index + 1}
                        </div>

                        <div className="flex-1">
                            <div className="text-sm font-bold text-gray-200 line-clamp-1">{user.full_name}</div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nivel {user.level || 1}</div>
                        </div>

                        <div className="text-right">
                            <div className="text-sm font-black text-white">{user.xp || 0}</div>
                            <div className="text-[8px] font-black text-blue-500 uppercase tracking-widest">XP</div>
                        </div>
                    </div>
                ))}

                {topUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-600 italic text-sm">
                        Aún no hay datos de clasificación disponibles.
                    </div>
                )}
            </div>

            {/* Visual background flair */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        </div>
    );
}
