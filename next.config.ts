import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
