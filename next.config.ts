import type { NextConfig } from "next";

// PostHog region: "us" or "eu". Must match the project the key belongs to.
const posthogRegion = process.env.POSTHOG_REGION === "eu" ? "eu" : "us";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PostHog's API uses trailing slashes; do not redirect them away.
  skipTrailingSlashRedirect: true,
  // Every school page is built ahead of time, several thousand of them. Give
  // a slow build machine room before a page counts as stuck (default is 60s).
  staticPageGenerationTimeout: 180,
  // Scholarship pages and the plain-text lists are worked out on request, and
  // read the exported data files when they are. Ship those files with them.
  outputFileTracingIncludes: {
    "/s": ["./public/data/s/**", "./public/data/any-*.json", "./src/generated/detail/**"],
    "/schools/[slug]/llms.txt": ["./public/data/s/**", "./public/data/any-*.json", "./src/generated/detail/**"],
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
      // One scholarship's page. Its address ends in the scholarship's id (hex).
      // Both forms are served by src/app/s/page.tsx; see the note there for why.
      { source: "/schools/:school/:id([^/]*-[0-9a-f]{8,40})", destination: "/s?school=:school&id=:id" },
      { source: "/scholarships/:id([^/]*-[0-9a-f]{8,40})", destination: "/s?id=:id" },
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
