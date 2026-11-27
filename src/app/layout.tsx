import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { site } from "@/lib/config";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"] });
const body = IBM_Plex_Sans({ variable: "--font-body-face", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono-face", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: the scholarships worth applying to, no account needed`, template: `%s | ${site.name}` },
  description:
    "Scholarships offered by your own college, plus thousands from foundations that are open to any school, in one list with deadlines and direct links. No account needed. Pick your school to see what is there.",
  applicationName: site.name,
  openGraph: { type: "website", siteName: site.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-baseline justify-between px-5 pb-3 pt-5">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" aria-label={site.name} className="font-display text-xl font-extrabold lowercase tracking-tight">
            {/* The logo: "golden" under rough highlighter strokes. */}
            <span className="scratch">golden</span>scholarship
          </a>
          <nav className="flex items-baseline gap-4 font-mono text-xs uppercase tracking-wider text-soft sm:gap-6">
            <Link href="/stats" className="hover:text-ink">
              Stats
            </Link>
            <Link href="/why" className="hover:text-ink">
              Why
            </Link>
            <Link href="/scholarships" className="hover:text-ink">
              Directory
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-5 py-6 font-mono text-xs text-soft">
          © 2026 {site.name}
        {/* Tells search engines and AI assistants what this site is. Kept inside the
            footer: analytics adds its own scripts directly under the body. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: site.name,
              url: site.url,
              description:
                "A free, no-signup directory of the scholarships US colleges give to their own students, plus scholarships open to any school. Every listing links to its official page.",
              publisher: { "@type": "Organization", name: site.name, url: site.url },
            }),
          }}
        />
        </footer>
      </body>
    </html>
  );
}
