import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { BookOpen, LogOut, ShieldAlert } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenCCB | Studio",
  description: "Create and manage high-fidelity educational content.",
};

function AuthHeader() {
  "use client";
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center gap-4">
      {user?.role === 'admin' && (
        <Link href="/admin/audit" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2">
          <ShieldAlert size={16} /> Audit
        </Link>
      )}
      {user && (
        <>
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs">
            {user.full_name.charAt(0)}
          </div>
          <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <LogOut size={16} />
          </button>
        </>
      )}
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-200 min-h-screen flex flex-col`}>
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}