import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScholarshipDetail } from "@/components/ScholarshipDetail";
import { lead, type Offered } from "@/lib/describe";
import { getOpenRows, getScholarship } from "@/lib/explore";
import { isIndexable, scholarshipPath, slugify } from "@/lib/rows";
import { getSchoolBySlug, getTopSchools } from "@/lib/schools";

type Props = PageProps<"/schools/[slug]/[scholarship]">;

async function load(params: Props["params"]) {
  const { slug, scholarship } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) return null;
  const detail = await getScholarship(school.unitid, scholarship);
  if (!detail) return null;
  const offered: Offered = { by: school.name, phrase: `at ${school.name}` };
  return { school, detail, offered, base: `/schools/${school.slug}` };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: "Scholarship not found", robots: { index: false } };
  const { school, detail, offered, base } = found;
  return {
    title: `${detail.row.name}, ${school.name}: deadline, amount and how to apply`,
    description: lead(detail.row, offered, detail.status),
    alternates: { canonical: scholarshipPath(base, detail.row) },
    // Listings that state almost nothing stay out of search results.
    robots: isIndexable(detail.row) ? undefined : { index: false, follow: true },
  };
}

async function Body({ params }: { params: Props["params"] }) {
  const found = await load(params);
  if (!found) notFound();
  const { school, detail, offered, base } = found;
  return <ScholarshipDetail detail={detail} base={base} unitid={school.unitid} listName={school.name} offered={offered} />;
}

// The scholarship is looked up before anything streams, so a wrong address gets a real 404.
export const instant = false;

// A sample is built ahead of time: the next scholarship to close at each of
// the largest schools. Every other page is built the first time someone asks
// for it, then kept.
export async function generateStaticParams() {
  const schools = await getTopSchools(40);
  const out: { slug: string; scholarship: string }[] = [];
  for (const s of schools) {
    const { rows } = await getOpenRows(s.unitid, 1);
    if (rows[0]) out.push({ slug: s.slug, scholarship: `${slugify(rows[0].name)}-${rows[0].id}` });
  }
  return out;
}

export default async function ScholarshipPage({ params }: Props) {
  if (!(await load(params))) notFound();
  return (
    <Suspense fallback={<div className="mx-auto my-14 h-96 w-full max-w-3xl rounded-3xl border border-hair bg-sheet" />}>
      <Body params={params} />
    </Suspense>
  );
}
