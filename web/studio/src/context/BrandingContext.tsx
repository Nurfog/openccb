'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { cmsApi, Organization, getImageUrl } from '@/lib/api';
import { useAuth } from './AuthContext';
import { usePathname } from 'next/navigation';

interface BrandingContextType {
    branding: Organization | null;
    loading: boolean;
    refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
    branding: null,
    loading: true,
    refreshBranding: async () => { },
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [branding, setBranding] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);

    const pathname = usePathname();

    const loadBranding = async () => {
        if (!user?.organization_id) {
            setLoading(false);
            return;
        }
        try {
            const data = await cmsApi.getBranding(user.organization_id);
            // Translate BrandingResponse to Organization shape (partial)
            const orgData = {
                id: user.organization_id,
                name: data.platform_name || 'OpenCCB',
                logo_url: data.logo_url,
                favicon_url: data.favicon_url,
                platform_name: data.platform_name,
                logo_variant: data.logo_variant,
                primary_color: data.primary_color,
                secondary_color: data.secondary_color,
            } as any;

            setBranding(orgData);
            console.log('Branding loaded in Studio:', orgData);
        } catch (error) {
            console.error('Failed to load branding', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBranding();
    }, [user?.organization_id]);

    useEffect(() => {
        if (!branding) return;
        console.log('Applying branding in Studio for path:', pathname);

        // Apply CSS variables
        if (branding.primary_color) {
            document.documentElement.style.setProperty('--primary-color', branding.primary_color);
        }
        if (branding.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', branding.secondary_color);
        }

        // Update Title
        if (branding.platform_name) {
            document.title = `${branding.platform_name} | Studio`;
        }

        // Update Favicon
        if (branding.favicon_url) {
            const faviconUrl = getImageUrl(branding.favicon_url);
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
    }, [branding, pathname]);

    return (
        <BrandingContext.Provider value={{ branding, loading, refreshBranding: loadBranding }}>
            {children}
        </BrandingContext.Provider>
    );
};
