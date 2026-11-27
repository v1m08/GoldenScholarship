import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { site } from "./config";
import { eligibility, longDate, money, years } from "./describe";
import { pacificToday } from "./day";
import { ABOUT, FIELDS, GPAS, GRADES, NO_FILTERS, STATES, type Filters, type Sort, type Status } from "./profile";
import { decodeRows, filterRows, scholarshipPath, type Row, type Shown } from "./rows";
import type { School } from "./schools";

// The filtered lists as an AI assistant reads them: plain Markdown or JSON,
// worked out on the server from the same exported files and the same
// filterRows() the page runs in the browser. An assistant that knows a
// student's year, field, GPA, need, home state and background gets back only
// what that student could apply for, a page at a time.

export type More = [summary: string, rules: [number, string][], states: string[], materials: string[], awards: number, source: string];

type Loaded = { rows: Row[]; details: Record<string, More> };
const memo = new Map<string, { at: number; data: Promise<Loaded> }>();
const KEEP_MS = 30 * 60_000;

// Each read is scoped to its own folder so only those files ship with the route.
async function readRows(file: string): Promise<Row[]> {
  try {
    return decodeRows(JSON.parse(await readFile(path.join(process.cwd(), "public", "data", file), "utf8")));
  } catch {
    return [];
  }
}

async function readDetails(name: string): Promise<Record<string, More>> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "src/generated/detail", `${name}.json`), "utf8")) as Record<string, More>;
  } catch {
    return {};
  }
}

// One list's rows and what was read from each listing, kept in memory between requests.
function load(collection: number | "open"): Promise<Loaded> {
  const key = String(collection);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.data;
  const files = collection === "open" ? ["any-open.json", "any-rest.json"] : [`s/${collection}.json`];
  const data = Promise.all([Promise.all(files.map(readRows)), readDetails(collection === "open" ? "any" : String(collection))]).then(
    ([lists, details]) => ({ rows: lists.flat(), details }),
  );
  // Keep the any-school list and the most recently asked-for schools, so a
  // crawler paging through one list does not re-read its files every time.
  memo.set(key, { at: Date.now(), data });
  if (memo.size > 40) {
    for (const k of memo.keys()) {
      if (k !== "open") {
        memo.delete(k);
        break;
      }
    }
  }
  return data;
}

// ---- Reading the query string ------------------------------------------------
// Codes are the site's own; the plain words an assistant is likely to try are accepted too.

const norm = (v: string) => v.trim().toLowerCase().replace(/[\s_]+/g, "-");

const GRADE_ALIAS: Record<string, string> = {
  "12": "grade-12", hs: "grade-12", "high-school": "grade-12", "high-school-senior": "grade-12", "hs-senior": "grade-12",
  freshman: "college-freshman", "first-year": "college-freshman", sophomore: "college-sophomore", junior: "college-junior",
  senior: "college-senior", grad: "graduate", masters: "graduate", phd: "graduate", "graduate-student": "graduate",
};
const FIELD_ALIAS: Record<string, string> = {
  cs: "tech", "computer-science": "tech", computing: "tech", it: "tech", "data-science": "tech", nursing: "health",
  medicine: "health", "pre-med": "health", math: "science", biology: "science", chemistry: "science", physics: "science",
  music: "arts", art: "arts", design: "arts", teaching: "education", psychology: "social", "social-sciences": "social",
  english: "humanities", history: "humanities", journalism: "communication", media: "communication", "pre-law": "law",
  finance: "business", accounting: "business", economics: "business", undecided: "other",
};
const ME_ALIAS: Record<string, string> = {
  woman: "w", women: "w", female: "w", man: "m", men: "m", male: "m", black: "b", "african-american": "b",
  hispanic: "h", latino: "h", latina: "h", latinx: "h", native: "na", "native-american": "na", indigenous: "na",
  asian: "a", "pacific-islander": "a", aapi: "a", "first-gen": "fg", "first-generation": "fg", lgbtq: "q", "lgbtq+": "q",
  disability: "d", disabled: "d", military: "mil", veteran: "mil", international: "intl", "non-citizen": "intl",
  daca: "intl", undocumented: "intl",
};
const STATE_BY_NAME = new Map(STATES.map(([code, name]) => [norm(name), code]));

