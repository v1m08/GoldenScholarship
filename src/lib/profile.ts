// The few things we ask a student, shared by the question flow (browser) and
// the matcher (server). Every answer is a short code so it fits in a URL.

export type Profile = {
  g: string; // year in school
  f: string; // field of study
  gpa: string; // GPA band
  n: string; // financial need
  st: string; // home state, "zz" outside the US, "x" not given
};

export type Option = { v: string; label: string; say: string };

export const GRADES: Option[] = [
  { v: "grade-12", label: "High school senior", say: "Senior year. Big one." },
  { v: "college-freshman", label: "College freshman", say: "Fresh start. Love it." },
  { v: "college-sophomore", label: "College sophomore", say: "Year two. Noted." },
  { v: "college-junior", label: "College junior", say: "Junior. Prime scholarship years." },
  { v: "college-senior", label: "College senior", say: "Home stretch." },
  { v: "graduate", label: "Graduate student", say: "Grad school. Respect." },
];

// `match` is a regular expression source tested against a scholarship's name
// and its listed fields of study. Short words carry \b so "art" does not hit "Martin".
export const FIELDS: (Option & { match: string })[] = [
  { v: "business", label: "Business", say: "Business. Plenty for that.", match: "\\b(business|account|financ|marketing|management|economics|hospitality|entrepreneur)" },
  { v: "engineering", label: "Engineering", say: "Engineering. Lots of donors love engineers.", match: "\\b(engineer|civil|mechanical|electrical|chemical eng|construction|aerospace|aviation)" },
  { v: "tech", label: "Computer science and tech", say: "Tech. On it.", match: "\\b(comput|software|information (systems|technology)|data science|cyber|informatics)" },
  { v: "health", label: "Nursing and health", say: "Health. There's a lot for that.", match: "\\b(nurs|health|medical|medicine|pharmac|dental|dietetic|kinesiolog|pre-?med|physical therapy)" },
  { v: "education", label: "Education", say: "Future teacher. Good.", match: "\\b(education|teaching|teacher)" },
  { v: "arts", label: "Arts, music and design", say: "The arts. Nice.", match: "\\b(music|art|arts|theatre|theater|dance|design|film|architecture|band|choir|orchestra)\\b" },
  { v: "science", label: "Science and math", say: "Science. Solid.", match: "\\b(biolog|chemistry|physics|mathematic|math\\b|geolog|science|microbiolog|environmental|statistics)" },
  { v: "social", label: "Social sciences", say: "Social sciences. Got it.", match: "\\b(psycholog|sociolog|political science|social work|criminal justice|anthropolog|geograph|public policy)" },
  { v: "humanities", label: "Humanities", say: "Humanities. Got it.", match: "\\b(english|history|philosoph|language|literature|religio|writing|classics)" },
  { v: "agriculture", label: "Agriculture and environment", say: "Ag. There's real money there.", match: "\\b(agricultur|agronom|animal science|horticultur|forestry|dairy|food science|veterinar|wildlife)" },
  { v: "communication", label: "Communication and media", say: "Media. Noted.", match: "\\b(journalis|communication|media|advertising|public relations|broadcast)" },
  { v: "law", label: "Law", say: "Law. Noted.", match: "\\b(law school|pre-?law|paralegal|legal studies|juris)" },
  { v: "trades", label: "Trades and technical", say: "Trades. Good money in those.", match: "\\b(welding|hvac|automotive|culinary|cosmetolog|diesel|vocational|trade school)" },
  { v: "other", label: "Undecided or something else", say: "No problem. I'll keep it broad.", match: "" },
];

// `max` is the highest GPA in the band, used against a scholarship's minimum.
export const GPAS: (Option & { max: number | null })[] = [
  { v: "a", label: "3.5 or higher", say: "Nice. That opens doors.", max: 5 },
  { v: "b", label: "3.0 to 3.49", say: "Solid. Got it.", max: 3.49 },
  { v: "c", label: "2.5 to 2.99", say: "Got it.", max: 2.99 },
  { v: "d", label: "Below 2.5", say: "Got it. Plenty don't ask.", max: 2.49 },
  { v: "x", label: "Rather not say", say: "No problem.", max: null },
];

export const NEEDS: Option[] = [
  { v: "y", label: "Yes", say: "I'll flag the need-based ones." },
  { v: "n", label: "No", say: "Okay, skipping need-only awards." },
  { v: "u", label: "Not sure", say: "I'll show both." },
];

