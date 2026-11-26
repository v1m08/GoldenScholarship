import { ogCard, ogSize } from "@/lib/og";
import { getAnySchoolTotals, getTotals } from "@/lib/schools";

export const alt = "We make scholarships easy to find";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image() {
  const [totals, any] = await Promise.all([getTotals(), getAnySchoolTotals()]);
  return ogCard({
    kicker: "No account needed",
    title: "We make scholarships easy to find",
    foot: `${(totals.scholarships + any.total).toLocaleString("en-US")} scholarships at ${totals.schools.toLocaleString("en-US")} schools`,
  });
}
