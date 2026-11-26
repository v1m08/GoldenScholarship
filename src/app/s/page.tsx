import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScholarshipDetail } from "@/components/ScholarshipDetail";
import { lead, type Offered } from "@/lib/describe";
import { getScholarship } from "@/lib/explore";
import { isIndexable, scholarshipPath } from "@/lib/rows";
import { getSchoolBySlug } from "@/lib/schools";

// One scholarship's page. People and crawlers reach it at
//   /schools/<school>/<scholarship>   and   /scholarships/<scholarship>
// which next.config.ts rewrites to here, with the two names as query values.
//
// It is done this way on purpose. A page whose address has a name in it is
// built and then stored the first time anyone asks for it, and there are tens
// of thousands of scholarships: crawlers walking all of them used up the
// hosting plan's storage writes in a day. A page that reads query values is
// simply rendered for each request and nothing is stored.

type Props = PageProps<"/s">;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function load(searchParams: Props["searchParams"]) {
  const sp = await searchParams;
  const scholarship = one(sp.id);
  const slug = one(sp.school);
  if (!scholarship) return null;
  if (!slug) {
    const detail = await getScholarship("open", scholarship);
    if (!detail) return null;
    const by = detail.row.provider || "its provider";
    const offered: Offered = { by, phrase: `from ${by}` };
    return { detail, offered, base: "/scholarships", unitid: 0, listName: "any school", title: detail.row.name };
  }
  const school = await getSchoolBySlug(slug);
  if (!school) return null;
  const detail = await getScholarship(school.unitid, scholarship);
  if (!detail) return null;
  const offered: Offered = { by: school.name, phrase: `at ${school.name}` };
  return {
    detail,
    offered,
    base: `/schools/${school.slug}`,
    unitid: school.unitid,
    listName: school.name,
    title: `${detail.row.name}, ${school.name}`,
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const found = await load(searchParams);
  if (!found) return { title: "Scholarship not found", robots: { index: false } };
  const { detail, offered, base, title } = found;
  return {
    title: `${title}: deadline, amount and how to apply`,
    description: lead(detail.row, offered, detail.status),
    alternates: { canonical: scholarshipPath(base, detail.row) },
    // Listings that state almost nothing stay out of search results.
    robots: isIndexable(detail.row) ? undefined : { index: false, follow: true },
  };
}

// The scholarship is looked up before anything is sent, so a wrong address gets a real 404.
export const instant = false;

export default async function ScholarshipPage({ searchParams }: Props) {
  const found = await load(searchParams);
  if (!found) notFound();
  const { detail, offered, base, unitid, listName } = found;
  return <ScholarshipDetail detail={detail} base={base} unitid={unitid} listName={listName} offered={offered} />;
}
