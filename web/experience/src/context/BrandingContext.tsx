'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { lmsApi, Organization } from '@/lib/api';

interface BrandingContextType {
    branding: Organization | null;
    loading: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
    branding: null,
    loading: true,
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [branding, setBranding] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);

    const orgId = process.env.NEXT_PUBLIC_ORG_ID || '00000000-0000-0000-0000-000000000001';

    useEffect(() => {
        const loadBranding = async () => {
            try {
                const data = await lmsApi.getBranding(orgId);
                setBranding(data);

                // Apply CSS variables
                if (data.primary_color) {
                    document.documentElement.style.setProperty('--primary-color', data.primary_color);
                }
                if (data.secondary_color) {
                    document.documentElement.style.setProperty('--secondary-color', data.secondary_color);
                }

                // Update Title
                if (data.platform_name) {
                    document.title = `${data.platform_name} | Experiencia de Aprendizaje`;
                }

                // Update Favicon
                if (data.favicon_url) {
                    // Import getImageUrl logic locally or assume it needs import
                    // Since I can't easily add import at top with replace_file, I will assume getImageUrl handles the path or do logic here.
                    // Actually I need to import getImageUrl at the top. Instead of complicating, I'll update imports too.
                    const getImageUrl = (path?: string) => {
                        if (!path) return '';
                        if (path.startsWith('http')) return path;
                        const CMS_API_URL = process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:3001";
                        const cleanPath = path.startsWith('/uploads') ? path.replace('/uploads', '/assets') : path;
                        const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
                        return `${CMS_API_URL}${finalPath}`;
                    };

                    const faviconUrl = getImageUrl(data.favicon_url);
                    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
                    if (link) {
                        link.href = faviconUrl;
                    } else {
                        const newLink = document.createElement("link");
                        newLink.rel = "shortcut icon";
                        newLink.href = faviconUrl;
                        document.head.appendChild(newLink);
                    }
                }
            } catch (error) {
                console.error('Failed to load branding', error);
            } finally {
                setLoading(false);
            }
        };

        loadBranding();
    }, [orgId]);

    return (
        <BrandingContext.Provider value={{ branding, loading }}>
            {children}
        </BrandingContext.Provider>
    );
};
