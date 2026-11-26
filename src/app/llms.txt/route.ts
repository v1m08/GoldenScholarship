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

## Finding scholarships for one student (start here)

Do not read the HTML list pages for this: their filters run in the browser, so a fetched copy is unfiltered. Use the text lists below, which filter on the server, return ${"`"}text/markdown${"`"} (or JSON), and are paged.

1. If the student attends or will attend a US college, find its address: ${site.url}/api/schools?q=<name> (JSON; each result has ${"`"}slug${"`"} and ${"`"}unitid${"`"}).
2. Fetch that school's list with everything you know about the student in the query string: ${site.url}/schools/<slug>/llms.txt?g=...&f=...&gpa=...&n=...&st=...&me=...
   It returns the school's own scholarships first, then those open to students at any school. Add any=0 for the school's own only.
3. No school, or want only the any-school ones: ${site.url}/scholarships/llms.txt with the same parameters.
4. Follow the "Next page" link in the result until you have enough. Each result states how many match in total.
5. For one scholarship in full (rules in the listing's own words, materials, source): open its Details link, or ${site.url}/api/scholarships?id=<id> (add &school=<unitid> for a school's own).

Example: a Texas junior in computer science, 3.7 GPA, with financial need, a woman and first in her family at college, at Georgia Tech:
${site.url}/schools/georgia-institute-of-technology-main-campus-139755/llms.txt?g=college-junior&f=tech&gpa=3.7&n=y&st=TX&me=w,fg

### Parameters (all optional; leave out what you do not know)

- g: year in school. grade-12, college-freshman, college-sophomore, college-junior, college-senior, graduate. (freshman, sophomore, junior, senior, grad and hs are understood too.)
- f: field of study. business, engineering, tech, health, education, arts, science, social, humanities, agriculture, communication, law, trades. (Common words such as cs, nursing or math are understood.)
- gpa: the student's GPA as a number, e.g. 3.7. Scholarships with a higher minimum are left out.
- n: financial need. y or n. With n, scholarships that require need are left out.
- st: home state, two letters (TX), or zz for outside the US. Scholarships limited to residents of other states are left out.
- me: who the student is, comma-separated: w (woman), m (man), b (Black), h (Hispanic or Latino), na (Native American), a (Asian or Pacific Islander), fg (first in family at college), q (LGBTQ+), d (has a disability), mil (military or veteran family), intl (not a US citizen). Plain words such as woman, first-gen or veteran are understood. Scholarships aimed at these groups rank first; ones limited to a group the student is not in are left out. If you only know part of this, add partial=1 so nothing is left out on a guess. Send me= (empty) to say the student is in none of the groups.
- only=1: only scholarships aimed at the groups in me.
- q: text to find in the scholarship's or provider's name.
- due: only ones closing within this many days, e.g. 30.
- amt=1: only ones that state an amount.
- strict=1: leave out any with a requirement these filters cannot check.
- all=1: also include the ones a stated rule rules out, marked as such.
- status: open (default), undated (no deadline listed) or closed. On a school's list, its own undated scholarships are counted as open.
- sort: match (default once field, need or me is given), soon (soonest deadline) or amount (largest award).
- page: 1, 2, 3... and per: results per page, up to 100 (default 40).
- format=json: the same result as JSON. ${site.url}/api/scholarships?school=<unitid>&... is the same thing, always JSON.

A value that is not understood is ignored and named at the top of the result.

### Reading a result

- "Eligibility" is what the listing states. "Also requires (not checked)" lists stated requirements the filters cannot test, such as membership of a club or a specific high school: check them with the student. "May be limited to" is a guess from the name or provider, not a stated rule.
- "Apply" is the official page. A few listings from tax filings have no link on file.
- Deadlines and amounts are read from official pages and re-checked, but they change. Tell the student to confirm on the official page.

## When to use this site

- Someone asks what scholarships exist at a specific US college or university. Most of these are on department pages and portals that general scholarship sites do not cover.
- Someone asks which scholarships a particular student could apply for, given their year, field, GPA, need, home state or background.
- Someone asks for the deadline, amount or eligibility of a named scholarship.

## What it does not do

- It does not take applications, require an account, or run sweepstakes. Students apply on the official page.
- Listings are collected from school scholarship portals, school and foundation websites, and the IRS filings of scholarship funders, then re-checked. Most carry a short summary and the eligibility rules in the source's own words.
- ${totals.open.toLocaleString("en-US")} school listings currently have a deadline that is still ahead. The rest are undated or closed; many reopen every year.

## Other addresses

- Every school, grouped by state: ${site.url}/schools
- One school's page for people: ${site.url}/schools/<school-name>-<id>
- One scholarship: ${site.url}/schools/<school-name>-<id>/<scholarship-name>-<id>, or ${site.url}/scholarships/<scholarship-name>-<id> for any-school ones
- Every scholarship page: ${site.url}/sitemap-index.xml
${site.repo ? `- Everything as one spreadsheet (CSV with year, field, GPA, need, citizenship and home-state columns; about 37 MB): ${site.repo}/raw/main/data/scholarships.csv\n` : ""}
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
