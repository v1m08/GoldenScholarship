import Link from "next/link";
import type { ReactNode } from "react";

// Blog posts. Each one is a function that returns the body of the post; add it
// to POSTS at the bottom to publish it.

const TIPS: { head: string; body: ReactNode }[] = [
  {
    head: "Start early",
    body: "If you can start a couple years in advance, this will ensure that you don\u2019t miss any deadlines for scholarships that you qualify for. There are also many scholarships that you can apply to as a junior, so don\u2019t wait until your senior year to start thinking about how you\u2019ll pay for college.",
  },
  {
    head: "Institution scholarships",
    body: (
      <>
        Look specifically for institution scholarships at your safety and match schools. Most schools have merit-based
        scholarships you can apply to, and at large state schools there are usually hundreds of them that students
        don&rsquo;t notice. That&rsquo;s what this site lists:{" "}
        <Link href="/" >
          type in a school
        </Link>{" "}
        and you&rsquo;ll see them. More selective &ldquo;reach&rdquo; schools don&rsquo;t usually offer as many
        scholarships that you can directly apply for, and rely more on need-based aid.
      </>
    ),
  },
  {
    head: "PSAT",
    body: "Do your best on your PSAT!! Most students don\u2019t know about this, but there are a ton of state schools which offer full rides to National Merit semifinalists. Even if you aren\u2019t particularly interested in going to one of these schools, this is a great way to ensure you have a backup plan.",
  },
  {
    head: "Essays",
    body: "This is especially important for the larger scholarships which have tedious application processes. Research the mission of the scholarship deeply and try to highlight that in your essays and application (most large-dollar scholarships are some form of endowment, and are made for specific purposes, so research that thoroughly). This will help you stand out, and this is what I did to win my scholarship (although I can\u2019t say for sure how big of an impact this may have had).",
  },
  {
    head: "Local scholarships",
    body: (
      <>
        These are usually around $500 to $10,000, and if you win enough they will definitely add up. Your area will
        most likely have some form of scholarship foundation that helps facilitate applications. Do your research into
        these programs, check the{" "}
        <Link href="/scholarships" >
          directory
        </Link>{" "}
        for foundations near you, and apply to the ones you fit. Repurpose your essays if you can so that you can
        apply to more.
      </>
    ),
  },
  {
    head: "What scholarships usually look for",
    body: "This ties in with the essays tip, but most scholarships are trying to award students who have had a positive impact on their community. You can definitely find scholarships that award pure merit, but a majority of scholarships target students who show some form of leadership in their community. Try to get involved with such programs if they align with your passions. For example, I led a math tutoring organization which partnered with sister schools in my area, and recruited 20+ volunteers to help grow the program. I\u2019ve always been passionate about math, and that showed through my application because I listed various math competition awards.",
  },
  {
    head: "Volume + community",
    body: "Volume is really important, as long as it\u2019s volume on scholarships that actually fit you. Once you\u2019ve filtered down to those, apply to as many as you can. On top of that, with a lot of scholarships there will be some form of alumni or student community through which you can form connections and meet tons of people. So if not for the money, apply for the community and the opportunities it could open in the future.",
  },
  {
    head: "Miscellaneous",
    body: "Check your parents\u2019 company in case they offer anything. Ask your guidance counselor, as they have probably compiled a list of scholarships that previous students from your school have applied to or won. Use the filters here to build a list based on your eligibility. And most importantly, don\u2019t worry too much about rejections. The end goal is to graduate with as little debt as possible, so don\u2019t get bogged down by these decisions and focus on the big picture.",
  },
];

function WinningScholarships() {
  return (
    <>
      <p>
        One of us wrote these tips on r/scholarships after winning a large scholarship. They are updated here for
        this site, which didn&rsquo;t exist when they were first written.
      </p>
      {TIPS.map((t, i) => (
        <section key={t.head}>
          <h2>
            {i + 1}. {t.head}
          </h2>
          <p>{t.body}</p>
        </section>
      ))}
    </>
  );
}

export type Post = { slug: string; title: string; description: string; published: string; updated: string; Body: () => ReactNode };

export const POSTS: Post[] = [
  {
    slug: "how-to-win-scholarships",
    title: "8 tips for winning scholarships, from a scholarship winner",
    description: "Start early, look at your own school first, take the PSAT seriously, and write essays around the scholarship\u2019s mission.",
    published: "2026-11-25",
    updated: "2026-11-25",
    Body: WinningScholarships,
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);
