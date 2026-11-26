import { listResponse } from "@/lib/agent";
import { getSchoolBySlug } from "@/lib/schools";

// One school's scholarships as plain Markdown (or JSON with format=json): its
// own first, then those open to any school. Honors the same filters as the
// page, plus `page`: see /llms.txt.
export async function GET(request: Request, { params }: RouteContext<"/schools/[slug]/llms.txt">) {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) return new Response("No such school. Find a school's address at /api/schools?q=<name>.\n", { status: 404 });
  return listResponse(request, school, `/schools/${school.slug}/llms.txt`);
}
