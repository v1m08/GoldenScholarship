import "server-only";
import { site } from "./config";
import { eligibility, longDate, money } from "./describe";
import { scholarshipPath, type Row } from "./rows";

// One scholarship as a few lines of Markdown, for the plain-text lists that
// AI assistants read instead of the interactive page.
export function rowMarkdown(base: string, r: Row, summary?: string): string {
  const bits = [
    r.deadline ? `Deadline: ${longDate(r.deadline)}` : "Deadline: not listed",
    money(r) ? `Award: ${money(r)}` : null,
    r.provider ? `From: ${r.provider}` : null,
    eligibility(r).join(" ") || null,
  ].filter(Boolean);
  return [`### ${r.name}`, summary || null, bits.join(" | "), r.url ? `Apply: ${r.url}` : null, `Details: ${site.url}${scholarshipPath(base, r)}`]
    .filter(Boolean)
    .join("\n");
}

export const markdown = (body: string) =>
  new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
