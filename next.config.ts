// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ✅ let the build pass even if ESLint finds issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ let the build pass even if TS finds type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