export type Query = {
  filters: Filters;
  page: number;
  per: number;
  format: "md" | "json";
  // On a school's list: also include scholarships open to any school.
  withAny: boolean;
  // Values that were not understood, said back so the caller can fix them.
  ignored: string[];
};

export function parseQuery(sp: URLSearchParams): Query {
  const ignored: string[] = [];
  const raw = (k: string) => sp.get(k)?.trim() ?? "";
  const bad = (k: string, valid: string) => ignored.push(`${k}=${raw(k)} (use ${valid})`);
  const flag = (k: string) => /^(1|true|yes|y)$/i.test(raw(k));

  let g = "";
  if (raw("g")) {
    const v = norm(raw("g"));
    g = GRADES.some((o) => o.v === v) ? v : (GRADE_ALIAS[v] ?? "");
    if (!g) bad("g", GRADES.map((o) => o.v).join(", "));
  }

  let f = "";
  if (raw("f")) {
    const v = norm(raw("f"));
    f = FIELDS.some((o) => o.v === v) ? v : (FIELD_ALIAS[v] ?? "");
    if (!f) bad("f", FIELDS.map((o) => o.v).join(", "));
    if (f === "other") f = "";
  }

  let gpa = "";
  if (raw("gpa")) {
    const v = raw("gpa").toLowerCase();
    const n = Number(v);
    if (["a", "b", "c", "d"].includes(v)) gpa = v;
    else if (Number.isFinite(n) && n > 0 && n <= 5) gpa = n >= 3.5 ? "a" : n >= 3 ? "b" : n >= 2.5 ? "c" : "d";
    else if (v !== "x") bad("gpa", "a number such as 3.7, or a, b, c, d");
  }

  let n = "";
  if (raw("n")) {
    const v = raw("n").toLowerCase();
    if (/^(y|yes|true|1)$/.test(v)) n = "y";
    else if (/^(n|no|false|0)$/.test(v)) n = "n";
    else if (v !== "u") bad("n", "y or n");
  }

  let st = "";
  if (raw("st")) {
    const v = raw("st");
    const code = v.toUpperCase();
    if (STATES.some(([c]) => c === code)) st = code;
    else if (STATE_BY_NAME.has(norm(v))) st = STATE_BY_NAME.get(norm(v))!;
    else if (/^(zz|intl|international|outside-us)$/i.test(norm(v))) st = "zz";
    else bad("st", "a two-letter US state code, or zz for outside the US");
  }

  // "About the student". Accepts `me` or `about`.
  const meKey = sp.has("me") ? "me" : sp.has("about") ? "about" : "";
  const me: string[] = [];
  for (const part of meKey ? raw(meKey).split(/[,;|]/) : []) {
    const v = norm(part);
    if (!v) continue;
    const code = ABOUT.some((a) => a.v === v) ? v : ME_ALIAS[v];
    if (code) me.push(code);
    else ignored.push(`${meKey}=${part.trim()} (use ${ABOUT.map((a) => a.v).join(", ")})`);
  }

  let due = "";
  if (raw("due")) {
    const d = Number(raw("due"));
    if (Number.isInteger(d) && d >= 1 && d <= 730) due = String(d);
    else bad("due", "a number of days, 1 to 730");
  }

  let status: Status = "open";
  if (raw("status")) {
    const v = raw("status").toLowerCase();
    if (v === "open" || v === "undated" || v === "closed") status = v;
    else bad("status", "open, undated or closed");
  }

  let sort: Sort = f || n === "y" || me.length ? "match" : "soon";
  if (raw("sort")) {
    const v = raw("sort").toLowerCase();
    if (v === "match" || v === "soon" || v === "amount") sort = v;
    else bad("sort", "match, soon or amount");
  }

  const page = Math.max(1, Math.floor(Number(raw("page")) || 1));
  const per = Math.min(100, Math.max(1, Math.floor(Number(raw("per")) || 40)));

  return {
    filters: {
      ...NO_FILTERS,
      g,
      f,
      gpa,
      n,
      st,
      q: raw("q").slice(0, 60),
      due,
      amt: flag("amt"),
      me: [...new Set(me)].join(","),
      only: flag("only"),
      // Saying who the student is counts as the whole answer, so a scholarship limited to a
      // group they did not name is left out. `partial=1` keeps those in, with a warning on each.
      asked: Boolean(meKey) && !flag("partial"),
      strict: flag("strict"),
      loose: flag("all"),
      status,
      sort,
    },
    page,
    per,
    format: raw("format").toLowerCase() === "json" ? "json" : "md",
    withAny: raw("any") !== "0",
    ignored,
  };
}

