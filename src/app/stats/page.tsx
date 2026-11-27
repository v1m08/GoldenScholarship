import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SchoolLink } from "@/components/Tracked";
import { getAnySchoolTotals, getTopSchools, getTotals } from "@/lib/schools";

export const metadata: Metadata = {
  title: "What we have",
  alternates: { canonical: "/stats" },
  description: "How many scholarships are on file from colleges and from foundations, how many are still open, and which schools have the most.",
};

async function Totals() {
  // The same two sources the home page adds up, so the numbers always agree.
  const { schools, scholarships, open } = await getTotals();
  const any = getAnySchoolTotals();
  const items = [
    { n: scholarships + any.total, label: "scholarships on file" },
    { n: open + any.open, label: "with a deadline still ahead" },
    { n: schools, label: "schools" },
  ];
  return (
    <>
    <dl className="grid max-w-3xl grid-cols-3 gap-4">
      {items.map((it) => (
        <div key={it.label}>
          <dd className="nums font-display text-[clamp(1.6rem,5vw,3.5rem)] font-extrabold leading-none tracking-tight">
            {it.n.toLocaleString()}
          </dd>
          <dt className="mt-2 font-mono text-xs uppercase tracking-wider text-soft">{it.label}</dt>
        </div>
      ))}
    </dl>
    <p className="mt-6 max-w-3xl text-soft">
      {scholarships.toLocaleString()} are offered by {schools.toLocaleString()} colleges to their own students, and{" "}
      {any.total.toLocaleString()} come from {any.providers.toLocaleString()} foundations and are open to students at any
      school. Of those, {open.toLocaleString()} and {any.open.toLocaleString()} have a deadline that has not passed yet;
      many of the rest list no date at all.
    </p>
    </>
  );
}

async function TopSchools() {
  const schools = await getTopSchools(12);
  return (
    <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
      {schools.map((s) => (
        <li key={s.unitid} className="bg-sheet">
          <SchoolLink
            slug={s.slug}
            unitid={s.unitid}
            source="top_schools"
            className="row-hover flex items-baseline justify-between gap-3 px-4 py-3"
          >
            <span className="min-w-0 truncate font-medium">{s.name}</span>
            <span className="nums shrink-0 font-mono text-xs text-soft">{s.open.toLocaleString()} open</span>
          </SchoolLink>
        </li>
      ))}
    </ul>
  );
}

export default function Stats() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5">
      <section className="py-10 lg:py-14">
        <h1 className="font-display text-[clamp(2.4rem,7vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
          What we have
        </h1>
        <div className="mt-10">
          <Suspense fallback={<div className="h-20" />}>
            <Totals />
          </Suspense>
        </div>
      </section>

      <section className="border-t border-rule py-10 lg:py-14">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Most open right now</h2>
        <div className="mt-6">
          <Suspense fallback={<div className="h-40 border border-hair bg-sheet" />}>
            <TopSchools />
          </Suspense>
        </div>
        <p className="mt-6">
          <Link href="/schools" className="font-medium text-blue underline underline-offset-4">
            See every school <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>
    </div>
  );
}
