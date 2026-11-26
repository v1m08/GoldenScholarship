import generated from "@/generated/index.json";
import { site } from "@/lib/config";

// One address that lists every sitemap file, to hand to Google and Bing.
export function GET() {
  const files = Array.from({ length: generated.sitemapFiles + 1 }, (_, i) => `${site.url}/sitemap/${i}.xml`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.map((f) => `<sitemap><loc>${f}</loc><lastmod>${generated.builtAt}</lastmod></sitemap>`).join("\n")}
</sitemapindex>
`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
