import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Explorer } from "@/components/Explorer";
import { SchoolViewed } from "@/components/Tracked";
import { MIN_SCHOLARSHIPS_TO_INDEX } from "@/lib/config";
import { getInitialList, sourcesFor } from "@/lib/explore";
import { longDate, money } from "@/lib/describe";
import { site } from "@/lib/config";
import { scholarshipPath, type Result } from "@/lib/rows";
import { getSchoolBySlug, getSchoolsWithData } from "@/lib/schools";

export async function generateMetadata({ params }: PageProps<"/schools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) return { title: "School not found", robots: { index: false } };
  return {
    title:
      school.total > 0
        ? `${school.name} Scholarships: ${school.total.toLocaleString()} awards and deadlines`
        : `${school.name} Scholarships`,
    description:
      school.total > 0
        ? `${school.total.toLocaleString()} scholarships offered at ${school.name}, ${school.open.toLocaleString()} open now. Deadlines and direct links to each official page. No signup.`
        : `We have not collected ${school.name}'s scholarships yet.`,
    alternates: { canonical: `/schools/${school.slug}`, types: { "text/markdown": `/schools/${school.slug}/llms.txt` } },
    // Thin pages stay out of search results.
    robots: school.total >= MIN_SCHOLARSHIPS_TO_INDEX ? undefined : { index: false, follow: true },
  };
}

function Empty({ name }: { name: string }) {
  return (
    <section className="border-t border-rule pb-8 pt-10">
      <h2 className="font-display text-3xl font-bold tracking-tight">No scholarships at {name} yet</h2>
      <p className="mt-2 max-w-xl text-lg text-soft">
        But here are others you can check out. They are open to students at any school, and your visit just put {name}{" "}
        on our list to collect.
      </p>
    </section>
  );
}

// The any-school list, shown under the "nothing here yet" note.
async function Others() {
  const initial = await getInitialList("open");
  return (
    <Suspense fallback={<PlainList data={initial} base="/scholarships" />}>
      <Explorer
        base="/scholarships"
        unitid={0}
        school="every foundation"
        sources={sourcesFor("open")}
        initial={initial}
        initialStatus={initial.status}
      />
    </Suspense>
  );
}

async function School({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const header = (
    <header className="py-8 lg:py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {school.name}
      </h1>
      <p className="mt-1 font-mono text-sm text-soft">{[school.city, school.state].filter(Boolean).join(", ")}</p>
    </header>
  );

  const viewed = (
    <SchoolViewed
      unitid={school.unitid}
      school={school.name}
      state={school.state}
      scholarships={school.total}
      open={school.open}
    />
  );

  if (school.total === 0) {
    return (
      <>
        {viewed}
        {header}
        <Empty name={school.name} />
        <Others />
      </>
    );
  }

  // The unfiltered list, rendered on the server so search engines see it.
  const initial = await getInitialList(school.unitid);

  // One plain sentence with the numbers, for search engines and AI assistants
  // that read the page without running it.
  const next = initial.status === "open" ? initial.rows[0] : undefined;
  const base = `/schools/${school.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Scholarships at ${school.name}`,
    numberOfItems: school.total,
    itemListElement: initial.rows.slice(0, 25).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${site.url}${scholarshipPath(base, r)}`,
    })),
  };

  return (
    <>
      {viewed}
      {header}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="-mt-3 mb-8 max-w-3xl text-soft lg:-mt-5">
        {school.name} has {school.total.toLocaleString()} scholarships listed here, {school.open.toLocaleString()} of them open
        now.
        {next
          ? ` The next to close is ${next.name}${money(next) ? ` (${money(next)})` : ""}, due ${longDate(next.deadline)}.`
          : ""}{" "}
        Each links to its official page.
      </p>
      {/* Until the interactive list loads, this plain version stands in for it. */}
      <Suspense fallback={<PlainList data={initial} base={`/schools/${school.slug}`} />}>
        <Explorer
          base={`/schools/${school.slug}`}
          unitid={school.unitid}
          school={school.name}
          sources={sourcesFor(school.unitid)}
          initial={initial}
          initialStatus={initial.status}
          extra={sourcesFor("open")}
          fourYear={school.level === "four-year"}
        />
      </Suspense>
    </>
  );
}

function PlainList({ data, base }: { data: Result; base: string }) {
  return (
    <section className="pb-16">
      <h2 className="font-display text-4xl font-extrabold tracking-tight">
        <span className="nums text-blue">{data.total.toLocaleString()}</span> scholarships
      </h2>
      <ul className="mt-6 overflow-hidden rounded-3xl border border-hair bg-sheet">
        {data.rows.map((s) => (
          <li key={s.id} className="flex gap-4 border-b border-hair px-5 py-4 last:border-b-0">
            <span className="nums w-24 shrink-0 font-mono text-sm text-soft">{s.deadline || "no date"}</span>
            <Link href={scholarshipPath(base, s)} className="text-[17px] font-semibold underline underline-offset-4">
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The school is looked up before anything streams. Every page is prebuilt, so
// this costs nothing at runtime.
export const instant = false;

// Every school is built ahead of time from the exported files, so each page
// is plain static HTML, including the "not collected yet" page for schools we
// hold nothing for.
export async function generateStaticParams() {
  const all = await getSchoolsWithData(0);
  return all.map((s) => ({ slug: s.slug }));
}

export default async function SchoolPage({ params }: PageProps<"/schools/[slug]">) {
  // Unknown ids never reach here: src/proxy.ts answers those with a 404.
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-5">
      <Suspense fallback={<div className="my-14 h-96 border border-hair bg-sheet" />}>
        <School params={params} />
      </Suspense>
    </div>
  );
}
