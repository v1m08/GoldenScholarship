import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Finder } from "@/components/Finder";
import { SchoolLink } from "@/components/Tracked";
import { getAnySchoolTotals, getTopSchools, getTotals } from "@/lib/schools";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Three short facts under the search. The middle one is live from our data.
async function Facts() {
  // If the count is unavailable the page still stands; it just drops the live number.
  const [totals, open] = await Promise.all([getTotals().catch(() => null), getAnySchoolTotals()]);
  const facts = [
    { big: "$100M", small: "in scholarships goes unclaimed every year, by one estimate." },
    totals
      ? {
          big: (totals.scholarships + (open?.total ?? 0)).toLocaleString(),
          small: `scholarships from ${totals.schools.toLocaleString()} schools${
            open ? ` and ${open.providers.toLocaleString()} foundations` : ""
          }, in one place.`,
        }
      : { big: "Your school", small: "Its own scholarships, pulled from pages nobody links to." },
    { big: "Free", small: "No signup. We send you to the official page." },
  ];
  return (
    <ul className="mx-auto grid w-full max-w-4xl gap-6 px-5 pb-8 pt-4 text-center sm:grid-cols-3 sm:gap-8">
      {facts.map((f) => (
        <li key={f.big}>
          <p className="nums font-display text-3xl font-extrabold tracking-tight">{f.big}</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-sm leading-snug text-soft">{f.small}</p>
        </li>
      ))}
    </ul>
  );
}

const link = "font-medium text-blue underline underline-offset-4";

// Below the fold: what the site is, in plain words, with links into it. For a
// visitor who wants to know before typing, and for search engines, which
// otherwise see a search box and three numbers.
async function About() {
  const [totals, top] = await Promise.all([getTotals().catch(() => null), getTopSchools(12).catch(() => [])]);
  const any = getAnySchoolTotals();
  return (
    <section className="mx-auto w-full max-w-4xl border-t border-hair px-5 py-12">
      <h2 className="font-display text-3xl font-bold tracking-tight">Scholarships at your own college, and beyond it</h2>
      <div className="mt-4 space-y-4 text-lg leading-relaxed text-soft">
        <p>
          Most colleges give out hundreds of scholarships of their own, funded by departments, alumni and donors. Only
          students at that one school can apply, so they draw far fewer applicants than national awards. They are
          also hard to find: spread across department pages, PDF lists and application portals that nobody links to.
          GoldenScholarship gathers them into one list per school, with the deadline, the amount, who can apply and a
          link straight to the official page.
        </p>
        <p>
          {totals
            ? `We hold ${totals.scholarships.toLocaleString()} scholarships from ${totals.schools.toLocaleString()} US colleges, and `
            : "We also hold "}
          <Link href="/scholarships" className={link}>
            {any.total.toLocaleString()} scholarships open to students at any school
          </Link>
          , offered by {any.providers.toLocaleString()} community foundations and other organizations. Many of those
          are for students from one town, county or state, so they draw few applicants.
        </p>
        <p>
          It is free and there is no account to make. Type your school above, answer a few optional questions about
          your year, GPA and field, and the list narrows to the scholarships you can actually apply for. Listings are
          collected from each college&rsquo;s own pages and from the tax filings foundations publish, and each one
          shows when it was last checked. Always confirm the details on the official page before you apply.{" "}
          <Link href="/why" className={link}>
            Why we built it
          </Link>
          .
        </p>
      </div>
      {top.length > 0 && (
        <>
          <h3 className="mt-10 font-display text-xl font-bold tracking-tight">Schools with the most open right now</h3>
          <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {top.map((s) => (
              <li key={s.unitid} className="flex items-baseline justify-between gap-3">
                <SchoolLink slug={s.slug} unitid={s.unitid} source="top_schools" className={`min-w-0 truncate ${link}`}>
                  {s.name} scholarships
                </SchoolLink>
                <span className="nums shrink-0 font-mono text-xs text-soft">{s.open.toLocaleString()} open</span>
              </li>
            ))}
          </ul>
          <p className="mt-6">
            <Link href="/schools" className={link}>
              See every school <span aria-hidden="true">→</span>
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

// The home page is one thing: type your school.
export default function Home() {
  return (
    <>
      <Suspense fallback={<div className="min-h-[calc(100dvh-19rem)]" />}>
        <Finder />
      </Suspense>
      <Suspense fallback={<div className="h-28" />}>
        <Facts />
      </Suspense>
      <Suspense fallback={null}>
        <About />
      </Suspense>
    </>
  );
}
