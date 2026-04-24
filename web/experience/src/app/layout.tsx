import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/AuthContext";
import { I18nProvider } from "@/context/I18nContext";
import { BrandingProvider } from "@/context/BrandingContext";
import AuthGuard from "@/components/AuthGuard";
import { ThemeProvider } from "@/context/ThemeContext";
import PwaRegistration from "@/components/PwaRegistration";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import ConnectivityBanner from "@/components/ConnectivityBanner";
import OfflineSyncPanel from "@/components/OfflineSyncPanel";

export const metadata: Metadata = {
  title: "Experiencia de Aprendizaje",
  description: "Consume contenido educativo de alta fidelidad.",
  manifest: "/manifest.webmanifest",
};

import AppHeader from "@/components/AppHeader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-sans transition-colors duration-300">
        <ThemeProvider>
          <BrandingProvider>
            <AuthProvider>
              <I18nProvider>
                <AuthGuard>
                  <PwaRegistration />
                  <PwaInstallPrompt />
                  <ConnectivityBanner />
                  <OfflineSyncPanel />
                  <AppHeader />
                  <main className="flex-1">
                    {children}
                  </main>
                  <footer className="py-12 px-6 border-t border-black/5 dark:border-white/5 text-center bg-gray-50 dark:bg-black/20">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-600">
                      © 2026. Todos los derechos reservados.
                    </p>
                  </footer>
                </AuthGuard>
              </I18nProvider>
            </AuthProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
