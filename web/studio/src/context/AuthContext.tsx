"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    token: string | null;
    selectedOrgId: string | null;
    login: (user: User, token: string) => void;
    logout: () => void;
    setOrganizationId: (id: string | null) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('studio_user');
        const savedToken = localStorage.getItem('studio_token');
        const savedOrgId = localStorage.getItem('studio_selected_org_id');

        if (savedUser && savedToken) {
            const u = JSON.parse(savedUser);
            setUser(u);
            setToken(savedToken);
            setSelectedOrgId(savedOrgId || u.organization_id || null);
        }
        setLoading(false);
    }, []);

    const login = (newUser: User, newToken: string) => {
        setUser(newUser);
        setToken(newToken);
        setSelectedOrgId(newUser.organization_id || null);
        localStorage.setItem('studio_user', JSON.stringify(newUser));
        localStorage.setItem('studio_token', newToken);
        if (newUser.organization_id) {
            localStorage.setItem('studio_selected_org_id', newUser.organization_id);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setSelectedOrgId(null);
        localStorage.removeItem('studio_user');
        localStorage.removeItem('studio_token');
        localStorage.removeItem('studio_selected_org_id');
    };

    const setOrganizationId = (id: string | null) => {
        setSelectedOrgId(id);
        if (id) {
            localStorage.setItem('studio_selected_org_id', id);
        } else {
            localStorage.removeItem('studio_selected_org_id');
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, selectedOrgId, login, logout, setOrganizationId, loading }}>
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
