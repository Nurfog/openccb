/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    optimizeFonts: false,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3001',
                pathname: '/assets/**',
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/assets/:path*',
                destination: 'http://localhost:3001/assets/:path*',
            },
        ];
    },
};

export default nextConfig;
