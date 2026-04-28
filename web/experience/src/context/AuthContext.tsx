"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (user: User, token: string) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('experience_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = (newUser: User, newToken: string) => {
        setUser(newUser);
        setToken(newToken);
        // El token JWT se guarda en httpOnly cookie por el backend.
        localStorage.setItem('experience_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('experience_user');
        // Borrar la httpOnly cookie desde el backend
        fetch('/lms-api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
