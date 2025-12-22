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
        const savedUser = localStorage.getItem('studio_user');
        const savedToken = localStorage.getItem('studio_token');
        if (savedUser && savedToken) {
            setUser(JSON.parse(savedUser));
            setToken(savedToken);
        }
        setLoading(false);
    }, []);

    const login = (newUser: User, newToken: string) => {
        setUser(newUser);
        setToken(newToken);
        localStorage.setItem('studio_user', JSON.stringify(newUser));
        localStorage.setItem('studio_token', newToken);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('studio_user');
        localStorage.removeItem('studio_token');
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
