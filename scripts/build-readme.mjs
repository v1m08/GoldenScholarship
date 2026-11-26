// Builds the public listing from Supabase:
//   README.md                      what this is, plus what closes soonest
//   directory/README.md            every school, by state
//   directory/<ST>/<school>.md     one school's open scholarships
//   data/scholarships.csv          everything, for spreadsheets and scripts
//
// Run: npm run readme   (needs SUPABASE_URL and SUPABASE_SECRET_KEY)

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
// Where the live site is. Falls back to the real domain when the variable is unset.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const LIVE = SITE && !SITE.includes("localhost") ? SITE : "https://goldenscholarship.com";

if (!URL_BASE || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  process.exit(1);
}

const README_ROWS = 100; // rows in the "closing soon" table
const README_SCHOOLS = 60; // schools in the README's own table
const FILE_ROWS = 1500; // most rows in one school file

async function get(pathAndQuery, attempt = 0) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (res.ok) return res.json();
  // The database can time out on a cold start; try again before giving up.
  if (attempt < 3) {
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    return get(pathAndQuery, attempt + 1);
  }
  throw new Error(`${res.status} ${await res.text()}`);
}

// Reads a whole table by walking forward from the last key seen, which stays
// fast however deep it goes (unlike a growing offset).
async function readAll(table, columns, key, filter = "") {
  const out = [];
  let last = null;
  for (;;) {
    const after = last === null ? "" : `&${key}=gt.${encodeURIComponent(last)}`;
    const rows = await get(`${table}?select=${columns}${filter}${after}&order=${key}&limit=1000`);
    out.push(...rows);
    if (rows.length < 1000) return out;
    last = rows[rows.length - 1][key];
    if (process.stdout.isTTY) process.stdout.write(`\r${table}: ${out.length.toLocaleString()} rows`);
  }
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^the-/, "");

// Must match slugFor() in src/lib/schools.ts so links land on the right page.
const siteSlug = (s) => `${slugify(s.name)}-${s.unitid}`;

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const csv = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtMoney = (r) => {
  const f = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  if (r.award_min && r.award_max && r.award_min !== r.award_max) return `${f(r.award_min)}–${f(r.award_max)}`;
  const one = r.award_max ?? r.award_min;
  return one ? f(one) : "";
};
const link = (r) => (r.url ? `[${cell(r.name)}](${r.url})` : cell(r.name));

const today = new Date().toISOString().slice(0, 10);

console.log("Reading schools and scholarships…");
const schools = await readAll("schools", "unitid,name,city,state", "unitid");
const rows = await readAll(
  "scholarships",
  "id,name,provider_name,scope,url,apply_url,deadline,award_min,award_max,award_per_year,renewable,school_unitid,grade_levels,fields_of_study,minimum_gpa,need,citizenship,required_states,essay,source,checked_at",
  "id",
  "&status=neq.archived",
);
console.log(`\n${schools.length.toLocaleString()} schools, ${rows.length.toLocaleString()} scholarships`);

const byId = new Map(schools.map((s) => [s.unitid, { ...s, open: [], undated: [], closed: 0 }]));
// Scholarships from foundations and organisations, not tied to one school.
const anySchool = rows.filter((r) => r.school_unitid === null);
const anyOpen = anySchool.filter((r) => r.deadline && r.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline));
const anyUndated = anySchool.filter((r) => !r.deadline).sort((a, b) => (a.provider_name ?? "").localeCompare(b.provider_name ?? "") || a.name.localeCompare(b.name));
const providers = new Set(anySchool.map((r) => r.provider_name)).size;
for (const r of rows) {
  const s = byId.get(r.school_unitid);
  if (!s) continue;
  if (!r.deadline) s.undated.push(r);
  else if (r.deadline >= today) s.open.push(r);
  else s.closed += 1;
}
const covered = [...byId.values()].filter((s) => s.open.length + s.undated.length + s.closed > 0);
for (const s of covered) {
  s.open.sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name));
  s.undated.sort((a, b) => a.name.localeCompare(b.name));
  s.file = `directory/${s.state ?? "XX"}/${slugify(s.name)}-${s.unitid}.md`;
}
const totalOpen = covered.reduce((n, s) => n + s.open.length, 0);

await rm("directory", { recursive: true, force: true });
await mkdir("data", { recursive: true });

