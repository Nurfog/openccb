import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenCCB | Learning Experience",
  description: "Consume high-fidelity educational content with OpenCCB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#050505] text-[#e5e5e5] min-h-screen flex flex-col`}>
        <AuthProvider>
          {/* Header */}
          <header className="h-16 glass sticky top-0 z-50 px-6 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-black/40">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                L
              </div>
              <span className="font-black text-xl tracking-tighter text-white">LEARN<span className="text-blue-500">EXPERIENCE</span></span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Catalog</Link>
              <Link href="#" className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors">My Learning</Link>
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10" />
            </nav>
          </header>

          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="py-12 px-6 border-t border-white/5 text-center bg-black/20">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
              Powered by OpenCCB &copy; 2023. Advanced Agentic Coding.
            </p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
