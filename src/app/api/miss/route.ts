import { NextResponse } from "next/server";
import { recordMiss } from "@/lib/schools";

const KINDS = new Set(["no_school_match", "school_no_data", "no_scholarship_match"]);

// Records something a student looked for and did not find.
export async function POST(request: Request) {
  let body: { kind?: unknown; query?: unknown; unitid?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof body.kind !== "string" || !KINDS.has(body.kind)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const query = typeof body.query === "string" && body.query.trim() ? body.query.trim() : null;
  const unitid = Number.isInteger(body.unitid) ? (body.unitid as number) : null;
  await recordMiss(body.kind, query, unitid);
  return NextResponse.json({ ok: true });
}
