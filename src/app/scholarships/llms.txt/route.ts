import { listResponse } from "@/lib/agent";

// Scholarships open to students at any school, as plain Markdown (or JSON with
// format=json). Honors the same filters as the page, plus `page`: see /llms.txt.
export async function GET(request: Request) {
  return listResponse(request, null, "/scholarships/llms.txt");
}
