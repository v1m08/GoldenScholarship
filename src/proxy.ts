import { NextResponse, type NextRequest } from "next/server";
import ids from "@/generated/school-ids.json";

const known = new Set<number>(ids as number[]);

// School pages are static files, so nothing downstream gets the chance to
// answer "no such school" with the right status. This does: an address whose
// trailing id is not a real school is sent to a path that does not exist,
// which renders the normal not-found page with a 404.
export function proxy(request: NextRequest) {
  const m = /-(\d+)$/.exec(request.nextUrl.pathname);
  if (m && known.has(Number(m[1]))) return NextResponse.next();
  return NextResponse.rewrite(new URL("/no-such-page", request.url));
}

export const config = { matcher: "/schools/:slug" };
