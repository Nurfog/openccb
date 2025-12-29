'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Building2, Users2, LogOut } from 'lucide-react';

export function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 bg-black/20">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight">
                        Open<span className="gradient-text">CCB</span> Studio
                    </h1>
                </Link>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            Courses
                        </Link>

                        {user?.role === 'admin' && (
                            <>
                                <Link
                                    href="/admin/organizations"
                                    className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                                >
                                    <Building2 className="w-4 h-4" />
                                    Organizations
                                </Link>
                                <Link
                                    href="/admin/users"
                                    className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                                >
                                    <Users2 className="w-4 h-4" />
                                    Users
                                </Link>
                            </>
                        )}

                        {/* 
                        <Link
                            href="/settings"
                            className="text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </Link>
                        */}
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    {user ? (
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-medium text-white">{user.full_name}</span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</span>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all text-gray-500"
                                title="Sign Out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/auth/login"
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
