import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MetadataRoute } from "next";
import generated from "@/generated/index.json";
import { MIN_SCHOLARSHIPS_TO_INDEX, site } from "@/lib/config";
import { POSTS } from "@/lib/posts";
import { getSchoolsWithData } from "@/lib/schools";

// Sitemap 0 is the main pages, the blog and every school worth indexing.
// Sitemaps 1 and up are one page per scholarship, from the lists written by
// scripts/build-data.mjs (only listings that state enough to be useful).
export async function generateSitemaps() {
  return Array.from({ length: generated.sitemapFiles + 1 }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const built = generated.builtAt;

  if (id > 0) {
    const file = path.join(process.cwd(), "src/generated/sitemap", `${id - 1}.json`);
    const paths = JSON.parse(await readFile(file, "utf8")) as string[];
    return paths.map((p) => ({ url: `${site.url}${p}`, lastModified: built, changeFrequency: "weekly", priority: 0.6 }));
  }

  const schools = await getSchoolsWithData(MIN_SCHOLARSHIPS_TO_INDEX);
  return [
    { url: site.url, lastModified: built, changeFrequency: "daily", priority: 1 },
    { url: `${site.url}/scholarships`, lastModified: built, changeFrequency: "daily", priority: 0.9 },
    { url: `${site.url}/schools`, lastModified: built, changeFrequency: "daily", priority: 0.8 },
    { url: `${site.url}/why`, changeFrequency: "monthly", priority: 0.3 },
    ...POSTS.map((p) => ({ url: `${site.url}/blog/${p.slug}`, lastModified: p.updated, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${site.url}/stats`, lastModified: built, changeFrequency: "daily", priority: 0.3 },
    ...schools.map((s) => ({
      url: `${site.url}/schools/${s.slug}`,
      lastModified: built,
      changeFrequency: "daily" as const,
      priority: s.open > 0 ? 0.8 : 0.5,
    })),
  ];
}
