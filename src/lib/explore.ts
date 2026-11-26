import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { PAGE_SIZE } from "./config";
import { NO_FILTERS, REPORT_KINDS, type Profile, type Status } from "./profile";
import { decodeRows, filterRows, idFromSlug, type Result, type Row } from "./rows";
import { db } from "./supabase";

// Which list: one school's own scholarships (its id), or "open": those from
// foundations and organisations, open to students at any school.
export type Collection = number | "open";

// The static files a list is loaded from, first screen first.
export function sourcesFor(collection: Collection): string[] {
  return collection === "open" ? ["/data/any-open.json", "/data/any-rest.json"] : [`/data/s/${collection}.json`];
}

// Reads one exported data file from disk. Missing files mean "nothing here".
async function readRows(file: string): Promise<Row[]> {
  try {
    return decodeRows(JSON.parse(await readFile(path.join(process.cwd(), "public", file), "utf8")));
  } catch {
    return [];
  }
}

/**
 * The first screen of a list, worked out on the server so the page arrives
 * with scholarships already in it (for speed, and for search engines). It
 * opens on the first tab that has anything. Everything after this first
 * screen is filtered in the browser from the same exported files.
 */
export async function getInitialList(collection: Collection): Promise<Result & { status: Status }> {
  "use cache";
  // The files behind this only change with a deployment, so keep the result
  // until the next one. Refreshing by the hour made every school page get
  // rebuilt and stored again each day as the date moved.
  cacheLife("max");
  const rows = (await Promise.all(sourcesFor(collection).map(readRows))).flat();
  const today = new Date().toISOString().slice(0, 10);
  // A school's own undated scholarships are shown with its open ones.
  const ctx = { merge: collection !== "open" };
  const first = filterRows(rows, NO_FILTERS, [], today, PAGE_SIZE, ctx);
  const status = (["open", "undated", "closed"] as Status[]).find((s) => first.counts[s] > 0) ?? "open";
  if (status === "open") return { ...first, status };
  return { ...filterRows(rows, { ...NO_FILTERS, status }, [], today, PAGE_SIZE, ctx), status };
}

// What the database read from a scholarship's own page, beyond the list row.
export type More = {
  summary: string;
  // Eligibility rules in the listing's own words.
  rules: { required: boolean; text: string }[];
  // Two-letter states a student must live in or come from.
  states: string[];
  materials: string[];
  // How many awards are given, 0 when not stated.
  awards: number;
  // Where the listing came from, e.g. "school-portal" or "irs-filing".
  source: string;
};

type Packed = [string, [number, string][], string[], string[], number, string];

