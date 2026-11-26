import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/lib/config";
import { POSTS, getPost } from "@/lib/posts";

type Props = PageProps<"/blog/[slug]">;

// The address decides the whole page, so there is nothing to show early.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return { title: "Not found", robots: { index: false } };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.published, modifiedTime: post.updated },
  };
}

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function BlogPost({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated,
    mainEntityOfPage: `${site.url}/blog/${post.slug}`,
    publisher: { "@type": "Organization", name: site.name, url: site.url },
  };
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-10 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="font-mono text-xs uppercase tracking-wider text-soft">
        <Link href="/why#blog" className="underline underline-offset-4">
          Why · Blog
        </Link>
      </p>
      <h1 className="mt-4 font-display text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[1] tracking-[-0.03em]">
        {post.title}
      </h1>
      <div className="prose mt-8 text-soft">
        <post.Body />
      </div>
      <Link
        href="/"
        className="press mt-10 inline-flex rounded-full bg-blue px-6 py-3 font-display text-lg font-bold text-white hover:bg-ink"
      >
        Find my school
      </Link>
    </article>
  );
}
