import { NextResponse } from "next/server";
import { saveSubscriber } from "@/lib/explore";
import { ABOUT, parseFilters } from "@/lib/profile";
import { getSchool } from "@/lib/schools";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CONTEXT_CHARS = 20_000;

// Optional email signup, offered after a student has seen their list. Stores
// the address together with what they were looking for.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // Honeypot: real users never fill this hidden field.
  if (typeof body.website === "string" && body.website) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  // 0 means the list that is open to students at any school.
  const unitid = Number(body.unitid);
  if (!Number.isInteger(unitid) || (unitid !== 0 && !(await getSchool(unitid)))) {
    return NextResponse.json({ error: "invalid_school" }, { status: 400 });
  }

  // Keep the context only if it is a plain object of reasonable size.
  const raw = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? (body.context as Record<string, unknown>) : {};
  const details = JSON.stringify(raw).length <= MAX_CONTEXT_CHARS ? raw : {};
  const f = (details.filters ?? {}) as Record<string, unknown>;
  const answers = parseFilters((k) => (typeof f[k] === "string" ? (f[k] as string) : null));

  const saved = await saveSubscriber(email, unitid === 0 ? null : unitid, {
    profile: { g: answers.g, f: answers.f, gpa: answers.gpa, n: answers.n },
    summary: typeof details.summary === "string" ? details.summary.slice(0, 600) : null,
    about: Array.isArray(details.about) ? ABOUT.filter((a) => (details.about as unknown[]).includes(a.v)).map((a) => a.v) : [],
    details,
  });
  // 503 tells the page that signups are not switched on, so it never claims success.
  return saved ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_ready" }, { status: 503 });
}
