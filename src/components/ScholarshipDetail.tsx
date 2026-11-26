import Link from "next/link";
import { ApplyLink, BackLink } from "@/components/Tracked";
import { site } from "@/lib/config";
import { eligibility, facts, faq, lead, longDate, materialWords, money, sourceWords, stateNames, type Offered } from "@/lib/describe";
import type { Detail } from "@/lib/explore";
import { FLAG, scholarshipPath } from "@/lib/rows";

/**
 * One scholarship's own page. Everything on it is plain server-rendered text
 * (no script is needed to read it), written so a search engine or an AI
 * assistant gets the answer in the first two sentences and the detail below.
 */
export function ScholarshipDetail({
  detail,
  base,
  unitid,
  listName,
  offered,
}: {
  detail: Detail;
  // The list this scholarship belongs to: "/schools/<slug>" or "/scholarships".
  base: string;
  // The school's id, or 0 for the any-school list.
  unitid: number;
  // What the list is called in links: the school's name, or "any school".
  listName: string;
  offered: Offered;
}) {
  const { row, more, status, daysLeft, related } = detail;
  const table = facts(row, offered, status);
  const who = eligibility(row);
  const questions = faq(row, offered, status);
  const intro = lead(row, offered, status);
  const required = more?.rules.filter((r) => r.required) ?? [];
  const preferred = more?.rules.filter((r) => !r.required) ?? [];
  const recurring = Boolean(row.flags & FLAG.recurring);
  const source = more ? sourceWords(more.source) : null;
  if (more?.states.length) {
    const from = stateNames(more.states);
    table.push({ label: "Residency", value: from });
    who.push(`You must be from ${from}.`);
    questions.push({ q: `Do I have to live in a certain state for the ${row.name}?`, a: `Yes. It is limited to students from ${from}.` });
  }
  if (more?.awards) table.push({ label: "Awards given", value: more.awards.toLocaleString("en-US") });
  if (more?.materials.length) {
    const needs = materialWords(more.materials);
    if (!table.some((f) => f.label === "Application needs")) {
      table.push({ label: "Application needs", value: needs.replace(/^./, (c) => c.toUpperCase()) });
      questions.splice(-1, 0, { q: "What does the application need?", a: `It asks for ${needs}.` });
    }
  }
  if (recurring) table.push({ label: "Repeats", value: "The same deadline comes round every year" });
  const amount = money(row);
  const path = scholarshipPath(base, row);
  const listLabel = unitid === 0 ? "Scholarships open to any school" : `${listName} scholarships`;

  // Structured data: what this is, who funds it, and where it sits on the site.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "MonetaryGrant",
      name: row.name,
      description: more?.summary ? `${more.summary} ${intro}` : intro,
      url: `${site.url}${path}`,
      ...(row.url ? { sameAs: row.url } : {}),
      funder: { "@type": unitid === 0 ? "Organization" : "CollegeOrUniversity", name: offered.by },
      ...(row.awardMax || row.awardMin
        ? {
            amount: {
              "@type": "MonetaryAmount",
              currency: "USD",
              ...(row.awardMin && row.awardMax && row.awardMin !== row.awardMax
                ? { minValue: row.awardMin, maxValue: row.awardMax }
                : { value: row.awardMax || row.awardMin }),
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: site.name, item: site.url },
        { "@type": "ListItem", position: 2, name: listLabel, item: `${site.url}${base}` },
        { "@type": "ListItem", position: 3, name: row.name, item: `${site.url}${path}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: questions.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
    },
  ];

  return (
    <article className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb">
        <BackLink id={row.id} fallback={base} label={listLabel} />
      </nav>

      <h1 className="mt-4 font-display text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[1] tracking-[-0.03em]">{row.name}</h1>
      {more?.summary && <p className="mt-5 text-xl leading-relaxed">{more.summary}</p>}
      <p className={`text-lg leading-relaxed ${more?.summary ? "mt-3 text-soft" : "mt-5"}`}>{intro}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {row.url && (
          <ApplyLink
            href={row.url}
            scholarshipId={row.id}
            unitid={unitid}
            daysLeft={daysLeft}
            className="press inline-flex items-center gap-2 rounded-full bg-blue px-6 py-3 font-display text-lg font-bold text-white hover:bg-ink"
          >
            Go to the official page <span aria-hidden="true">→</span>
          </ApplyLink>
        )}
        {status === "open" && daysLeft !== null && (
          <span className={`nums font-mono text-sm font-medium ${daysLeft <= 14 ? "text-due" : "text-soft"}`}>
            {daysLeft === 0 ? "closes today" : `${daysLeft} days left`}
          </span>
        )}
        {status === "closed" && <span className="font-mono text-sm text-soft">closed {longDate(row.deadline)}</span>}
      </div>

      <dl className="mt-8 overflow-hidden rounded-3xl border border-hair bg-sheet">
        {table.map((f) => (
          <div key={f.label} className="flex gap-4 border-b border-hair px-5 py-3 last:border-b-0">
            <dt className="w-36 shrink-0 font-mono text-xs uppercase tracking-wider text-soft sm:w-44">{f.label}</dt>
            <dd className="min-w-0 font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>

      {who.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold tracking-tight">Who can apply</h2>
          <ul className="mt-3 space-y-1.5 text-[17px]">
            {who.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {(required.length > 0 || preferred.length > 0) && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold tracking-tight">In the listing&rsquo;s own words</h2>
          {[
            { title: "Required", rules: required },
            { title: "Preferred", rules: preferred },
          ]
            .filter((g) => g.rules.length > 0)
            .map((g) => (
              <div key={g.title} className="mt-4">
                <h3 className="font-mono text-xs uppercase tracking-wider text-soft">{g.title}</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[17px]">
                  {[...new Set(g.rules.map((r) => r.text))].map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            ))}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight">Common questions</h2>
        <div className="mt-3 space-y-5">
          {questions.map((x) => (
            <div key={x.q}>
              <h3 className="font-semibold">{x.q}</h3>
              <p className="mt-1 text-soft">{x.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-sm text-soft">
        Details come from {source ?? `${offered.by}\u2019s own listing`}{row.checked ? `, last checked ${longDate(row.checked)}` : ""}. Always
        confirm the amount, deadline and rules on the official page before you apply.
      </p>

      {related.length > 0 && (
        <section className="mt-12 border-t border-hair pt-8">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {unitid === 0 ? "More scholarships open to any school" : `More scholarships at ${listName}`}
          </h2>
          <ul className="mt-4 overflow-hidden rounded-3xl border border-hair bg-sheet">
            {related.map((r) => (
              <li key={r.id} className="border-b border-hair last:border-b-0">
                <Link href={scholarshipPath(base, r)} className="row-hover flex items-baseline justify-between gap-4 px-5 py-3">
                  <span className="min-w-0 font-medium">{r.name}</span>
                  <span className="nums shrink-0 font-mono text-xs text-soft">
                    {[money(r), r.deadline ? `due ${longDate(r.deadline)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            <Link href={base} className="font-medium text-blue underline underline-offset-4">
              See every scholarship {unitid === 0 ? "open to any school" : `at ${listName}`}, with filters
            </Link>
          </p>
        </section>
      )}
      {/* The amount is repeated for screen readers that skip tables. */}
      {amount && <p className="sr-only">Award amount: {amount}</p>}
    </article>
  );
}
