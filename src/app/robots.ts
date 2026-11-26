import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

// Search and AI crawlers are named so there is no doubt they are welcome: the
// whole point of the site is to be read, by people and by assistants.
const AI_AND_SEARCH = [
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Amazonbot",
  "DuckAssistBot",
  "Meta-ExternalAgent",
  "CCBot",
];

// "/s" is the inner address scholarship pages are served from; the public ones are listed in the sitemap.
const rule = { allow: "/", disallow: ["/api/subscribe", "/api/report", "/api/miss", "/ingest/", "/s?"] };

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", ...rule },
      // Welcome, but not all at once: a crawler that honours this spaces its requests out.
      { userAgent: AI_AND_SEARCH, ...rule, crawlDelay: 1 },
    ],
    // Lists every sitemap file: the main pages and schools, then one page per scholarship.
    sitemap: `${site.url}/sitemap-index.xml`,
  };
}
