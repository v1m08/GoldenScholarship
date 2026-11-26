// Works through the problems students flag on listings (scholarship_reports).
//
//   npm run reports                          open reports, grouped by listing, with what
//                                            we hold now; also written to reports/open.json
//   npm run reports -- set <id> field=value  correct the listing in the database and close
//                                            its reports. Fields: url, apply_url, deadline,
//                                            award_min, award_max, status. "null" clears one.
//   npm run reports -- fixed <id> [...]      close reports without changing the listing
//   npm run reports -- ignored <id> [...]    close reports that were wrong
//
// <id> is a listing's id (closes all of its open reports) or a report's number.
// The site reads the database only when it builds, so a correction shows up
// after the next `npm run data` and deploy (the daily build does both).

import { mkdir, writeFile } from "node:fs/promises";

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_BASE || !KEY) {
  console.error("reports: set SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  process.exit(1);
}
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://goldenscholarship.com").replace(/\/$/, "");
const OUT = "reports/open.json";
// The listing fields worth seeing next to a report, and the ones `set` may change.
const SHOWN = "id,name,url,apply_url,deadline,award_min,award_max,status,school_unitid,provider_name,checked_at";
const SETTABLE = ["url", "apply_url", "deadline", "award_min", "award_max", "status"];
const NUMERIC = ["award_min", "award_max"];
// Which of a listing's fields each reason is about.
const ABOUT = {
  broken_link: ["url", "apply_url"],
  wrong_deadline: ["deadline"],
  closed: ["deadline", "status"],
  wrong_amount: ["award_min", "award_max"],
  wrong_school: ["school_unitid", "provider_name"],
};

async function call(pathAndQuery, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json", Prefer: "return=representation", ...init.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const quoted = (ids) => ids.map((id) => `"${id}"`).join(",");
// A listing id is hex and long; a report number is short digits.
const isReport = (id) => /^\d{1,7}$/.test(id);

async function close(ids, status) {
  let closed = 0;
  const reports = ids.filter(isReport);
  const listings = ids.filter((id) => !isReport(id));
  const patch = { method: "PATCH", body: JSON.stringify({ status }) };
  if (reports.length) closed += (await call(`scholarship_reports?id=in.(${reports.join(",")})`, patch)).length;
  if (listings.length) closed += (await call(`scholarship_reports?status=eq.new&scholarship_id=in.(${quoted(listings)})`, patch)).length;
  return closed;
}

async function list() {
  const reports = await call("scholarship_reports?status=eq.new&order=created_at.desc&limit=2000");
  if (!reports.length) {
    console.log("reports: nothing open.");
    await mkdir("reports", { recursive: true });
    await writeFile(OUT, "[]\n");
    return;
  }
  const ids = [...new Set(reports.map((r) => r.scholarship_id))];
  const listings = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    for (const s of await call(`scholarships?select=${SHOWN}&id=in.(${quoted(ids.slice(i, i + 100))})`)) listings.set(s.id, s);
  }
  const unitids = [...new Set([...listings.values()].map((s) => s.school_unitid).filter(Boolean))];
  const schools = new Map();
  for (let i = 0; i < unitids.length; i += 200) {
    for (const s of await call(`schools?select=unitid,name&unitid=in.(${unitids.slice(i, i + 200).join(",")})`)) schools.set(s.unitid, s.name);
  }

  const groups = new Map();
  for (const r of reports) {
    // A report saved before the table knew the newer reasons carries the real one at the front of its note.
    const tagged = r.note?.match(/^\[([a-z_]+)\]\s*(.*)$/s);
    const kind = tagged ? tagged[1] : r.kind;
    const note = tagged ? tagged[2] || null : r.note;
    const now = listings.get(r.scholarship_id) ?? null;
    const g = groups.get(r.scholarship_id) ?? {
      scholarship_id: r.scholarship_id,
      name: now?.name ?? r.scholarship_name,
      school: now?.school_unitid ? (schools.get(now.school_unitid) ?? now.school_unitid) : now ? "any school" : null,
      // null means the listing is no longer in the database.
      now,
      page: r.page ? `${SITE}${r.page}` : null,
      kinds: {},
      reports: [],
    };
    g.kinds[kind] = (g.kinds[kind] ?? 0) + 1;
    g.reports.push({ id: r.id, kind, note, at: r.created_at });
    groups.set(r.scholarship_id, g);
  }
  const out = [...groups.values()].sort((a, b) => b.reports.length - a.reports.length);
  await mkdir("reports", { recursive: true });
  await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`);

  const totals = {};
  for (const g of out) for (const [k, n] of Object.entries(g.kinds)) totals[k] = (totals[k] ?? 0) + n;
  console.log(`reports: ${reports.length} open on ${out.length} listings  (${Object.entries(totals).map(([k, n]) => `${k} ${n}`).join(", ")})\n`);
  for (const g of out) {
    console.log(`${g.scholarship_id}  ${g.name ?? "(no name)"}${g.school ? `  [${g.school}]` : ""}`);
    if (!g.now) console.log("    no longer in the database");
    const fields = [...new Set(Object.keys(g.kinds).flatMap((k) => ABOUT[k] ?? []))];
    if (g.now && fields.length) console.log(`    now: ${fields.map((f) => `${f}=${g.now[f] ?? "null"}`).join("  ")}`);
    for (const r of g.reports) console.log(`    #${r.id} ${r.kind}${r.note ? `: ${r.note.replace(/\s+/g, " ")}` : ""}  (${r.at.slice(0, 10)})`);
    if (g.page) console.log(`    ${g.page}`);
  }
  console.log(`\nFull detail in ${OUT}`);
}

async function set(id, pairs) {
  const change = {};
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    const field = pair.slice(0, at);
    const raw = pair.slice(at + 1);
    if (at < 1 || !SETTABLE.includes(field)) throw new Error(`cannot set "${pair}". Fields: ${SETTABLE.join(", ")}`);
    change[field] = raw === "null" || raw === "" ? null : NUMERIC.includes(field) ? Number(raw) : raw;
    if (Number.isNaN(change[field])) throw new Error(`${field} needs a number, got "${raw}"`);
  }
  if (!Object.keys(change).length) throw new Error("nothing to set: give field=value");
  const [before] = await call(`scholarships?select=${SHOWN}&id=eq.${encodeURIComponent(id)}`);
  if (!before) throw new Error(`no listing with id ${id}`);
  await call(`scholarships?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change) });
  console.log(before.name);
  for (const [f, v] of Object.entries(change)) console.log(`  ${f}: ${before[f] ?? "null"} -> ${v ?? "null"}`);
  console.log(`  ${await close([id], "fixed")} report(s) closed. The site shows it after the next build.`);
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (!command || command === "list") await list();
  else if (command === "set" && rest.length) await set(rest[0], rest.slice(1));
  else if ((command === "fixed" || command === "ignored") && rest.length) console.log(`${await close(rest, command)} report(s) marked ${command}.`);
  else {
    console.error("usage: npm run reports [-- set <id> field=value ... | fixed <id> ... | ignored <id> ...]");
    process.exit(1);
  }
} catch (e) {
  console.error(`reports: ${e.message}`);
  process.exit(1);
}
