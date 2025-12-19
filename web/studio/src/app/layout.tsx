import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenCCB Studio | modern Course Management",
  description: "Advanced LMS Content Management System inspired by Open edX",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_50%)] pointer-events-none" />
        <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">
              Open<span className="gradient-text">CCB</span> Studio
            </h1>
            <div className="flex gap-4">
              <button className="text-sm font-medium hover:text-blue-400 transition-colors">Courses</button>
              <button className="text-sm font-medium hover:text-blue-400 transition-colors">Settings</button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-white/20" />
            </div>
          </div>
        </nav>
        <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
