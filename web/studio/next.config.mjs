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
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3001',
                pathname: '/uploads/**',
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/uploads/:path*',
                destination: 'http://localhost:3001/uploads/:path*',
            },
        ];
    },
};

export default nextConfig;
