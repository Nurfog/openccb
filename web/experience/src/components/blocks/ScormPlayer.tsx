"use client";

import { useEffect, useMemo, useState } from "react";
import { lmsApi } from "@/lib/api";

type Props = {
    lessonId: string;
    courseId: string;
    title: string;
    launchUrl: string;
};

export default function ScormPlayer({ lessonId, courseId, title, launchUrl }: Props) {
    const [status, setStatus] = useState<string>("Iniciando contenido SCORM...");

    const safeLaunchUrl = useMemo(() => {
        // Permitimos rutas relativas (proxy local) o URLs absolutas http/https
        if (!launchUrl) return "";
        if (launchUrl.startsWith("/")) return launchUrl;
        if (launchUrl.startsWith("http://") || launchUrl.startsWith("https://")) return launchUrl;
        return "";
    }, [launchUrl]);

    useEffect(() => {
        const onMessage = async (event: MessageEvent) => {
            const data = event.data;
            if (!data || typeof data !== "object") return;

            const maybeVerb =
                data.verb ||
                data?.statement?.verb?.id ||
                data?.event ||
                data?.type;

            const maybeObjectId =
                data.object_id ||
                data?.statement?.object?.id ||
                data?.objectId ||
                lessonId;

            // Filtramos ruido y sólo procesamos eventos potencialmente xAPI/SCORM
            if (!maybeVerb) return;

            const normalizedVerb = String(maybeVerb).toLowerCase();
            const looksRelevant =
                normalizedVerb.includes("xapi") ||
                normalizedVerb.includes("scorm") ||
                normalizedVerb.includes("completed") ||
                normalizedVerb.includes("passed") ||
                normalizedVerb.includes("progress") ||
                normalizedVerb.includes("initialized") ||
                normalizedVerb.includes("terminated") ||
                normalizedVerb.includes("launched");

            if (!looksRelevant) return;

            const score =
                typeof data?.result?.score?.scaled === "number"
                    ? Number(data.result.score.scaled) * 100
                    : typeof data?.score === "number"
                      ? Number(data.score)
                      : undefined;

            const progress =
                typeof data?.progress === "number"
                    ? Number(data.progress)
                    : typeof data?.result?.extensions?.progress === "number"
                      ? Number(data.result.extensions.progress)
                      : undefined;

            const completed =
                data?.completed === true ||
                data?.result?.completion === true ||
                normalizedVerb.includes("completed") ||
                normalizedVerb.includes("passed");

            try {
                await lmsApi.trackXapiStatement({
                    course_id: courseId,
                    lesson_id: lessonId,
                    verb: String(maybeVerb),
                    object_id: String(maybeObjectId),
                    score,
                    progress,
                    completed,
                    raw_statement: data,
                });

                if (completed) {
                    setStatus("Contenido completado. Progreso registrado.");
                } else if (typeof progress === "number") {
                    setStatus(`Progreso SCORM: ${Math.round(progress)}%`);
                } else {
                    setStatus("Actividad SCORM en curso...");
                }
            } catch {
                setStatus("No se pudo registrar un evento xAPI.");
            }
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [courseId, lessonId]);

    if (!safeLaunchUrl) {
        return (
            <div className="p-6 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300">
                No hay una URL SCORM válida para esta lección.
            </div>
        );
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">SCORM/xAPI Player</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">{status}</span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30">
                <iframe
                    title={title || "SCORM content"}
                    src={safeLaunchUrl}
                    className="w-full h-[72vh] bg-white"
                    allow="fullscreen"
                />
            </div>
        </section>
    );
}