// ---- one file per school ----------------------------------------------------
for (const s of covered) {
  const listed = [...s.open, ...s.undated];
  const shown = listed.slice(0, FILE_ROWS);
  const lines = [
    `# ${s.name} scholarships`,
    "",
    `${[s.city, s.state].filter(Boolean).join(", ")} · ${s.open.length.toLocaleString()} open · ${s.undated.length.toLocaleString()} with no date listed · ${s.closed.toLocaleString()} closed (not shown)`,
    "",
    LIVE ? `**[Filter and save these on the site](${LIVE}/schools/${siteSlug(s)})**` : "",
    "",
    "| Scholarship | Amount | Deadline |",
    "| --- | --- | --- |",
    ...shown.map((r) => `| ${link(r)} | ${fmtMoney(r)} | ${r.deadline ? fmtDate(r.deadline) : "not listed"} |`),
    "",
    listed.length > shown.length ? `Showing the first ${shown.length.toLocaleString()} of ${listed.length.toLocaleString()}. The rest are in [data/scholarships.csv](../../data/scholarships.csv).` : "",
    "",
    `Every link goes to the school's own page. Confirm details there before you apply. [Back to all schools](../README.md)`,
    "",
  ];
  await mkdir(path.dirname(s.file), { recursive: true });
  await writeFile(s.file, lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n"));
}

// ---- scholarships open to any school -----------------------------------------
{
  const shownUndated = anyUndated.slice(0, 3000);
  const lines = [
    "# Open to students at any school",
    "",
    `${anySchool.length.toLocaleString()} scholarships from ${providers.toLocaleString()} foundations and organisations · ${anyOpen.length.toLocaleString()} open with a date · ${anyUndated.length.toLocaleString()} with no date listed`,
    "",
    "Many are for one town, county or state. Use your browser's find (Ctrl or Cmd + F) to search for yours.",
    "",
    LIVE ? `**[Filter and save these on the site](${LIVE}/scholarships)**\n` : "",
    "## Open now",
    "",
    "| Scholarship | From | Amount | Deadline |",
    "| --- | --- | --- | --- |",
    ...anyOpen.map((r) => `| ${link(r)} | ${cell(r.provider_name)} | ${fmtMoney(r)} | ${fmtDate(r.deadline)} |`),
    "",
    "## No date listed",
    "",
    "| Scholarship | From | Amount |",
    "| --- | --- | --- |",
    ...shownUndated.map((r) => `| ${link(r)} | ${cell(r.provider_name)} | ${fmtMoney(r)} |`),
    "",
    anyUndated.length > shownUndated.length ? `Showing the first ${shownUndated.length.toLocaleString()} of ${anyUndated.length.toLocaleString()}. The rest are in [data/scholarships.csv](../data/scholarships.csv).` : "",
    "",
    "[Back to all schools](README.md)",
    "",
  ];
  await mkdir("directory", { recursive: true });
  await writeFile("directory/any-school.md", lines.join("\n"));
}

// ---- directory index, by state ----------------------------------------------
const states = [...new Set(covered.map((s) => s.state ?? "XX"))].sort();
const index = [
  "# Every school we have",
  "",
  `${covered.length.toLocaleString()} schools · ${totalOpen.toLocaleString()} scholarships open now · updated ${fmtDate(today)}`,
  "",
  `Not tied to a school: **[${anySchool.length.toLocaleString()} open to students anywhere](any-school.md)**`,
  "",
  states.map((st) => `[${st}](#${st.toLowerCase()})`).join(" · "),
  "",
];
for (const st of states) {
  const list = covered.filter((s) => (s.state ?? "XX") === st).sort((a, b) => b.open.length - a.open.length || a.name.localeCompare(b.name));
  index.push(`## ${st}`, "", "| School | Open | No date |", "| --- | ---: | ---: |");
  for (const s of list) index.push(`| [${cell(s.name)}](${s.file.replace("directory/", "")}) | ${s.open.length.toLocaleString()} | ${s.undated.length.toLocaleString()} |`);
  index.push("");
}
await writeFile("directory/README.md", index.join("\n"));

// ---- CSV of everything ------------------------------------------------------
// One row per scholarship, with what each listing states about who can apply.
// Lists inside a cell are separated by ";". An empty cell means "not stated".
// Each one's page on the site is at /api/scholarships?id=<id> (add &school=<school_id> for a school's own).
const csvLines = [
  "id,scholarship,school,school_id,state,offered_by,amount_min,amount_max,per_year,renewable,deadline,years,fields_of_study,minimum_gpa,financial_need,citizenship,home_states,essay,apply_url,source,last_checked",
];
const many = (v) => (Array.isArray(v) ? v.join(";") : (v ?? ""));
const yes = (v) => (v === true ? "yes" : v === false ? "no" : "");
for (const r of rows) {
  const s = byId.get(r.school_unitid);
  csvLines.push(
    [
      r.id, r.name, s?.name ?? "any school", r.school_unitid, s?.state, r.provider_name, r.award_min, r.award_max,
      yes(r.award_per_year), yes(r.renewable), r.deadline, many(r.grade_levels), many(r.fields_of_study), r.minimum_gpa,
      r.need, many(r.citizenship), many(r.required_states), yes(r.essay), r.apply_url || r.url, r.source,
      (r.checked_at ?? "").slice(0, 10),
    ]
      .map(csv)
      .join(","),
  );
}
await writeFile("data/scholarships.csv", csvLines.join("\n") + "\n");

// ---- README -----------------------------------------------------------------
// Soonest deadlines, at most three per school so one portal does not fill the table.
const perSchool = new Map();
const closing = [];
for (const r of rows.filter((r) => r.school_unitid !== null && r.deadline && r.deadline > today).sort((a, b) => a.deadline.localeCompare(b.deadline))) {
  const n = perSchool.get(r.school_unitid) ?? 0;
  if (n >= 3) continue;
  perSchool.set(r.school_unitid, n + 1);
  closing.push(r);
  if (closing.length >= README_ROWS) break;
}
const top = [...covered].sort((a, b) => b.open.length - a.open.length).slice(0, README_SCHOOLS);

const badge = (label, color, logo, logoColor = "white") =>
  `<img alt="${label}" src="https://img.shields.io/badge/${encodeURIComponent(label).replace(/-/g, "--")}-${color}?style=for-the-badge&logo=${logo}&logoColor=${logoColor}" />`;
const BADGES = [
  badge("Next.js 16", "000000", "nextdotjs"),
  badge("React 19", "20232a", "react", "61dafb"),
  badge("TypeScript", "3178c6", "typescript"),
  badge("Tailwind CSS 4", "0f172a", "tailwindcss", "38bdf8"),
  badge("Supabase", "1c1c1c", "supabase", "3ecf8e"),
  badge("PostHog", "1d4aff", "posthog"),
  badge("Vercel", "000000", "vercel"),
].join("\n  ");
const stat = (n, label) => `<td align="center"><b>${n.toLocaleString()}</b><br /><sub>${label}</sub></td>`;

const readme = `<div align="center">
  <img src="src/app/icon.svg" alt="Penny, the GoldenScholarship mascot" width="96" height="96" />

  <h1>GoldenScholarship</h1>

  <p><b>The scholarships worth applying to.</b><br />
  A free, open directory of the scholarships US colleges give their own students,<br />
  plus the ones open to students at any school. No account, no sponsored listings.</p>

  ${BADGES}

  <p>
    <a href="${LIVE}"><b>Use the site</b></a> ·
    <a href="directory/README.md">Browse by school</a> ·
    <a href="directory/any-school.md">Open to any school</a> ·
    <a href="data/scholarships.csv">Download the data</a> ·
    <a href="../../issues/new">Report a problem</a>
  </p>

  <table>
    <tr>
      ${stat(rows.length, "scholarships")}
      ${stat(covered.length, "schools")}
      ${stat(providers, "foundations")}
      ${stat(totalOpen + anyOpen.length, "open right now")}
    </tr>
  </table>

  <sub>Listings updated ${fmtDate(today)}. This page, the directory and the spreadsheet are rebuilt from the database every day.</sub>
</div>

## Contents

- [Why this exists](#why-this-exists)
- [What you get](#what-you-get)
- [Closing soon](#closing-soon)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Run it yourself](#run-it-yourself)
- [Project layout](#project-layout)
- [Contributing](#contributing)

## Why this exists

Most scholarship sites list the same national awards under every school's name. The ones you can actually win are usually smaller and closer to home: a department award, a donor fund, a local foundation. They sit on pages nobody links to, inside a school's application portal, or in a foundation's tax filing.

GoldenScholarship collects those into one list, with deadlines, amounts and a direct link to the official page for each one.

## What you get

- **Your school's own scholarships.** Type a school and see what it gives out, with its own awards listed first.
- **Scholarships open to any school.** ${anySchool.length.toLocaleString()} from community foundations and organisations.
- **Filters that hide what you can't apply for.** Five quick questions (year, field, GPA, need, and anything else about you) remove the ones that don't fit. Requirements we can't check are shown as labels on the listing.
- **No account.** Answers stay in your browser. Leaving an email for updates is optional.
- **No sponsored listings.** Nothing is ranked by who paid.
- **Open data.** Every listing is in [one spreadsheet](data/scholarships.csv) and in the [directory](directory/README.md) in this repository.
- **Readable by search engines and AI assistants.** Each scholarship has its own page with structured data, and the site publishes \`llms.txt\` files and sitemaps.

## Closing soon

<details open>
<summary><b>At a school</b> (soonest ${closing.length} deadlines, at most three per school)</summary>

| Scholarship | School | Amount | Deadline |
| --- | --- | --- | --- |
${closing
  .map((r) => {
    const s = byId.get(r.school_unitid);
    return `| ${link(r)} | [${cell(s.name)}](${s.file}) | ${fmtMoney(r)} | ${fmtDate(r.deadline)} |`;
  })
  .join("\n")}

</details>

<details>
<summary><b>Open to any school</b></summary>

| Scholarship | From | Amount | Deadline |
| --- | --- | --- | --- |
${anyOpen
  .filter((r) => r.deadline > today)
  .slice(0, 40)
  .map((r) => `| ${link(r)} | ${cell(r.provider_name)} | ${fmtMoney(r)} | ${fmtDate(r.deadline)} |`)
  .join("\n")}

[All ${anySchool.length.toLocaleString()} open to any school →](directory/any-school.md)

</details>

<details>
<summary><b>Schools with the most open right now</b></summary>

| School | State | Open |
| --- | --- | ---: |
${top.map((s) => `| [${cell(s.name)}](${s.file}) | ${s.state ?? ""} | ${s.open.length.toLocaleString()} |`).join("\n")}

</details>

[All ${covered.length.toLocaleString()} schools →](directory/README.md)

## How it works

\`\`\`mermaid
flowchart LR
  A[School portals and pages<br/>Foundation websites<br/>IRS filings] -->|collector, separate repository| B[(Supabase)]
  B -->|npm run data, before every build| C[Static listing files]
  C --> D[Prebuilt pages on Vercel]
  D -->|filters run in the browser| E[Student]
  B -->|npm run readme, daily| F[This README, directory and spreadsheet]
\`\`\`

The site never queries the database while someone is browsing. Before each build, \`npm run data\` exports every listing into static files; the pages are built from those, and all filtering happens in the browser. The only requests that reach the database at runtime are the three small forms: email signup, problem reports, and searches that found nothing.

The data is early. Deadlines and amounts come straight from each listing and can be wrong or out of date, so check the official page before you apply.

## Tech stack

| Layer | What we use |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, cache components, Turbopack) with [React 19](https://react.dev) |
| Language | [TypeScript](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Data | [Supabase](https://supabase.com) (Postgres), exported to static JSON at build time |
| Analytics | [PostHog](https://posthog.com), proxied through the site; optional |
| Hosting | [Vercel](https://vercel.com) |
| Automation | GitHub Actions, for the daily listing update |

## Run it yourself

You need Node.js 22.9 or newer and a Supabase project that holds the scholarship tables.

\`\`\`bash
git clone https://github.com/v1m08/GoldenScholarships.git
cd GoldenScholarships
npm install
cp .env.example .env.local   # then fill in the values below
npm run data                 # exports the listings the site reads
npm run dev                  # http://localhost:3000
\`\`\`

Run [\`supabase/setup.sql\`](supabase/setup.sql) once in the Supabase SQL editor to create the tables the site writes to.

### Environment variables

| Variable | Needed | What it is |
| --- | --- | --- |
| \`SUPABASE_URL\` | Yes | Your Supabase project address |
| \`SUPABASE_SECRET_KEY\` | Yes | Server-only key. It is never sent to the browser |
| \`NEXT_PUBLIC_POSTHOG_KEY\` | No | Leave empty to run without analytics |
| \`POSTHOG_REGION\` | No | \`us\` or \`eu\`, matching the PostHog project |
| \`NEXT_PUBLIC_SITE_URL\` | In production | The site's address, used for sitemaps, canonical links and share cards |
| \`NEXT_PUBLIC_REPO_URL\` | No | Shows a GitHub link on the site |

### Commands

| Command | What it does |
| --- | --- |
| \`npm run dev\` | Starts the site locally |
| \`npm run data\` | Exports the listings from the database into static files |
| \`npm run build\` | Runs the export, then builds the production site |
| \`npm run readme\` | Rebuilds this page, \`directory/\` and \`data/scholarships.csv\` |
| \`npm run lint\` | Checks the code |

## Project layout

\`\`\`text
src/app/           pages and routes: home, schools, scholarships, stats, why, blog
src/components/    the search, the question flow, the filterable list, Penny
src/lib/           filtering rules, questions, data loading, share cards
scripts/           build-data.mjs (site export) and build-readme.mjs (this page)
supabase/          setup.sql for the tables the site writes to
directory/         every school's open scholarships as Markdown, by state
data/              scholarships.csv, everything in one file
\`\`\`

## Contributing

- **Found a mistake, or is your school missing?** [Open an issue](../../issues/new) with the school and the link. Missing schools are collected in the order people ask for them.
- **Want to change the site?** Fork the repository, make the change on a branch and open a pull request. Run \`npm run lint\` and \`npm run build\` first.
- **Do not edit \`README.md\`, \`directory/\` or \`data/\` by hand.** They are generated; change \`scripts/build-readme.mjs\` instead.

<div align="center">
  <sub>Built by students who have been through it. Every link goes to the official page. No signup, no sweepstakes.</sub>
</div>
`;
await writeFile("README.md", readme);

console.log(`Wrote README.md, directory/ (${covered.length.toLocaleString()} schools) and data/scholarships.csv`);
