import { site } from "@/lib/config";
import { getOpenRows } from "@/lib/explore";
import { markdown, rowMarkdown } from "@/lib/plain";
import { getAnySchoolTotals } from "@/lib/schools";

// Scholarships open to students at any school, as plain Markdown.
export async function GET() {
  const totals = getAnySchoolTotals();
  const { rows, total, summaries } = await getOpenRows("open", 200);
  const body = `# Scholarships open to students at any school

${site.name} lists ${totals.total.toLocaleString("en-US")} scholarships from ${totals.providers.toLocaleString("en-US")} foundations and organisations that are not tied to one college; ${total.toLocaleString("en-US")} have a deadline still ahead. Many are limited to one town, county or state. The ${rows.length} that close soonest are below; the full list with filters is at ${site.url}/scholarships. Confirm every detail on the official page before applying.

${rows.map((r) => rowMarkdown("/scholarships", r, summaries[r.id])).join("\n\n")}
`;
  return markdown(body);
}