// "About you": optional, pick any. Never asked in the question flow and never
// sent anywhere; it stays in this browser. `v` must match the codes written by
// scripts/build-data.mjs. `tag` is the label shown on a scholarship that fits.
export const ABOUT: { v: string; label: string; tag: string; group: "gender" | "heritage" | "more" }[] = [
  { v: "w", label: "Woman", tag: "for women", group: "gender" },
  { v: "m", label: "Man", tag: "for men", group: "gender" },
  { v: "b", label: "Black", tag: "for Black students", group: "heritage" },
  { v: "h", label: "Hispanic or Latino", tag: "for Hispanic and Latino students", group: "heritage" },
  { v: "na", label: "Native American", tag: "for Native students", group: "heritage" },
  { v: "a", label: "Asian or Pacific Islander", tag: "for Asian and Pacific Islander students", group: "heritage" },
  { v: "fg", label: "First in my family at college", tag: "first-generation", group: "more" },
  { v: "q", label: "LGBTQ+", tag: "LGBTQ+", group: "more" },
  { v: "d", label: "Have a disability", tag: "for students with disabilities", group: "more" },
  { v: "mil", label: "Military or veteran family", tag: "military", group: "more" },
  { v: "intl", label: "Not a US citizen", tag: "open to non-citizens", group: "more" },
];
export const ABOUT_STORAGE_KEY = "sd_about";

// Home state. Many scholarships are only for residents of one state. Not asked
// in the questions (too long a list); it is a filter on the lists instead.
export const STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "Washington, DC"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"],
  ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["PR", "Puerto Rico"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
export const HOMES: Option[] = [
  ...STATES.map(([v, label]) => ({ v, label, say: `${label}. Got it.` })),
  { v: "zz", label: "Outside the US", say: "Got it. I'll skip the state-only ones." },
  { v: "x", label: "Rather not say", say: "No problem." },
];

export const QUESTIONS: { key: keyof Profile; ask: string; options: Option[] }[] = [
  { key: "g", ask: "What year are you?", options: GRADES },
  { key: "f", ask: "What do you study?", options: FIELDS },
  { key: "gpa", ask: "Roughly, your GPA?", options: GPAS },
  { key: "n", ask: "Do you have financial need?", options: NEEDS },
];

const has = (options: Option[], v: string | null | undefined): v is string => !!v && options.some((o) => o.v === v);

// Reads a profile from URL-style values, returning null unless every answer is valid.
export function parseProfile(get: (key: string) => string | null | undefined): Profile | null {
  const g = get("g");
  const f = get("f");
  const gpa = get("gpa");
  const n = get("n");
  if (!has(GRADES, g) || !has(FIELDS, f) || !has(GPAS, gpa) || !has(NEEDS, n)) return null;
  // Links made before the state question existed carry no state.
  const st = get("st");
  return { g, f, gpa, n, st: has(HOMES, st) ? st : "x" };
}

export function profileQuery(p: Profile): string {
  return new URLSearchParams(p).toString();
}

export const labelOf = (options: Option[], v: string): string => options.find((o) => o.v === v)?.label ?? v;

export const PROFILE_STORAGE_KEY = "sd_profile";

// ---- Filters on a school's list -------------------------------------------
// The four profile answers above double as filters; these are the rest.

export type Status = "open" | "undated" | "closed";
export type Sort = "match" | "soon" | "amount";

export type Filters = {
  g: string; // year, "" = any
  f: string; // field, "" = any
  gpa: string; // GPA band, "" = any
  n: string; // need: "" any, "y" has need, "n" no need
  q: string; // text in the name
  due: string; // "", "14", "30", "90": closes within N days
  amt: boolean; // only listings that state an amount
  saved: boolean; // only ones this student starred
  me: string; // "About you" codes, comma-separated; kept in the browser, never in the address
  only: boolean; // only ones aimed at the groups in `me`
  asked: boolean; // "About you" has been answered (even with nothing picked); kept in the browser
  st: string; // home state code, "zz" outside the US, "" = not given
  strict: boolean; // hide ones with a requirement we never asked about
  loose: boolean; // also show ones a required rule ruled out
  status: Status;
  sort: Sort;
};

export const NO_FILTERS: Filters = {
  g: "",
  f: "",
  gpa: "",
  n: "",
  q: "",
  due: "",
  amt: false,
  saved: false,
  me: "",
  only: false,
  asked: false,
  st: "",
  strict: false,
  loose: false,
  status: "open",
  sort: "soon",
};

export const DUES: { v: string; label: string }[] = [
  { v: "14", label: "Closes in 2 weeks" },
  { v: "30", label: "Closes in 30 days" },
  { v: "90", label: "Closes in 90 days" },
];

export const SORTS: { v: Sort; label: string }[] = [
  { v: "soon", label: "Soonest deadline" },
  { v: "match", label: "Best match" },
  { v: "amount", label: "Biggest award" },
];

const STATUSES: Status[] = ["open", "undated", "closed"];

// Field and "I have need" say which scholarships are aimed at a student, so
// with either set the list leads with those. Year and GPA only rule things
// out, so on their own the list stays in deadline order.
export function defaultSort(f: { f: string; n: string; me?: string }): Sort {
  return f.f || f.n === "y" || f.me ? "match" : "soon";
}

// Reads filters from URL-style values. Anything unrecognised falls back to "any".
export function parseFilters(get: (key: string) => string | null | undefined): Filters {
  const pick = (options: { v: string }[], v: string | null | undefined) => (v && options.some((o) => o.v === v) ? v : "");
  const f = pick(FIELDS, get("f"));
  const g = pick(GRADES, get("g"));
  const gpa = pick(GPAS, get("gpa"));
  const n = get("n") === "y" || get("n") === "n" ? (get("n") as string) : "";
  const status = STATUSES.find((s) => s === get("status")) ?? "open";
  const sort = SORTS.find((s) => s.v === get("sort"))?.v ?? defaultSort({ f: f === "other" ? "" : f, n });
  return {
    g,
    // "Undecided" and "rather not say" are the same as no filter.
    f: f === "other" ? "" : f,
    gpa: gpa === "x" ? "" : gpa,
    n,
    q: (get("q") ?? "").slice(0, 60),
    due: pick(DUES, get("due")),
    amt: get("amt") === "1",
    saved: get("saved") === "1",
    me: "",
    only: false,
    asked: false,
    st: get("st") === "zz" || STATES.some(([v]) => v === get("st")) ? (get("st") as string) : "",
    strict: get("strict") === "1",
    loose: false,
    status,
    sort,
  };
}

// The query string for a set of filters, leaving out anything at its default.
// "About you" is left out on purpose so it never lands in a link or in analytics.
export function filtersQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.g) p.set("g", f.g);
  if (f.f) p.set("f", f.f);
  if (f.gpa) p.set("gpa", f.gpa);
  if (f.n) p.set("n", f.n);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.due) p.set("due", f.due);
  if (f.amt) p.set("amt", "1");
  if (f.saved) p.set("saved", "1");
  if (f.st) p.set("st", f.st);
  if (f.strict) p.set("strict", "1");
  if (f.status !== "open") p.set("status", f.status);
  if (f.sort !== defaultSort(f)) p.set("sort", f.sort);
  return p.toString();
}

