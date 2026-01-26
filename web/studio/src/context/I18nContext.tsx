"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../lib/locales/en.json';
import es from '../lib/locales/es.json';
import pt from '../lib/locales/pt.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const translations: Record<string, any> = { en, es, pt };

interface I18nContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (path: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState('es');

    useEffect(() => {
        const savedLang = localStorage.getItem('studio_language');
        if (savedLang) {
            setLanguageState(savedLang);
        } else {
            // Try to detect from user profile if available, but for now default or localstorage
        }
    }, []);

    const setLanguage = (lang: string) => {
        setLanguageState(lang);
        localStorage.setItem('studio_language', lang);
    };

    const t = (path: string): string => {
        const keys = path.split('.');
        let result = translations[language] || translations['en'];

        for (const key of keys) {
            if (result[key]) {
                result = result[key];
            } else {
                return path; // Fallback to path if key missing
            }
        }

        return typeof result === 'string' ? result : path;
    };

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
}
