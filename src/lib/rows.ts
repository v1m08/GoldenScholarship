// Scholarship rows as the site holds them, and the one function that filters
// and ranks them. It has no server or browser dependencies: the server runs it
// once at build time for the first screen, and the browser runs it on every
// filter change, so results appear without a network round trip.

import { ABOUT, FIELDS, GPAS, GRADES, STATES, type Filters, type Status } from "./profile";

export type Row = {
  id: string;
  name: string;
  url: string;
  deadline: string; // "" when none is listed
  awardMin: number; // 0 when not stated
  awardMax: number;
  perYear: boolean;
  need: "" | "r" | "c"; // required, considered
  essay: boolean;
  renewable: boolean;
  grades: number; // bit i set = open to GRADES[i]; 0 = not stated
  fields: string; // listed fields of study, space-separated
  minGpa: number; // 0 when not stated
  provider: string; // who offers it; set for scholarships not tied to a school
  who: string; // codes for who it is aimed at, space-separated; see ABOUT
  flags: number; // see FLAG
  tags: number; // bit i set = TAGS[i]
  checked: string; // the day it was last checked against its source, "" when unknown
  // Required rules read from the listing, written by scripts/build-data.mjs:
  fieldGate: string; // field buckets it is limited to; "x" = a subject outside every bucket; "?" = partly unplaced
  must: string; // groups a student must be in: "w b|h" = a woman who is Black or Hispanic
  states: string; // home states it is limited to, space-separated
  colleges: string; // named colleges it is limited to, "|"-separated, normalised
  extra: string; // other requirements nobody is asked about, in words
  type: string; // "cc" = only for community college or trade school students
  hints: string; // guesses where the listing states no rule: "st:MA|col:<college>|greek"
  // Set in the browser on a school's page for rows that are open to any school,
  // as opposed to the school's own.
  any?: boolean;
};

// `reasons`: why it fits. `needs`: requirements worth a warning before clicking.
export type Shown = Row & { reasons: string[]; needs: string[] };

export type Result = {
  // How many pass the filters in the chosen tab.
  total: number;
  // The same filters applied to each tab, for the tab labels.
  counts: Record<Status, number>;
  // In this tab: left out because a required rule contradicts the student's answers.
  hidden?: number;
  rows: Shown[];
};

type Encoded = [string, string, string, string, number, number, number, string, number, number, number, string, number, string, string?, number?, number?, number?, string?, string?, string?, string?, string?, string?, string?];

// Bits of `flags`, in the order scripts/build-data.mjs writes them.
export const FLAG = {
  meritRequired: 1,
  meritConsidered: 2,
  fullTime: 4,
  recommendations: 8,
  transcript: 16,
  interview: 32,
  nomination: 64,
  fullCost: 128,
  lastDollar: 256,
  summary: 512, // the listing has a written summary
  recurring: 1024, // the same deadline comes round every year
} as const;

// What a scholarship rewards or looks for, in the order of the bits in `tags`.
export const TAGS = [
  "leadership",
  "community service",
  "women",
  "first-generation students",
  "military-connected students",
  "athletics",
  "study abroad",
  "STEM",
  "overcoming adversity",
  "research",
  "work experience",
];

const CHECKED_EPOCH = Date.parse("2025-01-01T00:00:00Z");

// A scholarship's name as it appears in its address. Must produce the same
// text as slugify() in scripts/build-data.mjs.
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "scholarship"
  );
}

// The address of a scholarship's own page. `base` is its list: "/schools/<slug>" or "/scholarships".
export const scholarshipPath = (base: string, row: { id: string; name: string }) => `${base}/${slugify(row.name)}-${row.id}`;

// The id at the end of a scholarship address, or null when there is none.
export const idFromSlug = (slug: string): string | null => /-([0-9a-f]{8,40})$/.exec(slug)?.[1] ?? null;

