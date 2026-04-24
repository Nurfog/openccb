"use client";

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '@/context/I18nContext';

interface CourseLanguageConfig {
    language_setting: 'auto' | 'fixed';
    fixed_language: string | null;
}

/**
 * Hook para manejar el idioma específico de un curso
 * 
 * - Si el curso está en modo 'auto', usa el idioma del usuario
 * - Si el curso está en modo 'fixed', usa el idioma fijo del curso
 * 
 * @param courseId - ID del curso actual
 * @returns El idioma que debe usarse para este curso
 */
export function useCourseLanguage(courseId: string | null) {
    const { language: userLanguage } = useTranslation();
    const [courseLanguage, setCourseLanguage] = useState<string>(userLanguage);
    const [isLoading, setIsLoading] = useState(true);
    const [config, setConfig] = useState<CourseLanguageConfig | null>(null);

    // Función para cargar la configuración de idioma del curso
    const loadCourseLanguageConfig = useCallback(async () => {
        if (!courseId) {
            setCourseLanguage(userLanguage);
            setIsLoading(false);
            return;
        }

        try {
            // Importar dinámicamente para evitar circular dependencies
            const { lmsApi } = await import('@/lib/api');

            const data = await lmsApi.getCourseLanguageConfig(courseId);
            
            setConfig(data);
            
            // Determinar qué idioma usar
            if (data.language_setting === 'fixed' && data.fixed_language) {
                setCourseLanguage(data.fixed_language);
            } else {
                // Modo 'auto' o sin configuración: usar idioma del usuario
                setCourseLanguage(userLanguage);
            }
        } catch (error) {
            console.error('Error loading course language config:', error);
            // Fallback: usar idioma del usuario
            setCourseLanguage(userLanguage);
        } finally {
            setIsLoading(false);
        }
    }, [courseId, userLanguage]);

    // Cargar configuración cuando cambia el courseId
    useEffect(() => {
        loadCourseLanguageConfig();
    }, [loadCourseLanguageConfig]);

    // Función para verificar si el curso usa idioma fijo
    const isFixedLanguage = useCallback(() => {
        return config?.language_setting === 'fixed';
    }, [config]);

    // Función para obtener el idioma actual (curso o usuario)
    const getCurrentLanguage = useCallback(() => {
        return courseLanguage;
    }, [courseLanguage]);

    return {
        courseLanguage,
        isFixedLanguage,
        getCurrentLanguage,
        isLoading,
        refreshConfig: loadCourseLanguageConfig,
    };
}

/**
 * Hook para cambiar el idioma del usuario (solo funciona si el curso está en modo 'auto')
 * 
 * @param courseId - ID del curso actual
 */
export function useCourseLanguageSwitcher(courseId: string | null) {
    const { setLanguage, language } = useTranslation();
    const { isFixedLanguage } = useCourseLanguage(courseId);

    const canChangeLanguage = !isFixedLanguage();

    const changeLanguage = (newLanguage: string) => {
        if (canChangeLanguage) {
            setLanguage(newLanguage);
        } else {
            console.warn('Cannot change language: course has fixed language setting');
        }
    };

    return {
        currentLanguage: language,
        canChangeLanguage,
        changeLanguage,
        isFixed: isFixedLanguage(),
    };
}
