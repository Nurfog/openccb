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