// Whether a scholarship states enough (a summary, or two facts beyond its name) for its own
// page to be worth a search engine's time. Must match isIndexable() in
// scripts/build-data.mjs.
export function isIndexable(r: Row): boolean {
  return (
    Boolean(r.flags & FLAG.summary) ||
    [
      r.deadline,
      r.awardMin || r.awardMax,
      r.minGpa,
      r.grades,
      r.fields,
      r.need,
      r.who.replace(/\bcit\b/, "").trim(),
      r.essay || r.flags & 0b1111000,
    ].filter(Boolean).length >= 2
  );
}

// The array layout written by scripts/build-data.mjs.
export function decodeRow(a: Encoded): Row {
  return {
    id: a[0],
    name: a[1],
    url: a[2],
    deadline: a[3],
    awardMin: a[4],
    awardMax: a[5],
    perYear: a[6] === 1,
    need: a[7] as Row["need"],
    essay: a[8] === 1,
    renewable: a[9] === 1,
    grades: a[10],
    fields: a[11],
    minGpa: a[12],
    provider: a[13],
    who: a[14] ?? "",
    flags: a[15] ?? 0,
    tags: a[16] ?? 0,
    checked: a[17] ? new Date(CHECKED_EPOCH + a[17] * 86_400_000).toISOString().slice(0, 10) : "",
    fieldGate: a[18] ?? "",
    must: a[19] ?? "",
    states: a[20] ?? "",
    colleges: a[21] ?? "",
    extra: a[22] ?? "",
    type: a[23] ?? "",
    hints: a[24] ?? "",
  };
}

export const decodeRows = (data: unknown): Row[] => (data as Encoded[]).map(decodeRow);

const GRADE_WORD = ["high school seniors", "freshmen", "sophomores", "juniors", "seniors", "grad students"];
const bitCount = (n: number) => n.toString(2).split("1").length - 1;

// The words for a group a scholarship is restricted to. Codes match ABOUT.
const MUST_WORDS: Record<string, string> = {
  w: "women",
  m: "men",
  b: "Black students",
  h: "Hispanic or Latino students",
  na: "Native students",
  a: "Asian or Pacific Islander students",
  min: "underrepresented students",
  fg: "first-generation students",
  mil: "military or veteran families",
  d: "students with a disability",
};
const HERITAGE = new Set(["b", "h", "na", "a", "min"]);
const STATE_NAME = new Map(STATES);
// Must produce the same text as normName() in scripts/build-data.mjs.
const normName = (v: string) => v.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^the /, "");
const titleCase = (v: string) => v.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(Of|At|And|The)\b/g, (w) => w.toLowerCase());

const fieldRes = FIELDS.filter((f) => f.match).map((f) => ({ v: f.v, label: f.label, re: new RegExp(f.match, "i") }));

function statusOf(row: Row, today: string): Status {
  if (!row.deadline) return "undated";
  return row.deadline >= today ? "open" : "closed";
}

/**
 * Filters and ranks scholarships for one student.
 *
 * The four profile answers (year, GPA, need, field) only ever remove a
 * scholarship the student could not get: one limited to other years, with a
 * GPA floor above theirs, that requires need they do not have, or that is
 * plainly for a different field. A scholarship that says nothing about GPA,
 * year or field stays in. `reasons` records what actively fits; "best match"
 * order is driven by field and need, the two that say a scholarship is aimed
 * at this student and not merely open to them.
 *
 * "About you" (gender, background and the like) never hides a scholarship
 * because of a name: names are too unreliable for that. It puts the ones aimed
 * at the student first and labels them, and `only` narrows to just those. The
 * one hard rule is citizenship, which the listings state outright.
 *
 * Text, deadline window, "states an amount" and "saved" are ordinary filters.
 */
