import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/AuthContext";
import { BookOpen } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenCCB | Studio",
  description: "Create and manage high-fidelity educational content.",
};

import AuthHeader from "@/components/AuthHeader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-200 min-h-screen flex flex-col`}>
        <AuthProvider>
          <AuthGuard>
            <header className="h-20 glass sticky top-0 z-50 px-8 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-black/40">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <BookOpen size={20} />
                </div>
                <span className="font-black text-2xl tracking-tighter text-white">STUDIO</span>
              </Link>
              <AuthHeader />
            </header>
            <main className="flex-1">{children}</main>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}