export function activeCount(f: Filters): number {
  return [f.g, f.f, f.gpa, f.n, f.q.trim(), f.due, f.amt, f.saved, f.me, f.st, f.strict].filter(Boolean).length;
}

export const SAVED_STORAGE_KEY = "sd_saved";
// Where a student was in a list when they opened a scholarship, so "back"
// returns them to the same spot. Kept for this browser tab only.
export const LIST_STATE_KEY = "sd_list";
export type ListState = {
  id: string; // the scholarship they opened
  path: string; // the list's address, filters included
  visible: number; // how many rows had been loaded
  y: number; // how far down the page they were
  loose: boolean;
  only: boolean;
  t: number; // when, in ms
};
// Set by the question flow so the results page plays its loading screen once.
export const FRESH_FLAG_KEY = "sd_fresh";

// What a student can say is wrong with a listing, most common first. `v` must
// match the check on scholarship_reports.kind in supabase/setup.sql, and
// `ask` is what the note box asks for once that reason is picked.
export const REPORT_KINDS = [
  { v: "broken_link", label: "The link is broken or goes to the wrong page", ask: "Know the right link? Paste it here (optional)" },
  { v: "wrong_deadline", label: "The deadline is wrong", ask: "What is the real deadline? (optional)" },
  { v: "closed", label: "It has closed or is no longer offered", ask: "Anything to add? (optional)" },
  { v: "wrong_amount", label: "The amount is wrong", ask: "What is the real amount? (optional)" },
  { v: "wrong_eligibility", label: "Who can apply is wrong", ask: "What does it actually require? (optional)" },
  { v: "wrong_school", label: "It is listed under the wrong school", ask: "Which school is it really for? (optional)" },
  { v: "duplicate", label: "It is a duplicate of another listing", ask: "Which listing is it the same as? (optional)" },
  { v: "not_scholarship", label: "It is not a scholarship", ask: "What is it instead? (optional)" },
  { v: "other", label: "Something else", ask: "Tell us what is wrong" },
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number]["v"];