export function filterRows(
  rows: Row[],
  filters: Filters,
  savedIds: string[],
  today: string,
  limit: number,
  // On a school's page: its name (a scholarship limited to another college is
  // ruled out), whether it is a four-year school, and `merge`, which puts the
  // school's own undated scholarships on the first tab with the open ones.
  ctx: { school?: string; fourYear?: boolean; merge?: boolean } = {},
): Result {
  const gradeBit = GRADES.findIndex((g) => g.v === filters.g);
  const gpaMax = GPAS.find((g) => g.v === filters.gpa)?.max ?? null;
  const mine = fieldRes.find((f) => f.v === filters.f) ?? null;
  const others = mine ? fieldRes.filter((f) => f.v !== mine.v) : [];
  const text = filters.q.trim().toLowerCase();
  const saved = filters.saved ? new Set(savedIds) : null;
  const dueBy = filters.due
    ? new Date(Date.parse(`${today}T00:00:00Z`) + Number(filters.due) * 86_400_000).toISOString().slice(0, 10)
    : "";

  const me = new Map(ABOUT.filter((a) => filters.me.split(",").includes(a.v)).map((a) => [a.v, a]));
  const anyHeritage = [...me.values()].some((a) => a.group === "heritage");

  const pickedGender = me.has("w") || me.has("m");
  const schoolName = ctx.school ? normName(ctx.school) : "";
  const sameCollege = (n: string) => n === schoolName || schoolName.includes(n) || n.includes(schoolName);

  const counts: Record<Status, number> = { open: 0, undated: 0, closed: 0 };
  const kept: { row: Row; score: number; reasons: string[]; needs: string[]; out: boolean }[] = [];
  let hidden = 0;

  for (const row of rows) {
    const reasons: string[] = [];
    // Requirements to warn about, and whether a required rule rules this student out.
    const needs: string[] = [];
    let out = false;
    let score = 0;

    if (gradeBit >= 0 && row.grades !== 0) {
      if (!(row.grades & (1 << gradeBit))) continue;
      // Naming a few years is worth showing; listing every year is not.
      if (bitCount(row.grades) <= 3) reasons.push(`for ${GRADE_WORD[gradeBit]}`);
    }

    if (gpaMax !== null && row.minGpa > 0) {
      if (row.minGpa > gpaMax) continue;
      reasons.push(`GPA ${row.minGpa.toFixed(1)}+ met`);
    }

    if (filters.n === "n" && row.need === "r") continue;
    if (filters.n === "y" && row.need !== "") {
      score += 2;
      reasons.push("need-based");
    }

    if (mine && row.fieldGate) {
      // The listing's own rule names its subjects: trust that over the name.
      const subjects = row.fieldGate.split(" ");
      if (subjects.includes(mine.v)) {
        score += 3;
        reasons.push(mine.label.toLowerCase());
      } else if (!subjects.includes("?")) {
        out = true;
      }
    } else if (mine) {
      const haystack = `${row.name} ${row.fields}`;
      if (mine.re.test(haystack)) {
        score += 3;
        reasons.push(mine.label.toLowerCase());
      } else if (others.some((f) => f.re.test(haystack))) {
        // Plainly aimed at another field. Anything that names no field stays.
        continue;
      }
    }

    if (me.size > 0) {
      const codes = row.who ? row.who.split(" ") : [];
      if (me.has("intl") && codes.includes("cit")) continue;
      let aimed = false;
      for (const code of codes) {
        const hit = me.get(code);
        if (hit) {
          aimed = true;
          score += 3;
          reasons.push(hit.tag);
        } else if (code === "min" && anyHeritage) {
          aimed = true;
          score += 2;
          reasons.push("underrepresented students");
        }
      }
      if (filters.only && !aimed) continue;
    }

    // Restricted to a group: ruled out once the student has said who they are, a warning until then.
    for (const group of row.must ? row.must.split(" ") : []) {
      const codes = group.split("|");
      if (codes.some((c) => me.has(c) || (c === "min" && anyHeritage))) continue;
      const answered = codes.some((c) => c === "w" || c === "m") ? pickedGender : codes.some((c) => HERITAGE.has(c)) ? anyHeritage : false;
      if (answered || filters.asked) out = true;
      else needs.push(MUST_WORDS[codes[0]] ?? "a specific group");
    }

    if (row.states) {
      const allowed = row.states.split(" ");
      if (filters.st) {
        if (allowed.includes(filters.st)) reasons.push(`${filters.st} residents`);
        else out = true;
      } else needs.push(`${allowed.slice(0, 3).join(", ")} residents`);
    }

    if (row.colleges) {
      const names = row.colleges.split("|");
      if (!schoolName) needs.push(`students at ${titleCase(names[0])}`);
      else if (!names.some(sameCollege)) out = true;
    }

    if (row.type === "cc") {
      if (ctx.fourYear) out = true;
      else if (!schoolName) needs.push("community college or trade school students");
    }

    // Guesses from the title and provider. A "~" marks one as a guess: it warns and never rules out.
    for (const hint of row.hints ? row.hints.split("|") : []) {
      if (hint.startsWith("st:")) {
        const code = hint.slice(3);
        if (filters.st !== code) needs.push(`~may be limited to ${STATE_NAME.get(code) ?? code}`);
      } else if (hint.startsWith("col:")) {
        const name = hint.slice(4);
        if (!schoolName || !sameCollege(name)) needs.push(`~may be limited to students at ${titleCase(name)}`);
      } else if (hint === "greek") {
        needs.push("~may be limited to members of that fraternity or sorority");
      }
    }
    // A listing nobody has read yet: nothing rules the student out, but nothing says they fit either.
    if (!(row.flags & FLAG.summary) && !row.fieldGate && !row.must && !row.states && !row.extra) score -= 2;

    if (row.extra) needs.push(row.extra);
    if (filters.strict && needs.length > 0) continue;

    if (text && !`${row.name} ${row.provider}`.toLowerCase().includes(text)) continue;
    if (filters.amt && row.awardMax === 0 && row.awardMin === 0) continue;
    if (saved && !saved.has(row.id)) continue;
    if (dueBy && !(row.deadline && row.deadline >= today && row.deadline <= dueBy)) continue;

    const stated = statusOf(row, today);
    // A school's own scholarships with no date listed sit with its open ones.
    const status: Status = ctx.merge && !row.any && stated === "undated" ? "open" : stated;
    if (out && !filters.loose) {
      if (status === filters.status) hidden += 1;
      continue;
    }
    counts[status] += 1;
    // Anything with a catch ranks under the ones without.
    if (status === filters.status) kept.push({ row, score: score - (needs.length > 0 ? 3 : 0), reasons, needs, out });
  }

  const byDeadline = (a: Row, b: Row) =>
    filters.status === "closed"
      ? b.deadline.localeCompare(a.deadline)
      : (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.name.localeCompare(b.name);

  kept.sort((a, b) => {
    if (filters.sort === "match") return b.score - a.score || byDeadline(a.row, b.row);
    if (filters.sort === "amount") return (b.row.awardMax || b.row.awardMin) - (a.row.awardMax || a.row.awardMin) || byDeadline(a.row, b.row);
    return byDeadline(a.row, b.row);
  });
  // On a school's page its own scholarships lead; those open to any school follow.
  if (kept.some((k) => k.row.any)) kept.sort((a, b) => Number(Boolean(a.row.any)) - Number(Boolean(b.row.any)));
  // Shown on request only: the ones a rule ruled out go last.
  if (filters.loose) kept.sort((a, b) => Number(a.out) - Number(b.out));

  return {
    total: kept.length,
    counts,
    hidden,
    rows: kept.slice(0, limit).map(({ row, reasons, needs, out }) => ({
      ...row,
      reasons,
      needs: out ? ["does not fit your answers", ...needs] : needs,
    })),
  };
}