// Reads the per-list detail file written by scripts/build-data.mjs.
async function readDetails(collection: Collection): Promise<Record<string, Packed>> {
  const file = path.join(process.cwd(), "src/generated/detail", `${collection === "open" ? "any" : collection}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, Packed>;
  } catch {
    return {};
  }
}

// A list's rows and details, parsed once and kept in memory between requests.
// The files only change with a new deployment, so nothing here goes stale. The
// any-school list is always kept; school lists are kept for the most recent few.
type Loaded = { rows: Row[]; details: Record<string, Packed> };
const loaded = new Map<string, Promise<Loaded>>();
const KEEP_SCHOOLS = 60;

function loadList(collection: Collection): Promise<Loaded> {
  const key = String(collection);
  const hit = loaded.get(key);
  if (hit) {
    // Move to the back so the least recently used school is dropped first.
    loaded.delete(key);
    loaded.set(key, hit);
    return hit;
  }
  const data = Promise.all([Promise.all(sourcesFor(collection).map(readRows)), readDetails(collection)]).then(
    ([lists, details]) => ({ rows: lists.flat(), details }),
  );
  loaded.set(key, data);
  if (loaded.size > KEEP_SCHOOLS) {
    for (const k of loaded.keys()) {
      if (k !== "open") {
        loaded.delete(k);
        break;
      }
    }
  }
  return data;
}

const unpack = (p: Packed | undefined): More | null =>
  p
    ? { summary: p[0], rules: p[1].map(([required, text]) => ({ required: required === 1, text })), states: p[2], materials: p[3], awards: p[4], source: p[5] }
    : null;

export type Detail = {
  row: Row;
  more: More | null;
  // "open", "undated" or "closed", and whole days left when open.
  status: Status;
  daysLeft: number | null;
  // Other scholarships from the same list, soonest deadline first.
  related: Row[];
};

/**
 * One scholarship and a few of its neighbours, looked up from the exported
 * files by the id at the end of its address. No database call. Worked out on
 * each request and never stored: there are tens of thousands of these pages,
 * and storing each one a crawler asks for is what used up the hosting quota.
 */
export async function getScholarship(collection: Collection, slug: string): Promise<Detail | null> {
  const id = idFromSlug(slug);
  if (!id) return null;
  const { rows, details } = await loadList(collection);
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  const more = unpack(details[id]);
  const today = new Date().toISOString().slice(0, 10);
  const status: Status = !row.deadline ? "undated" : row.deadline >= today ? "open" : "closed";
  const daysLeft = status === "open" ? Math.round((Date.parse(row.deadline) - Date.parse(today)) / 86_400_000) : null;
  const open = rows.filter((r) => r.id !== id && r.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline));
  // Prefer neighbours from the same provider or field, then whatever closes next.
  const near = open.filter((r) => (row.provider && r.provider === row.provider) || (row.fields && r.fields === row.fields));
  const related = [...new Set([...near, ...open])].slice(0, 8);
  return { row, more, status, daysLeft, related: related.length > 0 ? related : rows.filter((r) => r.id !== id).slice(0, 8) };
}

/** The open scholarships in a list, soonest first, for the plain-text version agents read. */
export async function getOpenRows(
  collection: Collection,
  limit: number,
): Promise<{ rows: Row[]; total: number; summaries: Record<string, string> }> {
  "use cache";
  cacheLife("max");
  const [lists, details] = await Promise.all([Promise.all(sourcesFor(collection).map(readRows)), readDetails(collection)]);
  const rows = lists.flat();
  const today = new Date().toISOString().slice(0, 10);
  const open = rows.filter((r) => r.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const shown = open.slice(0, limit);
  const summaries: Record<string, string> = {};
  for (const r of shown) if (details[r.id]?.[0]) summaries[r.id] = details[r.id][0];
  return { rows: shown, total: open.length, summaries };
}

export type SubscriberContext = {
  // The four profile answers, when given.
  profile: Partial<Profile>;
  // One readable line of everything they told us, to open an email with.
  summary: string | null;
  // "About you" codes they picked, if any.
  about: string[];
  // Everything else worth keeping: all filters, saved ids, the page, the referrer.
  details: Record<string, unknown>;
};

// Saves an email with what is known about the student, so updates can be
// targeted later. `unitid` is null for the any-school list. A repeat signup
// replaces the earlier record. Returns false when the table does not exist yet.
export async function saveSubscriber(email: string, unitid: number | null, ctx: SubscriberContext): Promise<boolean> {
  const record = {
    email: email.trim().toLowerCase(),
    school_unitid: unitid,
    grade: ctx.profile.g || null,
    field: ctx.profile.f || null,
    gpa_band: ctx.profile.gpa || null,
    need: ctx.profile.n || null,
    context: ctx.details,
    updated_at: new Date().toISOString(),
  };
  const save = (row: Record<string, unknown>) => db().from("subscribers").upsert(row, { onConflict: "email" });
  let { error } = await save({ ...record, summary: ctx.summary, about: ctx.about });
  // An older table without the summary and about columns still takes the rest;
  // both are inside `context` as well.
  if (error && /summary|about/.test(error.message)) ({ error } = await save(record));
  if (error) {
    console.error(`subscribers: ${error.message}`);
    return false;
  }
  return true;
}

export type Report = {
  scholarship_id: string;
  scholarship_name: string | null;
  school_unitid: number | null;
  kind: (typeof REPORT_KINDS)[number]["v"];
  note: string | null;
  page: string | null;
  analytics_id: string | null;
};

// Returns false when the table does not exist yet.
export async function saveReport(report: Report): Promise<boolean> {
  const { error } = await db().from("scholarship_reports").insert(report);
  if (error) {
    console.error(`scholarship_reports: ${error.message}`);
    return false;
  }
  return true;
}
