"use client";

import { useEffect, useState } from "react";
import { lmsApi, MentorshipView } from "@/lib/api";
import { Award, Mail, UserCircle, ChevronDown, ChevronUp, Users } from "lucide-react";

type Props = {
    courseId: string;
};

export default function MentorPanel({ courseId }: Props) {
    const [mentor, setMentor] = useState<MentorshipView | null | undefined>(undefined);
    const [mentees, setMentees] = useState<MentorshipView[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        Promise.all([
            lmsApi.getMyMentor(courseId),
            lmsApi.getMyMentees(courseId),
        ]).then(([m, ms]) => {
            setMentor(m);
            setMentees(ms);
        }).catch(() => {
            setMentor(null);
            setMentees([]);
        });
    }, [courseId]);

    // Si no hay mentor asignado ni mentoreados, no renderizar nada
    if (mentor === undefined) return null;
    if (mentor === null && mentees.length === 0) return null;

    const hasMentor = mentor !== null;
    const hasMentees = mentees.length > 0;

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Award size={16} className="text-blue-500" />
                    </div>
                    <div className="text-left">
                        <p className="font-black text-sm text-slate-900 dark:text-white">
                            {hasMentees ? "Mentoría" : "Mi Mentor"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                            {hasMentees
                                ? `${mentees.length} alumno${mentees.length > 1 ? "s" : ""} a tu cargo`
                                : hasMentor
                                ? mentor!.mentor_name
                                : "Sin mentor asignado"}
                        </p>
                    </div>
                </div>
                {open ? (
                    <ChevronUp size={16} className="text-slate-400" />
                ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                )}
            </button>

            {open && (
                <div className="border-t border-slate-100 dark:border-white/5 p-4 space-y-4">
                    {/* Panel de mi mentor */}
                    {hasMentor && (
                        <section>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                Tu Mentor
                            </p>
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/15">
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                                    {mentor!.mentor_avatar ? (
                                        <img src={mentor!.mentor_avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserCircle size={24} className="text-blue-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm text-slate-900 dark:text-white truncate">
                                        {mentor!.mentor_name}
                                    </p>
                                    <a
                                        href={`mailto:${mentor!.mentor_email}`}
                                        className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-400 font-bold mt-0.5 transition-colors"
                                    >
                                        <Mail size={10} /> {mentor!.mentor_email}
                                    </a>
                                    {mentor!.notes && (
                                        <p className="text-[10px] text-slate-400 italic mt-1 line-clamp-2">
                                            {mentor!.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Panel de mentoreados */}
                    {hasMentees && (
                        <section>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                <Users size={10} /> Alumnos a tu cargo
                            </p>
                            <div className="space-y-2">
                                {mentees.map(m => (
                                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                            {m.student_avatar ? (
                                                <img src={m.student_avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <UserCircle size={18} className="text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                                {m.student_name}
                                            </p>
                                            <a
                                                href={`mailto:${m.student_email}`}
                                                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                            >
                                                <Mail size={9} /> {m.student_email}
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
