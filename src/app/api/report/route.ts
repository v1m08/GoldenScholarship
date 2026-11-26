import { NextResponse } from "next/server";
import { saveReport } from "@/lib/explore";
import { REPORT_KINDS } from "@/lib/profile";
import { getSchool } from "@/lib/schools";

const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// A student flags a problem with one listing.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // Honeypot: real users never fill this hidden field.
  if (typeof body.website === "string" && body.website) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const id = text(body.id, 80);
  const kind = REPORT_KINDS.find((k) => k.v === body.kind)?.v;
  if (!id || !kind) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // 0 means the list that is open to students at any school.
  const unitid = Number(body.unitid);
  if (!Number.isInteger(unitid) || (unitid !== 0 && !(await getSchool(unitid)))) {
    return NextResponse.json({ error: "invalid_school" }, { status: 400 });
  }

  const saved = await saveReport({
    scholarship_id: id,
    scholarship_name: text(body.name, 300),
    school_unitid: unitid === 0 ? null : unitid,
    kind,
    note: text(body.note, 1000),
    page: text(body.page, 500),
    analytics_id: text(body.analytics_id, 100),
  });
  // 503 tells the page that reports are not switched on, so it never claims success.
  return saved ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_ready" }, { status: 503 });
}
