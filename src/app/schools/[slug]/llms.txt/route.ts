import { site } from "@/lib/config";
import { getOpenRows } from "@/lib/explore";
import { markdown, rowMarkdown } from "@/lib/plain";
import { getSchoolBySlug, getTopSchools } from "@/lib/schools";

// One school's open scholarships as plain Markdown, soonest deadline first.
export async function GET(_request: Request, { params }: RouteContext<"/schools/[slug]/llms.txt">) {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) return new Response("No such school.\n", { status: 404 });
  const base = `/schools/${school.slug}`;
  const { rows, total, summaries } = await getOpenRows(school.unitid, 150);
  const body = `# Scholarships at ${school.name}

${school.name}${school.state ? ` (${[school.city, school.state].filter(Boolean).join(", ")})` : ""} has ${school.total.toLocaleString("en-US")} scholarships listed on ${site.name}; ${total.toLocaleString("en-US")} have a deadline still ahead. ${rows.length < total ? `The ${rows.length} that close soonest are below.` : "All of them are below, soonest first."} The full list with filters is at ${site.url}${base}. Confirm every detail on the official page before applying.

${rows.map((r) => rowMarkdown(base, r, summaries[r.id])).join("\n\n")}
`;
  return markdown(body);
}

// A few are built ahead of time; the rest on first request.
export async function generateStaticParams() {
  return (await getTopSchools(10)).map((s) => ({ slug: s.slug }));
}
