"use client";

import { useEffect, useState, useCallback } from "react";
import { lmsApi, StudentNote } from "@/lib/api";
import { StickyNote, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { debounce } from "lodash";

interface StudentNotesProps {
    lessonId: string;
}

export default function StudentNotes({ lessonId }: StudentNotesProps) {
    const [note, setNote] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchNote = async () => {
            try {
                setLoading(true);
                const data = await lmsApi.getNote(lessonId);
                if (data) {
                    setNote(data.content);
                } else {
                    setNote("");
                }
            } catch (err) {
                console.error("Failed to fetch note:", err);
                setError("No se pudo cargar tu nota.");
            } finally {
                setLoading(false);
            }
        };

        fetchNote();
    }, [lessonId]);

    const debouncedSave = useCallback(
        debounce(async (content: string) => {
            if (!content.trim() && note === "") return;
            try {
                setSaving(true);
                await lmsApi.saveNote(lessonId, content);
                setLastSaved(new Date());
                setError(null);
            } catch (err) {
                console.error("Failed to save note:", err);
                setError("Error al auto-guardar.");
            } finally {
                setSaving(false);
            }
        }, 1000),
        [lessonId, note]
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setNote(newContent);
        debouncedSave(newContent);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-600 dark:text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs font-bold uppercase tracking-widest">Cargando tus notas...</span>
            </div>
        );
    }

    return (
        <div className="glass-card flex flex-col h-full bg-black/[0.01] dark:bg-white/[0.02] border-black/5 dark:border-white/5 overflow-hidden rounded-2xl">
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.03]">
                <div className="flex items-center gap-2">
                    <StickyNote size={18} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Notas Personales</h3>
                </div>
                <div className="flex items-center gap-2">
                    {saving ? (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest animate-pulse">
                            <Loader2 size={12} className="animate-spin" /> Guardando...
                        </span>
                    ) : error ? (
                        <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold uppercase tracking-widest">
                            <AlertCircle size={12} /> {error}
                        </span>
                    ) : lastSaved ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold uppercase tracking-widest">
                            <CheckCircle2 size={12} /> Guardado {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : null}
                </div>
            </div>

            <textarea
                value={note}
                onChange={handleChange}
                placeholder="Escribe tus apuntes aquí... Se guardan automáticamente."
                className="flex-1 w-full p-6 bg-transparent text-gray-800 dark:text-gray-200 text-sm leading-relaxed focus:outline-none resize-none placeholder:text-gray-400 dark:placeholder:text-gray-600 custom-scrollbar"
            />

            <div className="p-3 bg-black/[0.01] dark:bg-white/[0.01] border-t border-black/5 dark:border-white/5 text-[10px] text-gray-500 font-medium text-center italic">
                Solo tú puedes ver estas notas.
            </div>
        </div>
    );
}
