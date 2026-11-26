import type { Metadata } from "next";
import { Suspense } from "react";
import { Finder } from "@/components/Finder";
import { getAnySchoolTotals, getTotals } from "@/lib/schools";

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
    </>
  );
}