// The same filters as a query string, for links to other pages of the result.
function queryString(q: Query, page: number): string {
  const f = q.filters;
  const p = new URLSearchParams();
  if (f.g) p.set("g", f.g);
  if (f.f) p.set("f", f.f);
  if (f.gpa) p.set("gpa", f.gpa);
  if (f.n) p.set("n", f.n);
  if (f.st) p.set("st", f.st);
  if (f.me || f.asked) p.set("me", f.me);
  if (f.me && !f.asked) p.set("partial", "1");
  if (f.only) p.set("only", "1");
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.due) p.set("due", f.due);
  if (f.amt) p.set("amt", "1");
  if (f.strict) p.set("strict", "1");
  if (f.loose) p.set("all", "1");
  if (f.status !== "open") p.set("status", f.status);
  p.set("sort", f.sort);
  if (q.per !== 40) p.set("per", String(q.per));
  if (!q.withAny) p.set("any", "0");
  if (q.format === "json") p.set("format", "json");
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

// ---- Running a list ----------------------------------------------------------

export type Item = {
  id: string;
  name: string;
  // "school": only for students at this school. "any": open to students at any school.
  scope: "school" | "any";
  summary: string | null;
  deadline: string | null;
  days_left: number | null;
  status: Status;
  award: string | null;
  award_min: number | null;
  award_max: number | null;
  per_year: boolean;
  renewable: boolean;
  offered_by: string | null;
  // What the listing states about who can apply, as sentences.
  eligibility: string[];
  years: string | null;
  min_gpa: number | null;
  need: "required" | "considered" | null;
  essay: boolean;
  home_states: string[];
  // Stated requirements the filters could not check: confirm these with the student.
  requires: string[];
  // Guesses from the name or the provider, not stated rules.
  may_be_limited_to: string[];
  // Why this ranks for this student.
  fits_because: string[];
  apply_url: string | null;
  details_url: string;
  last_checked: string | null;
};

export type ListResult = {
  title: string;
  list_url: string;
  filters: Record<string, string>;
  ignored: string[];
  total: number;
  counts: Record<Status, number>;
  ruled_out: number;
  page: number;
  pages: number;
  per: number;
  next: string | null;
  prev: string | null;
  items: Item[];
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

function toItem(r: Shown, base: string, anyBase: string, today: string, details: Record<string, More>): Item {
  const stated: Status = !r.deadline ? "undated" : r.deadline >= today ? "open" : "closed";
  return {
    id: r.id,
    name: r.name,
    scope: base === anyBase || r.any ? "any" : "school",
    summary: details[r.id]?.[0] ? clip(details[r.id][0], 320) : null,
    deadline: r.deadline || null,
    days_left: stated === "open" ? dayDiff(r.deadline, today) : null,
    status: stated,
    award: money(r),
    award_min: r.awardMin || null,
    award_max: r.awardMax || null,
    per_year: r.perYear,
    renewable: r.renewable,
    offered_by: r.provider || null,
    eligibility: eligibility(r),
    years: years(r),
    min_gpa: r.minGpa || null,
    need: r.need === "r" ? "required" : r.need === "c" ? "considered" : null,
    essay: r.essay,
    home_states: r.states ? r.states.split(" ") : [],
    requires: r.needs.filter((n) => !n.startsWith("~")),
    may_be_limited_to: r.needs.filter((n) => n.startsWith("~")).map((n) => n.slice(1).replace(/^may be limited to /, "")),
    fits_because: r.reasons,
    apply_url: r.url || null,
    details_url: `${site.url}${scholarshipPath(r.any ? anyBase : base, r)}`,
    last_checked: r.checked || null,
  };
}

const label = (options: { v: string; label: string }[], v: string) => options.find((o) => o.v === v)?.label ?? v;

function describeFilters(f: Filters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.g) out.g = `${f.g} (${label(GRADES, f.g)})`;
  if (f.f) out.f = `${f.f} (${label(FIELDS, f.f)})`;
  if (f.gpa) out.gpa = `${f.gpa} (${label(GPAS, f.gpa)})`;
  if (f.n) out.n = f.n === "y" ? "y (has financial need)" : "n (no financial need)";
  if (f.st) out.st = f.st === "zz" ? "zz (lives outside the US)" : `${f.st} (home state)`;
  if (f.me) out.me = `${f.me} (${f.me.split(",").map((c) => label(ABOUT, c)).join(", ")})`;
  else if (f.asked) out.me = "(none of the groups)";
  if (f.only) out.only = "1 (only ones aimed at those groups)";
  if (f.q.trim()) out.q = f.q.trim();
  if (f.due) out.due = `${f.due} (closes within ${f.due} days)`;
  if (f.amt) out.amt = "1 (states an amount)";
  if (f.strict) out.strict = "1 (no requirement left unchecked)";
  if (f.loose) out.all = "1 (also shows ones a stated rule rules out)";
  out.status = f.status;
  out.sort = f.sort;
  return out;
}

