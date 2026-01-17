import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/AuthContext";
import { BrandingProvider } from "@/context/BrandingContext";
import AuthGuard from "@/components/AuthGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenCCB | Experiencia de Aprendizaje",
  description: "Consume contenido educativo de alta fidelidad con OpenCCB",
};

import AppHeader from "@/components/AppHeader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#050505] text-[#e5e5e5] min-h-screen flex flex-col`}>
        <BrandingProvider>
          <AuthProvider>
            <AuthGuard>
              <AppHeader />
              <main className="flex-1">
                {children}
              </main>
              <footer className="py-12 px-6 border-t border-white/5 text-center bg-black/20">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
                  Desarrollado por OpenCCB © 2023. Codificación Agente Avanzada.
                </p>
              </footer>
            </AuthGuard>
          </AuthProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
