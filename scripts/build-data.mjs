// Exports everything the site needs from Supabase into static files, so no
// visitor ever waits on the database:
//
//   src/generated/index.json     every school with its counts, plus any-school totals
//   src/generated/school-ids.json  every school id
//   public/data/s/<unitid>.json  one school's scholarships
//   public/data/any-open.json    open to any school, with a deadline still ahead
//   public/data/any-rest.json    open to any school, undated or closed
//
// Runs before every build (`npm run build`) and on its own with `npm run data`.
// Rows are written as arrays to keep files small; the order must match
// decodeRow() in src/lib/rows.ts.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_BASE || !KEY) {
  console.error("build-data: set SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  process.exit(1);
}

async function get(pathAndQuery, attempt = 0) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (res.ok) return res.json();
  // The database can time out when cold; back off and try again.
  if (attempt < 6) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return get(pathAndQuery, attempt + 1);
  }
  throw new Error(`${res.status} ${await res.text()}`);
}

// Walks a table forward from the last key seen, which stays fast at any depth.
async function walk(table, columns, key, filter, lower, upper) {
  const out = [];
  let last = null;
  for (;;) {
    const from = last === null ? lower : `&${key}=gt.${encodeURIComponent(last)}`;
    const rows = await get(`${table}?select=${columns}${filter}${from}${upper}&order=${key}&limit=1000`);
    out.push(...rows);
    if (rows.length < 1000) return out;
    last = rows[rows.length - 1][key];
  }
}

const HEX = "0123456789abcdef";
// Must match GRADES in src/lib/profile.ts: bit 0 is the first entry.
const GRADE_BITS = ["grade-12", "college-freshman", "college-sophomore", "college-junior", "college-senior", "graduate"];
const NEED = { required: "r", considered: "c" };

// A deadline names a day, not an hour, so it stays open until that day has
// ended everywhere in the continental US. Must match today() in src/lib/day.ts.
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const started = Date.now();

const schools = await walk("schools", "unitid,name,city,state,level", "unitid", "", "", "");

// Scholarship ids are hex strings, so the table splits cleanly into sixteen
// ranges by first character. Four are read at a time to stay gentle on the database.
const COLUMNS =
  "id,name,url,deadline,award_min,award_max,award_per_year,need,essay,renewable,grade_levels,fields_of_study,minimum_gpa,provider_name,school_unitid,tags,citizenship,merit,enrollment,recommendations,transcript,interview,nomination,award_type,checked_at,summary,criteria,required_states,materials,awards,deadline_recurring,apply_url,source,criteria_match";
const rows = [];
// For working on this script: ROWS_CACHE=<file> reuses the last read instead of asking the database again.
const cached = process.env.ROWS_CACHE ? await readFile(process.env.ROWS_CACHE, "utf8").catch(() => null) : null;
if (cached) for (const r of JSON.parse(cached)) rows.push(r);
for (let i = 0; i < (cached ? 0 : 16); i += 4) {
  const parts = await Promise.all(
    [0, 1, 2, 3].map((d) =>
      walk("scholarships", COLUMNS, "id", "&status=neq.archived", `&id=gte.${HEX[i + d]}`, i + d < 15 ? `&id=lt.${HEX[i + d + 1]}` : ""),
    ),
  );
  for (const p of parts) rows.push(...p);
  process.stdout.write(`build-data: ${rows.length.toLocaleString()} scholarships read\n`);
}

if (process.env.ROWS_CACHE && !cached) await writeFile(process.env.ROWS_CACHE, JSON.stringify(rows));

// ---- Tidying what the collector left behind ------------------------------
// Nothing here touches the database: a listing that is left out is only left
// out of the site's files, and the counts are printed at the end of the run.

// Page-title leftovers and bank account codes on the end of a name:
// "MBA Scholarship Details", "... Fellowship Applications Open", "... Fund R79588001".
const tidyName = (name) =>
  String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+[A-Z]?\d{6,}$/, "")
    .replace(/\s+(details|applications? (are )?(now )?open)$/i, "")
    .replace(/[\s:,-]+$/, "") || String(name ?? "");

// A page that lists other organizations' scholarships. The collector credits
// everything on it to the page's owner and links to the list, not the award,
// so both the sponsor and the link are wrong ("Gates Scholarship, from Young
// Scholars of Bartlesville"). Left out until they are collected from their own pages.
const SECOND_HAND = /external|outside|lookup|databank|resource-(guide|center)|search-databases|other-scholarships|additional-scholarship/i;

