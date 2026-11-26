import type { NextConfig } from "next";

// PostHog region: "us" or "eu". Must match the project the key belongs to.
const posthogRegion = process.env.POSTHOG_REGION === "eu" ? "eu" : "us";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PostHog's API uses trailing slashes; do not redirect them away.
  skipTrailingSlashRedirect: true,
  // Every school page is built ahead of time, a couple of thousand of them. Give
  // a slow build machine room before a page counts as stuck (default is 60s).
  staticPageGenerationTimeout: 180,
  // Scholarship pages and the plain-text lists are built on first request, and
  // read the exported data files when they are. Ship those files with them.
  outputFileTracingIncludes: {
    "/schools/[slug]/[scholarship]": ["./public/data/s/**", "./src/generated/detail/**"],
    "/schools/[slug]/llms.txt": ["./public/data/s/**", "./public/data/any-*.json", "./src/generated/detail/**"],
    "/scholarships/[scholarship]": ["./public/data/any-*.json", "./src/generated/detail/any.json"],
    "/scholarships/llms.txt": ["./public/data/any-*.json", "./src/generated/detail/any.json"],
    "/api/scholarships": ["./public/data/s/**", "./public/data/any-*.json", "./src/generated/detail/**"],
    "/sitemap/[__metadata_id__]": ["./src/generated/sitemap/**"],
  },
  // Exported listing files change once a day. Let browsers and the CDN reuse
  // them for a few minutes, and keep serving a stale copy while a fresh one loads.
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=600, stale-while-revalidate=86400" }],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `https://${posthogRegion}-assets.i.posthog.com/static/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `https://${posthogRegion}.i.posthog.com/:path*`,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
