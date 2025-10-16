// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let builds pass even with lint/type issues (you enabled this for Vercel)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Rewrites to serve files from /uploads via our static proxy route
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/static/uploads/:path*" },
    ];
  },
};

export default nextConfig;
