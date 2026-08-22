import type { NextConfig } from "next";

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? (() => {
        try {
          // Optional: next/bundle-analyzer if installed. Safe to skip if not present — build still succeeds.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const bundleAnalyzer = require("@next/bundle-analyzer");
          return bundleAnalyzer({ enabled: true });
        } catch {
          return (c: NextConfig) => c;
        }
      })()
    : (c: NextConfig) => c;

const nextConfig: NextConfig = {
  compress: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Tree-shake heavy icon / lib imports — lucide + shadcn patterns benefit measurably.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Never cache auth/session endpoints
        source: "/api/auth/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
