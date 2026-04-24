"use client";

import { useEffect, useState } from "react";

export default function ConnectivityBanner() {
    const [online, setOnline] = useState(true);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setOnline(navigator.onLine);

        const onOnline = () => {
            setOnline(true);
            setVisible(true);
            window.setTimeout(() => setVisible(false), 2500);
        };

        const onOffline = () => {
            setOnline(false);
            setVisible(true);
        };

        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    if (!visible && online) return null;

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[260] px-4" role="status" aria-live="polite" aria-atomic="true">
            <div
                className={`rounded-xl px-4 py-2 text-xs font-bold shadow-lg border ${
                    online
                        ? "bg-emerald-600 text-white border-emerald-500"
                        : "bg-amber-500 text-slate-950 border-amber-400"
                }`}
            >
                {online ? "Conexion restablecida" : "Sin conexion: usando contenido en cache"}
            </div>
        </div>
    );
}