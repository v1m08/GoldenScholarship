import { NextResponse, type NextRequest } from "next/server";
import { getSchool, searchSchools } from "@/lib/schools";

// School autocomplete: /api/schools?q=ucf   One school by id: /api/schools?id=100751
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  try {
    const id = sp.get("id");
    if (id) {
      const school = Number.isInteger(Number(id)) ? await getSchool(Number(id)) : null;
      return NextResponse.json({ schools: school ? [school] : [] });
    }
    return NextResponse.json({ schools: await searchSchools((sp.get("q") ?? "").slice(0, 80)) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ schools: [], error: "search_failed" }, { status: 500 });
  }
}
