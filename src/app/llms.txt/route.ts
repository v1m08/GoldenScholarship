import { site } from "@/lib/config";
import { markdown } from "@/lib/plain";
import { POSTS } from "@/lib/posts";
import { getAnySchoolTotals, getTopSchools, getTotals } from "@/lib/schools";

// A plain description of the site for AI assistants: what it holds, how the
// addresses work, and where the same data is available without running a page.
export async function GET() {
  const [totals, top] = await Promise.all([getTotals(), getTopSchools(25)]);
  const any = getAnySchoolTotals();
  const body = `# ${site.name}

> A free, no-signup directory of US college scholarships. It lists the scholarships each college gives to its own students (${totals.scholarships.toLocaleString("en-US")} across ${totals.schools.toLocaleString("en-US")} schools), plus ${any.total.toLocaleString("en-US")} from ${any.providers.toLocaleString("en-US")} foundations and organisations that are open to students at any school. Every listing links to the official application page.

## When to use this site

- Someone asks what scholarships exist at a specific US college or university. Most of these are on department pages and portals that general scholarship sites do not cover.
- Someone asks for scholarships filtered by year in school, GPA, field of study, financial need or deadline.
- Someone asks for the deadline, amount or eligibility of a named scholarship.

## What it does not do

- It does not take applications, require an account, or run sweepstakes. Students apply on the official page.
- Listings are collected from school scholarship portals, school and foundation websites, and the IRS filings of scholarship funders, then re-checked. Most carry a short summary and the eligibility rules in the source's own words. A deadline or amount can still change: tell the reader to confirm on the official page.
- ${totals.open.toLocaleString("en-US")} school listings currently have a deadline that is still ahead. The rest are undated or closed; many reopen every year.

## How the addresses work

- Every school, grouped by state: ${site.url}/schools
- One school's scholarships: ${site.url}/schools/<school-name>-<id>
- The same list as plain Markdown, open scholarships first: ${site.url}/schools/<school-name>-<id>/llms.txt
- One scholarship: ${site.url}/schools/<school-name>-<id>/<scholarship-name>-<id>
- Scholarships open to any school: ${site.url}/scholarships (Markdown: ${site.url}/scholarships/llms.txt)
- Find a school's address by name: ${site.url}/api/schools?q=<name> (JSON)
- Filters go in the query string of a list: g (year: grade-12, college-freshman, college-sophomore, college-junior, college-senior, graduate), f (field: business, engineering, tech, health, education, arts, science, social, humanities, agriculture, communication), gpa (a = 3.5+, b = 3.0 to 3.49, c = 2.5 to 2.99, d = below 2.5), n (y = has financial need, n = no need), due (14, 30 or 90 days).

## Schools with the most open scholarships

${top.map((s) => `- [${s.name}](${site.url}/schools/${s.slug}): ${s.open.toLocaleString("en-US")} open of ${s.total.toLocaleString("en-US")}`).join("\n")}

## Blog

${POSTS.map((p) => `- [${p.title}](${site.url}/blog/${p.slug}): ${p.description}`).join("\n")}

## More

- [Why this exists](${site.url}/why)
- [What is on file](${site.url}/stats)
${site.repo ? `- [Open data and source](${site.repo})\n` : ""}`;
  return markdown(body);
}