// A sentence or heading lifted off a page in place of a name: "To be eligible
// for this award, a student must:", "This is a renewable scholarship of up to $2,000".
const NOT_A_NAME =
  /^(this (scholarship|award|fund|is|\$)|these awards?|to (be eligible|retain|provide|maintain|formally|request)|applicants? (must|for the|to the)|we (offer|award|also offer)|criteria for|please note|if awarded|visit (our|the)|prior to|offers scholarships|students must)\b|\b(must|includes?|granted to|the following|awards are)\s*:?$/i;

const tidy = { renamed: 0, notNames: 0, noLink: 0, secondHand: 0, duplicates: 0 };
{
  const key = (v) => String(v ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const shared = new Map(); // provider + page -> how many listings point at it
  for (const r of rows) {
    r.notName = NOT_A_NAME.test(String(r.name ?? "").trim());
    const name = tidyName(r.name);
    if (name !== r.name) {
      tidy.renamed += 1;
      // A trust whose listing is just its own name carries the same code on both.
      if (r.provider_name === r.name) r.provider_name = name;
      r.name = name;
    }
    if (r.school_unitid === null && r.url) shared.set(`${r.provider_name}\n${r.url}`, (shared.get(`${r.provider_name}\n${r.url}`) ?? 0) + 1);
  }
  // How much a listing says, to keep the fuller of two copies.
  const weight = (r) => (r.summary ? 4 : 0) + (r.apply_url ? 2 : 0) + (r.award_max || r.award_min ? 1 : 0) + (r.criteria ?? []).length / 100;
  const seen = new Map();
  const kept = [];
  for (const r of rows) {
    const anySchool = r.school_unitid === null;
    if (r.notName) {
      tidy.notNames += 1;
      continue;
    }
    // Open to any school but with nowhere to apply: a foundation's tax filing and nothing found on the web.
    if (anySchool && !r.url && !r.apply_url && !process.env.SHOW_UNLINKED) {
      tidy.noLink += 1;
      continue;
    }
    if (anySchool && r.url && SECOND_HAND.test(r.url.replace(/^https?:\/\/[^/]+/, "")) && shared.get(`${r.provider_name}\n${r.url}`) >= 3) {
      tidy.secondHand += 1;
      continue;
    }
    // The same award listed twice: same list, name (less a trailing year), provider, and deadline or page.
    const name = key(r.name).replace(/\b20\d\d( (20)?\d\d)?$/, "").trim();
    const id = `${r.school_unitid ?? "any"}|${name}|${key(r.provider_name)}|${r.deadline ?? r.apply_url ?? r.url ?? r.id}`;
    const at = seen.get(id);
    if (at === undefined) {
      seen.set(id, kept.length);
      kept.push(r);
    } else {
      tidy.duplicates += 1;
      if (weight(r) > weight(kept[at])) kept[at] = r;
    }
  }
  rows.length = 0;
  for (const r of kept) rows.push(r);
}

// Who a scholarship is aimed at, as short codes. The codes must match ABOUT in
// src/lib/profile.ts. The database tags three groups itself; the rest are read
// from the name and the provider, with patterns kept narrow so that a donor
// called Black or a "Woman's Club" award is not mistaken for an eligibility rule.
const WHO = [
  ["w", /\b(wom[ae]n(?:'s|s)?(?! (club|league|auxiliary|guild|board|council))|female|girls|sorority|alumnae)\b/i, "women"],
  ["m", /\b(men's|men in|male|fraternity|young men|boys)\b/i],
  ["b", /\b(african[- ]american|black (students?|alumni|women|men|male|scholars?|faculty|caucus|law|greek|excellence|heritage|engineers|nurses|journalists|educators|graduate|business)|hbcu|naacp|uncf|nsbe)\b/i],
  ["h", /\b(hispanic|latin[oax]s?|latine|chican[oax])\b/i],
  ["na", /\b(native american|american indian|alaska native|native hawaiian|indigenous|tribal|tribe)\b/i],
  ["a", /\b(asian[- ](american|pacific)|pacific islander|aapi|hmong|filipino|(vietnamese|korean|chinese|japanese)[- ]american)\b/i],
  ["fg", /\bfirst[- ]gen/i, "first-generation"],
  ["q", /\b(lgbt\w*|queer|lesbian|transgender|gay (and|&|men|alliance|students?)|stonewall)\b/i],
  ["d", /\b(disabilit\w*|students with disab\w*|blind|visually impaired|hard of hearing|hearing impaired|deaf (students?|and hard)|autis\w*|dyslexi\w*|learning differenc\w*)\b/i],
  ["mil", /\b(veterans?|military|rotc|national guard|armed forces|gold star|service members?)\b/i, "military-connected"],
  ["intl", /\b(international students?|foreign students?|daca|undocumented|dreamers?|refugees?|immigrants?)\b/i],
  // Aimed at underrepresented students in general, without naming a group.
  ["min", /\b(minorit\w*|underrepresented|multicultural|diversity|students of color)\b/i],
];
// The database also reads each listing's own eligibility rules. Those say
// outright who an award is for, so a looser match is safe on them.
const CRITERIA_WHO = {
  gender: [["w", /wom[ae]n|female/i], ["m", /\b(men|male)\b/i]],
  heritage: [
    ["b", /\b(black|african)/i],
    ["h", /hispanic|latin|chican/i],
    ["na", /american indian|native|trib(e|al)|indigenous/i],
    ["a", /asian|pacific|hmong|filipino/i],
    ["min", /minorit|underrepresented|of color|bipoc/i],
  ],
  first_generation: [["fg", /./]],
  military: [["mil", /./]],
  disability: [["d", /./]],
};
function who(r) {
  // "Boys & Girls Club" and the YMCA are names, not rules.
  const text = `${r.name} ${r.provider_name ?? ""}`.replace(/boys (and|&) girls|young men'?s christian association|ymca|ywca|young women'?s christian association/gi, " ");
  const tags = r.tags ?? [];
  let codes = WHO.filter(([, re, tag]) => (tag && tags.includes(tag)) || re.test(text)).map(([code]) => code);
  // Naming both men and women restricts nobody.
  if (codes.includes("w") && codes.includes("m")) codes = codes.filter((c) => c !== "m" && (c !== "w" || tags.includes("women")));
  // A rule that only states a preference is marked "~": the award is open to
  // everyone and merely leans that way, so it must not read as "for" that group.
  const leans = [];
  for (const c of r.criteria ?? []) {
    const value = (c.values ?? []).join(" ") || "x";
    const hits = (CRITERIA_WHO[c.kind] ?? []).filter(([, re]) => re.test(value)).map(([code]) => code);
    if (hits.includes("w") && hits.includes("m")) continue;
    for (const code of hits) {
      if (c.strength === "preferred") leans.push(code);
      else if (!codes.includes(code)) codes.push(code);
    }
  }
  for (const code of leans) if (!codes.includes(code) && !codes.includes(`~${code}`)) codes.push(`~${code}`);
  const cit = r.citizenship ?? [];
  if (cit.includes("daca-undocumented") && !codes.includes("intl")) codes.push("intl");
  // States a citizenship rule that leaves out students without status.
  else if (cit.length > 0 && !cit.includes("daca-undocumented")) codes.push("cit");
  return codes.join(" ");
}

// ---- Required rules, for the filters -------------------------------------
// The database reads each listing's eligibility rules. The required ones are
// packed here so the browser can rule a scholarship out, or warn about it.

// Field of study: the rule names a subject in free text; these sort it into
// the buckets of FIELDS in src/lib/profile.ts. Codes must match.
const NO_FIELD = /^(any|all)\b|\b(any|all) (major|field|discipline|program)|related (field|area)|undeclared|declared major|^major$|^degree|(associate|bachelor|a a|aa|master) ?s? degree|general studies|technical field|interdisciplinary|liberal studies|program of study/;
const WIDE_FIELDS = [
  [/\bstem\b/, ["engineering", "tech", "science"]],
  [/arts? (and|&)? ?sciences|liberal arts/, ["humanities", "social", "science", "arts"]],
];
const SCIENCE_OF_SOMETHING_ELSE =
  /(computer|political|social|animal|health|food|exercise|library|fire|dairy|consumer|military|mortuary|sport|data|agricultural|information|nursing|veterinary|behavioral|poultry|plant|soil|crop|actuarial|family|police|management|building|aviation|equine|turf|range|meat|forensic)s? (and [a-z]+ )?scienc/;
const FIELD_BUCKETS = [
  ["business", /business|account|financ|marketing|\bmanagement|economic|hospitality|entrepreneur|\bmba\b|real estate|supply chain|commerce|insurance|human resource|logistic|banking|retail|sales\b|tourism/],
  ["engineering", /engineer|aerospace|surveying|robotic/],
  ["tech", /comput|software|information (system|technolog|science)|data (science|analy)|cyber|informatic|^it$|\bit (management|support|security|services?|degree|program|field)|^technology$|web (design|develop)|programming|game (design|develop)|network(ing)? /],
  ["health", /nurs|health|medic|pharm|dental|dentist|dietetic|nutrition|kinesiolog|pre.?med|therap|radiogra|radiolog|respiratory|athletic training|speech|sonogra|surgical|\bemt\b|paramedic|physician|optometr|clinical|exercise science|phlebotom|chiropract|gerontolog|mortuary|audiolog|podiatr|pediatr|surgery|funeral|\bmd program|rehabilitation/],
  ["education", /educat|teach|pedagog/],
  ["arts", /music|\bart\b|\barts\b|theat|dance|design|film|architect|\bband\b|choir|choral|orchestra|piano|voice|vocal|drama|photogra|painting|creative|studio|fashion|ceramic|sculpt|animation|cinema|instrument|jazz|opera|illustrat|violin|cello|flute|percussion|acting|poetry|recording|textile|merchandis/],
  ["science", /biolog|chemi|physic|\bmath|geolog|statistic|environment|astronom|ecolog|biochem|microbio|biotech|geoscien|earth scien|marine|zoolog|botan|neuroscien|meteorolog|ocean|genetic|actuarial/],
  ["social", /psycholog|sociolog|politic|social|criminal|criminolog|anthropolog|geograph|public (policy|admin|service|affairs)|human services|law enforcement|counsel|international (relations|studies|affairs)|urban|gender|ethnic|government|police|forensic|homeland|family|child development|human development|early childhood|justice|public safety|planning|recreation|archaeolog/],
  ["humanities", /english|histor|philosoph|language|literat|religio|writing|classics|spanish|french|german|humanit|theolog|ministry|linguist|divinity|biblical|latin|library|\bbible|m div|judaic|jewish|(american|asian|african|africana|armenian|italian|global|intercultural|genocide|native|indian) studies|italian|russian|chinese|japanese|literacy/],
  ["agriculture", /agri|agro|animal|horticult|forest|dairy|food science|veterinar|wildlife|natural resource|ranch|farm|equine|landscape|turf|soil|crop|fisher|poultry|plant|viticult|range |entomolog|\bdvm\b|equestrian/],
  ["communication", /journal|communicat|media|advertis|public relations|broadcast|radio|television/],
  ["law", /\blaw\b(?! enforcement)|legal|paralegal|juris|pre.?law|\bj\.?d\b|court reporting/],
  ["trades", /weld|hvac|automotiv|construction|culinary|manufactur|fire (science|fight|service|protect)|aviation|cosmetolog|electrician|electrical tech|plumb|machin|diesel|carpent|\btrades?\b|vocational|mechanic\b|lineman|line ?worker|industrial tech|truck|collision|baking|barber|heavy equipment|power ?line|maintenance|\bcdl\b|technical (program|certificate|diploma)|electronic|gunsmith|process technology|power distribution|occupational safety|industrial (distribution|hygiene)/],
];
function fieldGate(rules) {
  const hit = new Set();
  let unknown = false;
  for (const c of rules) {
    if (c.k !== "field") continue;
    for (const raw of c.v ?? []) {
      const v = String(raw).toLowerCase();
      if (NO_FIELD.test(v)) continue;
      const codes = new Set();
      for (const [re, wide] of WIDE_FIELDS) if (re.test(v)) for (const x of wide) codes.add(x);
      for (const [code, re] of FIELD_BUCKETS) if (re.test(v)) codes.add(code);
      if (/scienc/.test(v) && !SCIENCE_OF_SOMETHING_ELSE.test(v)) codes.add("science");
      // "Nursing informatics" and "health information technology" are health fields, not computing.
      if (codes.has("health") && codes.has("tech") && !/comput|software|cyber|data sci/.test(v)) codes.delete("tech");
      for (const x of codes) hit.add(x);
      const found = codes.size > 0;
      if (!found) unknown = true;
    }
  }
  // "x" alone: names a subject outside every bucket. "?": names one we could not place among others we could.
  if (hit.size === 0) return unknown ? "x" : "";
  return [...hit, ...(unknown ? ["?"] : [])].join(" ");
}

// Who it is restricted to, as groups a student must fall in. Within a group
// any one code will do ("b|h"); every group must be met. Codes match ABOUT.
function mustGate(rules) {
  const groups = [];
  const loose = []; // required, but not something the site asks about
  for (const c of rules) {
    const table = CRITERIA_WHO[c.k];
    if (!table) continue;
    const value = (c.words ?? c.v ?? []).join(", ") || c.k;
    const codes = table.filter(([, re]) => re.test(value)).map(([code]) => code);
    // "Men and women" restricts nobody.
    if (codes.includes("w") && codes.includes("m")) continue;
    if (codes.length) groups.push(codes.join("|"));
    else loose.push(value);
  }
  return { must: [...new Set(groups)].join(" "), loose };
}

// Other required things the site never asks about, shown as a warning.
const UNASKED = ["affiliation", "religion", "high_school", "family", "location", "age"];
const STATE_NAMES = new Set(["alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi","missouri","montana","nebraska","nevada","new hampshire","new jersey","new mexico","new york","north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island","south carolina","south dakota","tennessee","texas","utah","vermont","virginia","washington","west virginia","wisconsin","wyoming"]);
// "An accredited four-year college" names no college at all.
const GENERIC_COLLEGE = /accredited|college or university|colleges? and universit|institution|higher education|^(a|an|any) |^(community|technical|junior|vocational|trade|state|public|private|[24] year|two year|four year)[a-z0-9 -]*(college|university|school)s?$/;
const HBCU = /hbcu|historically black/;
const normName = (v) => String(v).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^the /, "");

// "Other" rules are mostly boilerplate; these say nothing a student could fail.
const BOILERPLATE =
  /standing|academic|scholastic|satisfactory|character|leadership|merit|grades?\b|potential|motivat|commit|interest|dedicat|outstanding|integrity|citizen|well.rounded|hard.?work|work ethic|deserving|worthy|promis|essay|application|applicant|apply|transcript|recommend|interview|enroll|attend|admitted|admission|accepted (to|at) (the |a |an )?(college|university|school|institution)|accepted for admission|degree|full.time|part.time|undergraduate|graduate|student|gpa|financial|need|fafsa|service|volunteer|involve|activit|achievement|excellen|ability|talent|creativ|desire|goal|plan|pursu|major|study|studies|career|complete|maintain|continu|renew|progress|eligible|qualif|require|demonstrat|show|exhibit|display|strong|good|high|active|participa|deadline|on time|submit|letter|resume|statement|record|perform|success|effort|initiative|passion|drive|ambition|persever|determin|responsib|respect|honest|ethic|value|attitude|spirit|pride|loyal|sincer|serious|mature|dependab|reliab|coopera|personal|contribut|impact|improv|community/;

// Guesses, for scholarships whose listing states no rule: a state named in the
// title or provider, a provider that is one college's foundation, a fraternity
// or sorority. Shown as "may be limited to", never used to rule anything out.
const STATE_BY_NAME = [
  ["new hampshire", "NH"], ["new jersey", "NJ"], ["new mexico", "NM"], ["new york", "NY"], ["north carolina", "NC"], ["north dakota", "ND"],
  ["south carolina", "SC"], ["south dakota", "SD"], ["west virginia", "WV"], ["rhode island", "RI"],
  ["alabama", "AL"], ["alaska", "AK"], ["arizona", "AZ"], ["arkansas", "AR"], ["california", "CA"], ["colorado", "CO"], ["connecticut", "CT"],
  ["delaware", "DE"], ["florida", "FL"], ["hawaii", "HI"], ["idaho", "ID"], ["illinois", "IL"], ["indiana", "IN"], ["iowa", "IA"],
  ["kansas", "KS"], ["kentucky", "KY"], ["louisiana", "LA"], ["maine", "ME"], ["maryland", "MD"], ["massachusetts", "MA"], ["michigan", "MI"],
  ["minnesota", "MN"], ["mississippi", "MS"], ["missouri", "MO"], ["montana", "MT"], ["nebraska", "NE"], ["nevada", "NV"], ["ohio", "OH"],
  ["oklahoma", "OK"], ["oregon", "OR"], ["pennsylvania", "PA"], ["tennessee", "TN"], ["texas", "TX"], ["utah", "UT"], ["vermont", "VT"],
  ["virginia", "VA"], ["wisconsin", "WI"], ["wyoming", "WY"], ["georgia", "GA"],
];
// A state's name, unless it is a county or street of that name.
const STATE_RES = STATE_BY_NAME.map(([name, code]) => [new RegExp(`\\b${name}\\b(?! (county|avenue|street|parish))`), code]);
const COLLEGE_FOUNDATION = /^(.*\b(college|university|institute of technology)\b.*?)\s+(philanthropic foundation|educational foundation|foundation|alumni association|research corporation|endowment|scholarship fund)\b/i;
function hints(r, colleges, states, cm) {
  const out = [];
  const text = normName(`${r.name} ${r.provider_name ?? ""}`);
  if (!states) {
    // A preferred location with a state is the best hint; then a state by name.
    const preferred = (r.criteria ?? []).find((c) => c.kind === "location" && c.state)?.state;
    const named = STATE_RES.find(([re]) => re.test(text))?.[1];
    if (preferred || named) out.push(`st:${preferred ?? named}`);
  }
  const foundation = !colleges && COLLEGE_FOUNDATION.exec(r.provider_name ?? "");
  if (foundation && !GENERIC_COLLEGE.test(normName(foundation[1]))) out.push(`col:${normName(foundation[1])}`);
  if (/\b(fraternity|sorority)\b/i.test(text) && !cm.some((c) => c.k === "affiliation")) out.push("greek");
  return out.join("|");
}

// [fields, must, states, colleges, extra, type, hints]; trailing blanks are dropped on write.
function gates(r, anySchool) {
  // The matching copy is lower-cased; where the two line up, the original wording reads better in a warning.
  const raw = r.criteria ?? [];
  const cm = r.criteria_match ?? [];
  const aligned = raw.length === cm.length && cm.every((c, i) => c.k === raw[i].kind);
  const rules = cm.map((c, i) => ({ ...c, words: aligned ? (raw[i].values ?? c.v) : c.v })).filter((c) => c.r === 1);
  const { must, loose } = mustGate(rules);
  const states = (r.required_states ?? []).join(" ");
  const colleges = [];
  const extra = [...loose];
  for (const c of rules) {
    const values = (c.words ?? []).map(String).filter(Boolean);
    if (c.k === "college" && anySchool) {
      for (const v of values) {
        const name = normName(v);
        if (HBCU.test(name)) extra.push("an HBCU");
        else if (!GENERIC_COLLEGE.test(name)) colleges.push(name);
      }
    } else if (c.k === "other") {
      const kept = values.filter((v) => v.length > 8 && !BOILERPLATE.test(v.toLowerCase()));
      if (kept.length) extra.push(kept[0]);
    } else if (UNASKED.includes(c.k)) {
      // A state by name is already covered by `states`.
      const kept = values.filter((v) => !(c.k === "location" && states && STATE_NAMES.has(v.toLowerCase())));
      if (kept.length) extra.push(kept.slice(0, 3).join(" or "));
    }
  }
  const text = [...new Set(extra)].slice(0, 3).join("; ");
  const named = colleges.slice(0, 4).join("|");
  return [
    fieldGate(rules),
    must,
    states,
    named,
    text.length > 110 ? `${text.slice(0, 109).trimEnd()}…` : text,
    r.twoYearOnly ? "cc" : "",
    anySchool ? hints(r, named, states, cm) : "",
  ];
}

const YOUNG = /\b(\d(st|nd|rd|th)|sixth|seventh|eighth|ninth) grade(rs?)?\b|middle school|elementary school|kindergarten/i;

const POSTGRAD = /post-?doc(toral)?\b|\bdoctoral\b|\bdissertation\b|\bph\.?d\b|\bpost-?graduate\b/i;

// The older columns are sparse. Where one is blank, the required rules fill it.
function backfill(r) {
  const rules = (r.criteria_match ?? []).filter((c) => c.r === 1);
  // Year in school. The rules are read from the listing itself and are more
  // exact than the older column, so they win wherever they name a year we ask about.
  const levels = rules.filter((c) => c.k === "level").flatMap((c) => c.v ?? []);
  const years = levels.filter((v) => GRADE_BITS.includes(v));
  if (years.length) r.grade_levels = [...new Set(years)];
  // Only for students below senior year of high school: nobody the site asks about.
  else if (levels.length && levels.every((v) => /^grade-(9|10|11)$/.test(v))) r.grade_levels = ["younger"];
  else if (!(r.grade_levels ?? []).length && YOUNG.test(r.name)) r.grade_levels = ["younger"];
  // Named for people past a first degree, with no year stated: not for undergraduates.
  else if (!(r.grade_levels ?? []).length && POSTGRAD.test(r.name)) r.grade_levels = ["graduate"];
  // Only for community college or trade school students, with no year named.
  r.twoYearOnly = levels.length > 0 && years.length === 0 && levels.every((v) => v === "community-college" || v === "trade-school");
  if (!r.minimum_gpa) {
    const g = rules.filter((c) => c.k === "gpa").map((c) => Number.parseFloat(c.v?.[0])).find((x) => x >= 1.5 && x <= 4);
    if (g) r.minimum_gpa = g;
  }
  if (!(r.citizenship ?? []).length) {
    const cit = rules.filter((c) => c.k === "citizenship").flatMap((c) => c.v ?? []);
    if (cit.length) r.citizenship = [...new Set(cit)];
  }
}

// The rest of what a scholarship's own page shows, packed into three numbers.
// The bit orders must match FLAG and TAGS in src/lib/rows.ts.
const TAGS = ["leadership", "community-service", "women", "first-generation", "military-connected", "athletics", "study-abroad", "stem", "adversity", "research", "work-experience"];
const flags = (r) =>
  (r.merit === "required" ? 1 : 0) |
  (r.merit === "considered" ? 2 : 0) |
  (r.enrollment === "full-time" ? 4 : 0) |
  (r.recommendations ? 8 : 0) |
  (r.transcript ? 16 : 0) |
  (r.interview ? 32 : 0) |
  (r.nomination ? 64 : 0) |
  (r.award_type === "full-cost" ? 128 : 0) |
  (r.award_type === "last-dollar" ? 256 : 0) |
  (r.summary ? 512 : 0) |
  (r.deadline_recurring ? 1024 : 0);
const tagBits = (r) => (r.tags ?? []).reduce((bits, t) => (TAGS.includes(t) ? bits | (1 << TAGS.indexOf(t)) : bits), 0);
// Days since 2025-01-01, when the listing was last checked against its source.
const EPOCH = Date.parse("2025-01-01T00:00:00Z");
const checked = (r) => (r.checked_at ? Math.max(0, Math.floor((Date.parse(r.checked_at) - EPOCH) / 86_400_000)) : 0);

// Address pieces. These must produce the same text as slugify() in
// src/lib/rows.ts and slugFor() in src/lib/schools.ts.
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "") || "scholarship";
const schoolSlug = (name, unitid) =>
  `${name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^the /, "").replace(/ /g, "-")}-${unitid}`;

// A scholarship's own page is offered to search engines only when the listing
// has a written summary, or states at least two real facts beyond its name. Must match isIndexable() in
// src/lib/rows.ts.
const isIndexable = (e) =>
  Boolean(e[15] & 512) ||
  [e[3], e[4] || e[5], e[12], e[10], e[11], e[7], e[14].replace(/\bcit\b/, "").trim(), e[8] || e[15] & 0b1111000].filter(Boolean).length >= 2;

// [id, name, url, deadline, min, max, perYear, need, essay, renewable, gradeBits, fields, minGpa, provider, who, flags, tagBits, checked,
//  fieldGate, must, states, colleges, extra]
const encode = (r, withProvider) => {
  backfill(r);
  const row = [...encodeBase(r, withProvider), ...gates(r, withProvider)];
  while (row.length > 18 && row[row.length - 1] === "") row.pop();
  return row;
};
const encodeBase = (r, withProvider) => [
  r.id,
  r.name,
  // The application itself when the database has it, else the page it was found on.
  r.apply_url || r.url || "",
  r.deadline ?? "",
  r.award_min ?? 0,
  r.award_max ?? 0,
  r.award_per_year ? 1 : 0,
  NEED[r.need] ?? "",
  r.essay ? 1 : 0,
  r.renewable ? 1 : 0,
  // Bit 6 means "younger than anyone we ask about", so every year filter rules it out.
  (r.grade_levels ?? []).reduce((bits, g) => bits | (g === "younger" ? 64 : 1 << Math.max(0, GRADE_BITS.indexOf(g))), 0),
  (r.fields_of_study ?? []).join(" "),
  r.minimum_gpa ?? 0,
  withProvider ? (r.provider_name ?? "") : "",
  who(r),
  flags(r),
  tagBits(r),
  checked(r),
];

// What a scholarship's own page shows beyond the list row. Kept out of the
// files the browser downloads: only the server reads these.
// [summary, [[required, quote], ...], states, materials, awards, source]
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const detail = (r) => {
  const rules = (r.criteria ?? [])
    .filter((c) => c.quote && c.quote.trim().length > 3)
    .slice(0, 10)
    .map((c) => [c.strength === "preferred" ? 0 : 1, clip(c.quote.replace(/\s+/g, " ").trim(), 220)]);
  const states = r.required_states ?? [];
  const materials = r.materials ?? [];
  if (!r.summary && rules.length === 0 && states.length === 0 && materials.length === 0 && !r.awards) return null;
  return [r.summary ?? "", rules, states, materials, r.awards ?? 0, r.source ?? ""];
};
const details = new Map(); // "any" or a school id -> { scholarship id: detail }
const keep = (key, r) => {
  const d = detail(r);
  if (!d) return;
  const bucket = details.get(key) ?? {};
  bucket[r.id] = d;
  details.set(key, bucket);
};

const bySchool = new Map();
const anyOpen = [];
const anyRest = [];
const providers = new Set();
for (const r of rows) {
  if (r.school_unitid === null) {
    providers.add(r.provider_name);
    keep("any", r);
    (r.deadline && r.deadline >= today ? anyOpen : anyRest).push(encode(r, true));
    continue;
  }
  keep(r.school_unitid, r);
  const list = bySchool.get(r.school_unitid) ?? [];
  list.push(encode(r, false));
  bySchool.set(r.school_unitid, list);
}

if (process.env.GATE_STATS) {
  const all = [...bySchool.values()].flat().concat(anyOpen, anyRest);
  const n = (f) => all.filter(f).length.toLocaleString();
  console.log("build-data: gates", {
    fieldGate: n((e) => e[18]),
    fieldOutside: n((e) => e[18] === "x"),
    fieldPartly: n((e) => (e[18] ?? "").includes("?")),
    must: n((e) => e[19]),
    states: n((e) => e[20]),
    colleges: n((e) => e[21]),
    extra: n((e) => e[22]),
    twoYearOnly: n((e) => e[23]),
    hints: n((e) => e[24]),
    hintState: n((e) => (e[24] ?? "").includes("st:")),
    hintCollege: n((e) => (e[24] ?? "").includes("col:")),
  });
}

await rm("public/data", { recursive: true, force: true });
await mkdir("public/data/s", { recursive: true });
await mkdir("src/generated", { recursive: true });

for (const [unitid, list] of bySchool) await writeFile(`public/data/s/${unitid}.json`, JSON.stringify(list));
await writeFile("public/data/any-open.json", JSON.stringify(anyOpen));
await writeFile("public/data/any-rest.json", JSON.stringify(anyRest));
await rm("src/generated/detail", { recursive: true, force: true });
await mkdir("src/generated/detail", { recursive: true });
for (const [key, bucket] of details) await writeFile(`src/generated/detail/${key}.json`, JSON.stringify(bucket));

// Addresses of every scholarship page worth a search engine's time, in files of
// at most 40,000 (a sitemap may hold 50,000).
const schoolById = new Map(schools.map((s) => [s.unitid, s]));
const paths = [];
for (const [unitid, list] of bySchool) {
  const s = schoolById.get(unitid);
  if (!s) continue;
  const base = `/schools/${schoolSlug(s.name, unitid)}`;
  for (const e of list) if (isIndexable(e)) paths.push(`${base}/${slugify(e[1])}-${e[0]}`);
}
for (const e of [...anyOpen, ...anyRest]) if (isIndexable(e)) paths.push(`/scholarships/${slugify(e[1])}-${e[0]}`);
await rm("src/generated/sitemap", { recursive: true, force: true });
await mkdir("src/generated/sitemap", { recursive: true });
const CHUNK = 40_000;
const sitemapFiles = Math.ceil(paths.length / CHUNK);
for (let i = 0; i < sitemapFiles; i++) {
  await writeFile(`src/generated/sitemap/${i}.json`, JSON.stringify(paths.slice(i * CHUNK, (i + 1) * CHUNK)));
}

// Figures the blog posts quote, so they are always the current ones.
const months = Array(12).fill(0);
const gpa = [0, 0, 0, 0]; // below 2.5, 2.5 to 2.99, 3.0 to 3.49, 3.5 and up
const awards = [];
let withDeadline = 0;
let essay = 0;
let needRequired = 0;
let renewable = 0;
for (const r of rows) {
  if (r.deadline) {
    withDeadline += 1;
    months[Number(r.deadline.slice(5, 7)) - 1] += 1;
  }
  if (r.minimum_gpa) gpa[r.minimum_gpa < 2.5 ? 0 : r.minimum_gpa < 3 ? 1 : r.minimum_gpa < 3.5 ? 2 : 3] += 1;
  if (r.award_max || r.award_min) awards.push(r.award_max || r.award_min);
  if (r.essay) essay += 1;
  if (r.need === "required") needRequired += 1;
  if (r.renewable) renewable += 1;
}
awards.sort((a, b) => a - b);
const stats = {
  total: rows.length,
  withDeadline,
  months,
  gpa,
  gpaStated: gpa.reduce((a, b) => a + b, 0),
  withAmount: awards.length,
  medianAward: awards.length ? awards[Math.floor(awards.length / 2)] : 0,
  essay,
  needRequired,
  renewable,
  pages: paths.length,
};

const count = (list) => [list.length, list.filter((r) => r[3] && r[3] >= today).length];
await writeFile(
  "src/generated/index.json",
  JSON.stringify({
    builtAt: new Date().toISOString(),
    // [unitid, name, city, state, level, total, open]
    schools: schools.map((s) => [s.unitid, s.name, s.city, s.state, s.level, ...count(bySchool.get(s.unitid) ?? [])]),
    anySchool: { total: anyOpen.length + anyRest.length, open: anyOpen.length, providers: providers.size },
    sitemapFiles,
    stats,
  }),
);

// Just the ids, for the check that turns unknown school addresses into a 404.
await writeFile("src/generated/school-ids.json", JSON.stringify(schools.map((s) => s.unitid)));

console.log(
  `build-data: tidied: ${tidy.renamed} names cleaned; left out ${tidy.notNames} that are not names, ${tidy.noLink.toLocaleString()} with no link, ` +
    `${tidy.secondHand.toLocaleString()} from other organizations' lists, ${tidy.duplicates.toLocaleString()} duplicates`,
);
console.log(
  `build-data: ${bySchool.size.toLocaleString()} school files, ${(anyOpen.length + anyRest.length).toLocaleString()} open to any school, ` +
    `${paths.length.toLocaleString()} scholarship pages for search, ${rows.length.toLocaleString()} scholarships in ${Math.round((Date.now() - started) / 1000)}s`,
);
