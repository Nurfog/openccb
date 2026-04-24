"use client";

import { useEffect } from "react";
import { lmsApi } from "@/lib/api";

export default function PwaRegistration() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js", {
                    scope: "/",
                });

                // Try to flush queued progress events at startup.
                lmsApi.flushOfflineQueue().catch(() => undefined);

                registration.addEventListener("updatefound", () => {
                    const installingWorker = registration.installing;
                    if (!installingWorker) return;

                    installingWorker.addEventListener("statechange", () => {
                        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                            installingWorker.postMessage({ type: "SKIP_WAITING" });
                            window.location.reload();
                        }
                    });
                });
            } catch (error) {
                console.warn("Service worker registration failed", error);
            }
        };

        const onOnline = () => {
            lmsApi.flushOfflineQueue().catch(() => undefined);
        };

        window.addEventListener("online", onOnline);

        register();

        return () => {
            window.removeEventListener("online", onOnline);
        };
    }, []);

    return null;
}