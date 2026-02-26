import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/AuthContext";
import { I18nProvider } from "@/context/I18nContext";
import { BookOpen } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { BrandingProvider } from "@/context/BrandingContext";
import { ThemeProvider } from "@/context/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenCCB | Studio",
  description: "Create and manage high-fidelity educational content.",
};

import { Navbar } from "@/components/Navbar";
import BrandingManager from "@/components/BrandingManager";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-200 min-h-screen flex flex-col transition-colors duration-300`}>
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <BrandingProvider>
                <AuthGuard>
                  <BrandingManager />
                  <Navbar />
                  <main className="flex-1 mt-16 md:mt-20">{children}</main>
                </AuthGuard>
              </BrandingProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}