"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        const onBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
        };

        const onAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
        if (isStandalone) {
            setIsInstalled(true);
        }

        window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.addEventListener("appinstalled", onAppInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
            window.removeEventListener("appinstalled", onAppInstalled);
        };
    }, []);

    if (!deferredPrompt || isInstalled) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4">
            <div className="rounded-2xl border border-blue-300/40 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 shadow-2xl max-w-md w-[92vw]">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Instala OpenCCB para acceso rapido y soporte offline.
                </p>
                <div className="mt-3 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={async () => {
                            if (!deferredPrompt) return;
                            await deferredPrompt.prompt();
                            const choice = await deferredPrompt.userChoice;
                            if (choice.outcome === "accepted") {
                                setDeferredPrompt(null);
                            }
                        }}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                    >
                        Instalar App
                    </button>
                    <button
                        type="button"
                        onClick={() => setDeferredPrompt(null)}
                        className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                    >
                        Ahora no
                    </button>
                </div>
            </div>
        </div>
    );
}