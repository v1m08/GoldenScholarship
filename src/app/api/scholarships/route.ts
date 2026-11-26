import { findOne, listResponse } from "@/lib/agent";
import { getSchool, getSchoolBySlug } from "@/lib/schools";

// The filtered lists as JSON, for AI assistants and scripts.
//   /api/scholarships?g=college-junior&f=tech&gpa=3.7&st=TX     open to any school
//   /api/scholarships?school=139755&g=...                        one school's, then any-school ones
//   /api/scholarships?id=<scholarship id>[&school=<id>]          one scholarship in full
// Parameters are described at /llms.txt.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const headers = { "access-control-allow-origin": "*" };
  const which = sp.get("school")?.trim();
  const school = which ? (/^\d+$/.test(which) ? await getSchool(Number(which)) : await getSchoolBySlug(which)) : null;
  if (which && !school) {
    return Response.json({ error: "no_such_school", hint: "Look up a school's id at /api/schools?q=<name>." }, { status: 404, headers });
  }

  const id = sp.get("id")?.trim();
  if (id) {
    const one = /^[0-9a-f]{8,40}$/.test(id) ? await findOne(id, school) : null;
    if (!one) {
      return Response.json(
        { error: "not_found", hint: "A school's own scholarship needs school=<id> as well as id." },
        { status: 404, headers },
      );
    }
    return Response.json(one, { headers: { ...headers, "cache-control": "public, max-age=600, s-maxage=3600" } });
  }

  // Always JSON here, whatever `format` says.
  const url = new URL(request.url);
  url.searchParams.set("format", "json");
  const route = school ? `/schools/${school.slug}/llms.txt` : "/scholarships/llms.txt";
  return listResponse(new Request(url), school, route);
}
