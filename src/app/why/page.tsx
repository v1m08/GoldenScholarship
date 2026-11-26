import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { POSTS } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Why this exists",
  alternates: { canonical: "/why" },
  description:
    "Our goal is to make scholarships easier to find: no account, no sponsored listings, and a directory built from official IRS filings.",
};

const link = "font-medium text-blue underline underline-offset-4";

const POINTS: { head: ReactNode; body: ReactNode }[] = [
  {
    head: "No account needed",
    body: (
      <>
        Actually, we don&rsquo;t want your information at all! The full list of scholarships is open for anyone to
        see, whenever you&rsquo;d like.
      </>
    ),
  },
  {
    head: "We source the niche ones",
    body: "More than $100M of scholarship money goes unclaimed each year. We built our directory by looking at official scholarship tax reports (which are available to everyone on the IRS website), so we find the scholarships that no one else is talking about.",
  },
  {
    head: "No sponsored listings",
    body: "We won\u2019t make sponsored listings or spam you with emails. Our goal is to help you find scholarships that you could actually win.",
  },
  {
    head: (
      <>
        Advanced scholarship matching <em className="font-medium text-soft">(coming soon)</em>
      </>
    ),
    body: (
      <>
        The most winnable scholarships are those that take advantage of{" "}
        <a href="#belief" className={link}>
          niche communities we are a part of
        </a>
        . Unfortunately, large scholarship directories like Fastweb simply can&rsquo;t match you to that{" "}
        <span className="scratch">golden</span> scholarship. Our directory is built on official IRS filings and we use
        AI web agents to collect information that can be hard to find. This lets us match you to the perfect
        scholarship. <em>Full feature rollout coming soon.</em>
      </>
    ),
  },
  {
    head: "Advice from actual scholarship winners",
    body: "We drop blogs every so often detailing how you can win scholarships. Think of it as taking all the golden advice from all the scholarship subreddits and putting it in one place. We actually posted on Reddit, and reached 70k+ people doing so!",
  },
];

export default function Why() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 lg:py-16">
      <h1 className="font-display text-[clamp(2.4rem,7vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
        Scholarships made <span className="scratch">Golden</span>
      </h1>
      <ol className="mt-12 space-y-9">
        {POINTS.map((p, i) => (
          <li key={i} className="flex gap-5">
            <span className="nums pt-1 font-mono text-sm text-blue">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">{p.head}</h2>
              <p className="mt-2 text-lg leading-relaxed text-soft">{p.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href="/"
        className="press mt-10 inline-flex rounded-full bg-blue px-6 py-3 font-display text-lg font-bold text-white hover:bg-ink"
      >
        Find my school
      </Link>

      <section id="blog" className="mt-16 scroll-mt-24 border-t border-hair pt-10">
        <h2 className="font-display text-3xl font-bold tracking-tight">Blog</h2>
        <ul className="mt-5 overflow-hidden rounded-3xl border border-hair bg-sheet">
          {POSTS.map((p) => (
            <li key={p.slug} className="border-b border-hair last:border-b-0">
              <Link href={`/blog/${p.slug}`} className="row-hover block px-5 py-4">
                <h3 className="font-display text-xl font-bold leading-tight tracking-tight">{p.title}</h3>
                <p className="mt-1 text-soft">{p.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="font-display text-3xl font-bold tracking-tight">Why we started</h2>
        <div className="mt-4 space-y-4 text-lg leading-relaxed text-soft">
          <p>
            Our goal is simple: to make applying to scholarships as easy as possible. This project is built and
            maintained by past students who&rsquo;ve won the nation&rsquo;s most prestigious scholarships, and we know
            just how difficult it can be to find good scholarship opportunities. Each of us has won more than $500,000
            in scholarships across different universities, so we know how to find, plan for, and win large sums of
            money.
          </p>
          <p>
            Also, most of us are either working through or just finished our college applications. Do we really need to
            be worrying about finding the next thing to apply to? We don&rsquo;t think so. So just focus on applying,
            we&rsquo;ll find you the perfect opportunities :)
          </p>
        </div>
      </section>

      <section id="belief" className="mt-16 scroll-mt-24 border-t border-hair pt-10">
        <h2 className="font-display text-3xl font-bold tracking-tight">Our belief</h2>
        <p className="mt-4 text-lg leading-relaxed text-soft">
          We believe that the reason most people don&rsquo;t win scholarships is because they don&rsquo;t find the right
          ones. While your college counselor probably told you to spam apply to every scholarship you see, we believe
          it&rsquo;s much much more important to apply only to <em>the golden ones</em>.
        </p>
      </section>
    </div>
  );
}
