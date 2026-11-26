import type { Metadata } from "next";
import { Suspense } from "react";
import { AgentNote } from "@/components/AgentNote";
import { Explorer } from "@/components/Explorer";
import { getInitialList, sourcesFor } from "@/lib/explore";
import { getAnySchoolTotals } from "@/lib/schools";

export const metadata: Metadata = {
  title: "Scholarships open to students at any school",
  description:
    "Scholarships from community foundations and organisations that are not tied to one college. Filter by year, GPA, need and deadline. No signup.",
  alternates: { canonical: "/scholarships", types: { "text/markdown": "/scholarships/llms.txt" } },
};

async function List() {
  const [initial, totals] = await Promise.all([getInitialList("open"), getAnySchoolTotals()]);
  return (
    <>
      <header className="py-8 lg:py-10">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Open to any school</h1>
        <p className="mt-1 max-w-2xl text-soft">
          {totals.total.toLocaleString()} scholarships from {totals.providers.toLocaleString()} foundations and
          organisations. Many are for one town, county or state, so search yours.
        </p>
      </header>
      <Suspense fallback={<div className="h-96 rounded-3xl border border-hair bg-sheet" />}>
        <Explorer base="/scholarships" unitid={0} school="every foundation" sources={sourcesFor("open")} initial={initial} initialStatus={initial.status} />
      </Suspense>
      <AgentNote base="/scholarships" />
    </>
  );
}

export default function AnySchool() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5">
      <Suspense fallback={<div className="my-14 h-96 rounded-3xl border border-hair bg-sheet" />}>
        <List />
      </Suspense>
    </div>
  );
}
