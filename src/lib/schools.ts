import "server-only";
import { cacheLife } from "next/cache";
import generated from "@/generated/index.json";
import { daysBetween, pacificToday } from "./day";
import { db } from "./supabase";

export type School = {
  unitid: number;
  name: string;
  city: string | null;
  state: string | null;
  level: string | null;
  // URL segment: readable name plus the stable id, e.g. "university-of-alabama-100751".
  slug: string;
  // Scholarships we hold for this school, and how many have a deadline still ahead.
  total: number;
  open: number;
};

// `official` is the name exactly as the government's list has it.
type IndexedSchool = School & { official: string; norm: string; words: string[]; acronym: string };

// The government's list tacks a campus label onto flagship campuses ("Georgia
// Institute of Technology-Main Campus"). Nobody calls them that, so it is
// dropped from what is shown. Addresses and search still use the official name.
const displayName = (name: string) => name.replace(/-Main Campus$| Campus Immersion$/, "");

const STOP = new Set(["of", "the", "at", "and", "in", "for", "a"]);

// Nicknames students actually type, mapped to the exact name in the schools table.
const ALIASES: Record<string, string> = {
  asu: "Arizona State University Campus Immersion",
  "arizona state": "Arizona State University Campus Immersion",
  ut: "The University of Texas at Austin",
  "ut austin": "The University of Texas at Austin",
  utexas: "The University of Texas at Austin",
  tamu: "Texas A&M University-College Station",
  "texas a and m": "Texas A&M University-College Station",
  osu: "Ohio State University-Main Campus",
  "ohio state": "Ohio State University-Main Campus",
  psu: "Pennsylvania State University-Main Campus",
  "penn state": "Pennsylvania State University-Main Campus",
  uf: "University of Florida",
  umich: "University of Michigan-Ann Arbor",
  michigan: "University of Michigan-Ann Arbor",
  ucla: "University of California-Los Angeles",
  cal: "University of California-Berkeley",
  berkeley: "University of California-Berkeley",
  "uc berkeley": "University of California-Berkeley",
  ucsd: "University of California-San Diego",
  uci: "University of California-Irvine",
  ucd: "University of California-Davis",
  ucsb: "University of California-Santa Barbara",
  gt: "Georgia Institute of Technology-Main Campus",
  "georgia tech": "Georgia Institute of Technology-Main Campus",
  bama: "The University of Alabama",
  alabama: "The University of Alabama",
  unc: "University of North Carolina at Chapel Hill",
  uiuc: "University of Illinois Urbana-Champaign",
  uw: "University of Washington-Seattle Campus",
  lsu: "Louisiana State University and Agricultural & Mechanical College",
  msu: "Michigan State University",
  iu: "Indiana University-Bloomington",
  vt: "Virginia Polytechnic Institute and State University",
  "virginia tech": "Virginia Polytechnic Institute and State University",
  ncsu: "North Carolina State University at Raleigh",
  "nc state": "North Carolina State University at Raleigh",
  uga: "University of Georgia",
  purdue: "Purdue University-Main Campus",
  "cu boulder": "University of Colorado Boulder",
  umn: "University of Minnesota-Twin Cities",
  umd: "University of Maryland-College Park",
  rutgers: "Rutgers University-New Brunswick",
  uh: "University of Houston",
  ttu: "Texas Tech University",
  fsu: "Florida State University",
  usf: "University of South Florida",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

// Whole days from today until a date, never negative. Cached so pages built
// ahead of time do not depend on the clock at render.
export async function daysUntil(iso: string): Promise<number> {
  "use cache";
  cacheLife("max");
  return Math.max(0, daysBetween(pacificToday(), iso));
}

function slugFor(name: string, unitid: number): string {
  return `${normalize(name).replace(/ /g, "-")}-${unitid}`;
}

// Every school with its totals, from the index built before each build
// (scripts/build-index.mjs). Counting 100,000+ rows per request is not
// something the database can do in time, so the counts are a day old at most.
type IndexRow = [unitid: number, name: string, city: string | null, state: string | null, level: string | null, total: number, open: number];

let memo: IndexedSchool[] | null = null;

async function getSchoolIndex(): Promise<IndexedSchool[]> {
  if (memo) return memo;
  memo = (generated.schools as IndexRow[]).map(([unitid, name, city, state, level, total, open]) => {
    const norm = normalize(name);
    const words = norm.split(" ");
    const acronym = words
      .filter((w) => !STOP.has(w))
      .map((w) => w[0])
      .join("");
    return { unitid, name: displayName(name), official: name, city, state, level, slug: slugFor(name, unitid), total, open, norm, words, acronym };
  });
  return memo;
}

// Totals for the scholarships that are open to students at any school.
export function getAnySchoolTotals(): { total: number; open: number; providers: number } {
  return generated.anySchool;
}

function toSchool(s: IndexedSchool): School {
  return {
    unitid: s.unitid,
    name: s.name,
    city: s.city,
    state: s.state,
    level: s.level,
    slug: s.slug,
    total: s.total,
    open: s.open,
  };
}

// Ranked search: nicknames, acronyms ("ucf"), name prefixes, then word prefixes.
export async function searchSchools(query: string, limit = 8): Promise<School[]> {
  const q = normalize(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ");
  const index = await getSchoolIndex();

  const alias = ALIASES[q];
  const scored: { s: IndexedSchool; score: number }[] = [];
  for (const s of index) {
    let score = 0;
    if (alias && s.official === alias) score = 130;
    else if (tokens.length === 1 && s.acronym === q) score = 100;
    else if (s.norm.startsWith(q)) score = 90;
    else if (tokens.length === 1 && q.length >= 3 && s.acronym.startsWith(q)) score = 75;
    else if (tokens.every((t) => s.words.some((w) => w.startsWith(t)))) score = 70;
    else if (s.norm.includes(q)) score = 50;
    if (score === 0) continue;
    if (s.level === "four-year") score += 5;
    // Flagship campuses and schools we hold more data for rank first.
    if (/main campus|campus immersion/.test(s.norm)) score += 8;
    score += Math.min(14, Math.log10(s.total + 1) * 4);
    scored.push({ s, score });
  }

  scored.sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length);
  return scored.slice(0, limit).map(({ s }) => toSchool(s));
}

export async function getSchool(unitid: number): Promise<School | null> {
  const index = await getSchoolIndex();
  const s = index.find((x) => x.unitid === unitid);
  return s ? toSchool(s) : null;
}

// The id at the end of the slug is what identifies the school; the words are for people.
export async function getSchoolBySlug(slug: string): Promise<School | null> {
  const m = /-(\d+)$/.exec(slug);
  return m ? getSchool(Number(m[1])) : null;
}

// Schools with the most open scholarships.
export async function getTopSchools(limit = 12): Promise<School[]> {
  const index = await getSchoolIndex();
  return [...index]
    .filter((s) => s.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, limit)
    .map(toSchool);
}

// Every school with at least `min` scholarships, for the sitemap.
export async function getSchoolsWithData(min: number): Promise<School[]> {
  const index = await getSchoolIndex();
  return index.filter((s) => s.total >= min).map(toSchool);
}

export async function getTotals(): Promise<{ schools: number; scholarships: number; open: number }> {
  const index = await getSchoolIndex();
  let schools = 0;
  let scholarships = 0;
  let open = 0;
  for (const s of index) {
    if (s.total > 0) schools += 1;
    scholarships += s.total;
    open += s.open;
  }
  return { schools, scholarships, open };
}

// Best-effort record of something a student wanted that we could not give.
// The table is optional, so a failure here is logged and ignored.
export async function recordMiss(kind: string, query: string | null, unitid: number | null): Promise<void> {
  const { error } = await db()
    .from("search_misses")
    .insert({ kind, query: query ? query.slice(0, 120) : null, school_unitid: unitid });
  if (error) console.warn(`search_misses: ${error.message}`);
}
