import { ogCard, ogSize } from "@/lib/og";
import { getSchoolBySlug } from "@/lib/schools";

export const alt = "Scholarships at this school";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const school = await getSchoolBySlug((await params).slug);
  if (!school || school.total === 0) {
    return ogCard({ kicker: "No account needed", title: "We make scholarships easy to find", foot: "Type in your school" });
  }
  return ogCard({
    kicker: school.open > 0 ? `${school.open.toLocaleString("en-US")} open now` : "No account needed",
    title: school.name,
    foot: `${school.total.toLocaleString("en-US")} scholarships, with deadlines and official links`,
  });
}