/** A filtered, paged list: one school's (with the any-school ones after its own), or the any-school list. */
export async function runList(school: School | null, q: Query, route: string): Promise<ListResult> {
  const anyBase = "/scholarships";
  const base = school ? `/schools/${school.slug}` : anyBase;
  const today = pacificToday();

  const [own, any] = await Promise.all([
    school ? load(school.unitid) : null,
    !school || q.withAny ? load("open") : null,
  ]);
  const rows: Row[] = own ? [...own.rows, ...(any ? any.rows.map((r) => ({ ...r, any: true })) : [])] : any!.rows;
  const details = own && any ? { ...any.details, ...own.details } : (own ?? any!).details;

  const ctx = school ? { school: school.name, fourYear: school.level === "four-year", merge: true } : {};
  const result = filterRows(rows, q.filters, [], today, q.page * q.per, ctx);
  const pages = Math.max(1, Math.ceil(result.total / q.per));
  const shown = result.rows.slice((q.page - 1) * q.per);
  const link = (page: number) => `${site.url}${route}?${queryString(q, page)}`;

  return {
    title: school ? `Scholarships at ${school.name}` : "Scholarships open to students at any school",
    list_url: `${site.url}${base}`,
    filters: describeFilters(q.filters),
    ignored: q.ignored,
    total: result.total,
    counts: result.counts,
    ruled_out: result.hidden ?? 0,
    page: q.page,
    pages,
    per: q.per,
    next: q.page < pages ? link(q.page + 1) : null,
    prev: q.page > 1 ? link(q.page - 1) : null,
    items: shown.map((r) => toItem(r, base, anyBase, today, details)),
  };
}

// ---- Writing it out ----------------------------------------------------------

const num = (n: number) => n.toLocaleString("en-US");

function itemMarkdown(it: Item, position: number, school: School | null): string {
  const lines = [`### ${position}. ${it.name}`];
  if (it.summary) lines.push(it.summary);
  if (school) lines.push(`- Scope: ${it.scope === "school" ? `only at ${school.name}` : "open to students at any school"}`);
  lines.push(
    `- Deadline: ${it.deadline ? `${longDate(it.deadline)}${it.days_left !== null ? ` (${it.days_left} days left)` : " (passed)"}` : "not listed"}`,
  );
  if (it.award) lines.push(`- Award: ${it.award}${it.renewable ? ", renewable" : ""}`);
  if (it.offered_by) lines.push(`- From: ${it.offered_by}`);
  if (it.eligibility.length) lines.push(`- Eligibility: ${it.eligibility.join(" ")}`);
  if (it.requires.length) lines.push(`- Also requires (not checked): ${it.requires.join("; ")}`);
  if (it.may_be_limited_to.length) lines.push(`- May be limited to: ${it.may_be_limited_to.join("; ")}`);
  if (it.fits_because.length) lines.push(`- Fits because: ${it.fits_because.join(", ")}`);
  lines.push(`- Apply: ${it.apply_url ?? "no official link on file; search the name and provider"}`);
  lines.push(`- Details: ${it.details_url}`);
  return lines.join("\n");
}

