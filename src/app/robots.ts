import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

// School pages and the lists are files, so reading them costs nothing. One
// scholarship's page and the JSON addresses are worked out by a function on
// every request, and the hosting plan allows about four hours of that a month.
// A single crawler walking every scholarship at one request a second used it
// up in two days and the whole site was switched off. So who may fetch what
// depends on how much they fetch.

// Never for crawlers: the endpoints that write, analytics, and the inner
// address scholarship pages are served from.
const NEVER = ["/api/subscribe", "/api/report", "/api/miss", "/ingest/", "/s?"];

// One scholarship's page: /schools/<school>/<scholarship> and /scholarships/<scholarship>.
// The same patterns cover the per-school plain-text lists, which are also functions.
const PER_SCHOLARSHIP = ["/schools/*/", "/scholarships/"];

// Fetch one page because a person asked for it. Everything is open to them.
const FOR_A_PERSON = ["ChatGPT-User", "Claude-User", "Perplexity-User", "DuckAssistBot"];

// Search engines people find the site through. They get the scholarship pages, not the JSON.
const SEARCH = ["Googlebot", "Bingbot", "DuckDuckBot", "Applebot"];

// Read the whole site in bulk. They get every school page and list, which hold
// each scholarship's key facts, but not a page per scholarship.
const BULK = [
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Meta-ExternalAgent",
  "meta-webindexer",
  "FacebookBot",
  "Bytespider",
  "CCBot",
];

const bulk = { allow: "/", disallow: [...NEVER, "/api/", ...PER_SCHOLARSHIP], crawlDelay: 10 };

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Anything unnamed is treated as a bulk reader.
      { userAgent: "*", ...bulk },
      { userAgent: BULK, ...bulk },
      { userAgent: SEARCH, allow: "/", disallow: [...NEVER, "/api/"], crawlDelay: 5 },
      { userAgent: FOR_A_PERSON, allow: "/", disallow: NEVER },
    ],
    // Lists every sitemap file: the main pages and schools, then one page per scholarship.
    sitemap: `${site.url}/sitemap-index.xml`,
  };
}
