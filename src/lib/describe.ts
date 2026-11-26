// Turns a scholarship's stored fields into plain sentences. Used by its page,
// its search-result description and the plain-text versions agents read, so
// all three say the same thing. Nothing here is invented: a fact that is not
// in the listing is left out.

import { GRADES } from "./profile";
import { FLAG, TAGS, type Row } from "./rows";

export function money(r: Row): string | null {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const per = r.perYear ? " per year" : "";
  if (r.awardMin && r.awardMax && r.awardMin !== r.awardMax) return `${fmt(r.awardMin)} to ${fmt(r.awardMax)}${per}`;
  const one = r.awardMax || r.awardMin;
  return one ? `${fmt(one)}${per}` : null;
}

export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

// GRADES in the plural, in the same order.
const YEAR_WORDS = ["high school seniors", "college freshmen", "college sophomores", "college juniors", "college seniors", "graduate students", "high school students before senior year"];

// ABOUT codes as the people they describe.
const GROUP_WORDS: Record<string, string> = {
  w: "women",
  m: "men",
  b: "Black students",
  h: "Hispanic and Latino students",
  na: "Native American students",
  a: "Asian and Pacific Islander students",
  fg: "first-generation students",
  q: "LGBTQ+ students",
  d: "students with disabilities",
  mil: "veterans and military families",
  min: "underrepresented students",
};

export function years(r: Row): string | null {
  if (!r.grades) return null;
  const names = YEAR_WORDS.filter((_, i) => r.grades & (1 << i));
  return names.length === GRADES.length ? "students in any year" : list(names);
}

export function fields(r: Row): string | null {
  return r.fields ? list(r.fields.split(" ").map((f) => f.replace(/-/g, " "))) : null;
}

export function groups(r: Row): string[] {
  return (r.who ? r.who.split(" ") : []).map((code) => GROUP_WORDS[code]).filter(Boolean);
}

export function requirements(r: Row): string[] {
  return [
    r.essay && "an essay",
    r.flags & FLAG.recommendations && "letters of recommendation",
    r.flags & FLAG.transcript && "a transcript",
    r.flags & FLAG.interview && "an interview",
    r.flags & FLAG.nomination && "a nomination",
  ].filter((x): x is string => Boolean(x));
}

export const looksFor = (r: Row): string[] => TAGS.filter((_, i) => r.tags & (1 << i));

// "at The University of Alabama" or "from Grays Harbor Community Foundation".
export type Offered = { by: string; phrase: string };

/** One or two sentences that answer "what is this, how much, and when". */
export function lead(r: Row, offered: Offered, status: "open" | "undated" | "closed"): string {
  const amount = money(r);
  const first = `${r.name} is a scholarship ${offered.phrase}${amount ? `, worth ${amount}` : ""}.`;
  const when =
    status === "open"
      ? `Applications are due ${longDate(r.deadline)}.`
      : status === "closed"
        ? `Its last listed deadline was ${longDate(r.deadline)}; many scholarships reopen each year.`
        : "No deadline is listed.";
  return `${first} ${when}`;
}

/** Who can apply, as sentences. Empty when the listing states nothing. */
export function eligibility(r: Row): string[] {
  const out: string[] = [];
  const y = years(r);
  if (y) out.push(`Open to ${y}.`);
  const f = fields(r);
  if (f) out.push(`For students in ${f}.`);
  if (r.minGpa) out.push(`Requires a GPA of at least ${r.minGpa.toFixed(2).replace(/0$/, "")}.`);
  const g = groups(r);
  if (g.length) out.push(`Aimed at ${list(g)}.`);
  if (r.need === "r") out.push("Financial need is required.");
  if (r.need === "c") out.push("Financial need is considered.");
  if (r.flags & FLAG.meritRequired) out.push("Awarded on merit.");
  if (r.flags & FLAG.fullTime) out.push("You must be enrolled full-time.");
  const codes = r.who.split(" ");
  if (codes.includes("cit")) out.push("Limited to US citizens or permanent residents.");
  if (codes.includes("intl")) out.push("Open to students who are not US citizens.");
  return out;
}