export function listMarkdown(r: ListResult, school: School | null): string {
  const applied = Object.entries(r.filters)
    .filter(([k]) => k !== "status" && k !== "sort")
    .map(([k, v]) => `${k}=${v}`);
  const first = (r.page - 1) * r.per + 1;
  const tab = r.filters.status as Status;
  const others = (["open", "undated", "closed"] as Status[])
    .filter((s) => s !== tab && r.counts[s] > 0)
    .map((s) => `${num(r.counts[s])} ${s === "undated" ? "with no deadline listed" : s} (add status=${s})`);
  const head = [
    `# ${r.title}`,
    "",
    `Source: ${site.name} (${r.list_url}). Listings are collected from official pages and re-checked, but a deadline or amount can change: confirm on the official page before applying.`,
    "",
    `- Filters applied: ${applied.length ? applied.join("; ") : "none"}`,
    ...(r.ignored.length ? [`- Not understood and ignored: ${r.ignored.join("; ")}`] : []),
    `- Matches: ${num(r.total)} ${tab === "open" ? (school ? "open now, counting this school's own with no deadline listed" : "with a deadline still ahead") : tab === "undated" ? "with no deadline listed" : "already closed"}`,
    ...(others.length ? [`- Also matching: ${others.join("; ")}`] : []),
    ...(r.ruled_out ? [`- Left out: ${num(r.ruled_out)} that a stated rule rules out for this student (add all=1 to see them)`] : []),
    `- Order: ${r.filters.sort === "match" ? "best match first" : r.filters.sort === "amount" ? "largest award first" : "soonest deadline first"}${school ? "; this school's own scholarships before those open to any school" : ""}`,
    `- Showing: ${r.items.length ? `${num(first)} to ${num(first + r.items.length - 1)}` : "none"} of ${num(r.total)} (page ${r.page} of ${r.pages})`,
    ...(r.next ? [`- Next page: ${r.next}`] : []),
    ...(r.prev ? [`- Previous page: ${r.prev}`] : []),
    `- Same result as JSON: add format=json. All parameters: ${site.url}/llms.txt`,
  ];
  const body = r.items.length
    ? r.items.map((it, i) => itemMarkdown(it, first + i, school)).join("\n\n")
    : "No scholarships match. Remove a filter, or try status=undated for ones with no deadline listed.";
  return `${head.join("\n")}\n\n${body}\n`;
}

/** Answers a list request as Markdown or JSON, whichever was asked for. */
export async function listResponse(request: Request, school: School | null, route: string): Promise<Response> {
  const q = parseQuery(new URL(request.url).searchParams);
  const result = await runList(school, q, route);
  const headers = { "cache-control": "public, max-age=600, s-maxage=3600", "access-control-allow-origin": "*" };
  if (q.format === "json") {
    const body = { source: site.name, note: "Confirm every detail on the official page before applying.", school: school ? { name: school.name, id: school.unitid, state: school.state } : null, ...result };
    return Response.json(body, { headers });
  }
  return new Response(listMarkdown(result, school), { headers: { ...headers, "content-type": "text/markdown; charset=utf-8" } });
}

/** One scholarship in full, by id. Looks in the school's list when one is given, then the any-school list. */
export async function findOne(id: string, school: School | null) {
  const today = pacificToday();
  for (const from of school ? [school, null] : [null]) {
    const { rows, details } = await load(from ? from.unitid : "open");
    const row = rows.find((r) => r.id === id);
    if (!row) continue;
    const base = from ? `/schools/${from.slug}` : "/scholarships";
    const more = details[id];
    const item = toItem({ ...row, reasons: [], needs: [] }, base, "/scholarships", today, details);
    return {
      ...item,
      summary: more?.[0] || null,
      school: from ? { name: from.name, id: from.unitid } : null,
      rules_in_the_listings_words: (more?.[1] ?? []).map(([required, text]) => ({ required: required === 1, text })),
      materials: more?.[3] ?? [],
      number_of_awards: more?.[4] || null,
      source: more?.[5] || null,
      field_limits: row.fieldGate || null,
      limited_to_groups: row.must || null,
      limited_to_colleges: row.colleges ? row.colleges.split("|") : [],
      other_requirements: row.extra || null,
    };
  }
  return null;
}
