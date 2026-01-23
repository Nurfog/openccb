"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cmsApi, getImageUrl } from "@/lib/api";

export default function BrandingManager() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user || user.role === "super_admin") return;
        // Note: checking user.role === "admin" might be enough, but regular users in Studio (instructors) should also see branding?
        // Usually YES.

        const fetchBranding = async () => {
            try {
                // If user has organization_id, fetch that org
                // cmsApi.getOrganization() fetches based on X-Organization-Id or token claims.
                // Assuming getOrganization() returns the current context org.
                const org = await cmsApi.getOrganization();

                if (org) {
                    // Update Title
                    if (org.platform_name) {
                        document.title = `${org.platform_name} | Studio`;
                    }

                    // Update Favicon
                    if (org.favicon_url) {
                        const faviconUrl = getImageUrl(org.favicon_url);
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
                }
            } catch (err) {
                console.error("Failed to load branding", err);
            }
        };

        if (user) {
            fetchBranding();
        }
    }, [user]);

    return null;
}
