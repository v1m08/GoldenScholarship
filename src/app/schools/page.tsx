import type { Metadata } from "next";
import Link from "next/link";
import { getSchoolsWithData } from "@/lib/schools";

export const metadata: Metadata = {
  title: "Scholarships by college: every school, by state",
  description: "Every US college and university we hold scholarships for, grouped by state. Pick a school to see its scholarships, deadlines and official links.",
  alternates: { canonical: "/schools" },
};

// Every school on one page, so people and search engines can reach each one by a link.
export default async function Schools() {
  const schools = await getSchoolsWithData(1);
  const byState = new Map<string, typeof schools>();
  for (const s of schools) {
    const key = s.state ?? "Other";
    byState.set(key, [...(byState.get(key) ?? []), s]);
  }
  const states = [...byState.keys()].sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <h1 className="font-display text-[clamp(2.4rem,7vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
        Scholarships by college
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-soft">
        {schools.length.toLocaleString("en-US")} schools, grouped by state. The number is how many scholarships we hold
        for each.
      </p>
      <nav className="mt-6 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wider">
        {states.map((st) => (
          <a key={st} href={`#${st}`} className="text-blue underline underline-offset-4">
            {st}
          </a>
        ))}
      </nav>
      {states.map((st) => (
        <section key={st} id={st} className="mt-10 scroll-mt-6 border-t border-hair pt-6">
          <h2 className="font-display text-2xl font-bold tracking-tight">{st}</h2>
          <ul className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {byState
              .get(st)!
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <li key={s.unitid} className="flex items-baseline justify-between gap-3">
                  <Link href={`/schools/${s.slug}`} prefetch={false} className="hover:text-blue hover:underline">
                    {s.name}
                  </Link>
                  <span className="nums font-mono text-xs text-soft">{s.total.toLocaleString("en-US")}</span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
