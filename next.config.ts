import type { NextConfig } from "next";

const nextConfig: NextConfig = {
fix/security-and-auth-audit
    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
            ],
        }]
    },
=======
main
    turbopack: {
        root: process.cwd(),
    },
    // Allow Supabase Storage URLs for next/image
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "*.supabase.co",
                pathname: "/storage/v1/object/public/**",
            },
        ],
    },
    // Suppress "punycode" deprecation warning from svix
    serverExternalPackages: ["svix"],
};

export default nextConfig;
