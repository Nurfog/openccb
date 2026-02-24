/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    optimizeFonts: false,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3001',
                pathname: '/assets/**',
            },
        ],
    },
};

export default nextConfig;