export type Fact = { label: string; value: string };

/** The at-a-glance table. Only rows the listing actually states. */
export function facts(r: Row, offered: Offered, status: "open" | "undated" | "closed"): Fact[] {
  const out: Fact[] = [];
  const amount = money(r);
  out.push({ label: "Award", value: amount ?? (r.flags & FLAG.fullCost ? "Full cost of attendance" : "Not stated") });
  out.push({
    label: "Deadline",
    value: status === "undated" ? "Not listed" : status === "closed" ? `${longDate(r.deadline)} (passed)` : longDate(r.deadline),
  });
  out.push({ label: "Offered by", value: offered.by });
  const y = years(r);
  if (y) out.push({ label: "Year in school", value: y[0].toUpperCase() + y.slice(1) });
  if (r.minGpa) out.push({ label: "Minimum GPA", value: r.minGpa.toFixed(2).replace(/0$/, "") });
  const f = fields(r);
  if (f) out.push({ label: "Field of study", value: f[0].toUpperCase() + f.slice(1) });
  if (r.need) out.push({ label: "Financial need", value: r.need === "r" ? "Required" : "Considered" });
  const req = requirements(r);
  if (req.length) out.push({ label: "Application needs", value: list(req).replace(/^./, (c) => c.toUpperCase()) });
  if (r.renewable) out.push({ label: "Renewable", value: "Yes" });
  const looks = looksFor(r);
  if (looks.length) out.push({ label: "Looks for", value: list(looks).replace(/^./, (c) => c.toUpperCase()) });
  if (r.checked) out.push({ label: "Last checked", value: longDate(r.checked) });
  return out;
}

/** Questions people actually search, answered only where the listing has the answer. */
export function faq(r: Row, offered: Offered, status: "open" | "undated" | "closed"): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  if (status !== "undated") {
    out.push({
      q: `When is the ${r.name} deadline?`,
      a:
        status === "open"
          ? `The deadline is ${longDate(r.deadline)}.`
          : `The last listed deadline was ${longDate(r.deadline)}. Check the official page for the next round.`,
    });
  }
  const amount = money(r);
  if (amount) out.push({ q: `How much is the ${r.name} worth?`, a: `${amount}${r.renewable ? ", and it is renewable" : ""}.` });
  const who = eligibility(r);
  if (who.length) out.push({ q: `Who can apply for the ${r.name}?`, a: who.join(" ") });
  const req = requirements(r);
  if (req.length) out.push({ q: `What does the application need?`, a: `It asks for ${list(req)}.` });
  out.push({
    q: `How do I apply for the ${r.name}?`,
    a: r.url
      ? `Apply through the official page ${offered.phrase.startsWith("at") ? "at" : "from"} ${offered.by}; the link is on this page. This site never handles applications.`
      : `Contact ${offered.by} directly; no application link is listed.`,
  });
  return out;
}

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "Washington, DC", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** The states a student must be from, in words. Empty when the listing names none. */
export function stateNames(codes: string[]): string {
  return list(codes.map((c) => STATES[c] ?? c));
}

const MATERIALS: Record<string, string> = {
  "application-form": "an application form",
  essay: "an essay",
  fafsa: "a completed FAFSA",
  recommendation: "a recommendation",
  transcript: "a transcript",
  resume: "a resume",
  portfolio: "a portfolio",
  interview: "an interview",
  "test-scores": "test scores",
  nomination: "a nomination",
  "proof-of-enrollment": "proof of enrollment",
  video: "a video",
  photo: "a photo",
};

/** What the application asks for, from the listing's own page. */
export function materialWords(materials: string[]): string {
  return list(materials.map((m) => MATERIALS[m] ?? m.replace(/-/g, " ")));
}

const SOURCES: Record<string, string> = {
  "school-portal": "the school\u2019s scholarship portal",
  "school-website": "the school\u2019s website",
  "provider-website": "the provider\u2019s website",
  "foundation-website": "the foundation\u2019s website",
  "irs-filing": "the funder\u2019s IRS filing",
};

/** Where a listing was collected from, in words. */
export const sourceWords = (source: string): string | null => SOURCES[source] ?? null;
