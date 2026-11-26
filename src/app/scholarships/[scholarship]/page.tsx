import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScholarshipDetail } from "@/components/ScholarshipDetail";
import { lead, type Offered } from "@/lib/describe";
import { getOpenRows, getScholarship } from "@/lib/explore";
import { isIndexable, scholarshipPath, slugify } from "@/lib/rows";

type Props = PageProps<"/scholarships/[scholarship]">;
const BASE = "/scholarships";

async function load(params: Props["params"]) {
  const { scholarship } = await params;
  const detail = await getScholarship("open", scholarship);
  if (!detail) return null;
  const by = detail.row.provider || "its provider";
  const offered: Offered = { by, phrase: `from ${by}` };
  return { detail, offered };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: "Scholarship not found", robots: { index: false } };
  const { detail, offered } = found;
  return {
    title: `${detail.row.name}: deadline, amount and how to apply`,
    description: lead(detail.row, offered, detail.status),
    alternates: { canonical: scholarshipPath(BASE, detail.row) },
    // Listings that state almost nothing stay out of search results.
    robots: isIndexable(detail.row) ? undefined : { index: false, follow: true },
  };
}

async function Body({ params }: { params: Props["params"] }) {
  const found = await load(params);
  if (!found) notFound();
  return <ScholarshipDetail detail={found.detail} base={BASE} unitid={0} listName="any school" offered={found.offered} />;
}

// The scholarship is looked up before anything streams, so a wrong address gets a real 404.
export const instant = false;

// The next few to close are built ahead of time; the rest on first request.
export async function generateStaticParams() {
  const { rows } = await getOpenRows("open", 40);
  return rows.map((r) => ({ scholarship: `${slugify(r.name)}-${r.id}` }));
}

export default async function ScholarshipPage({ params }: Props) {
  if (!(await load(params))) notFound();
  return (
    <Suspense fallback={<div className="mx-auto my-14 h-96 w-full max-w-3xl rounded-3xl border border-hair bg-sheet" />}>
      <Body params={params} />
    </Suspense>
  );
}
