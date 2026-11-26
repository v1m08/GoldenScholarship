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
    "Scholarships offered by your own college, pulled out of department pages and portals into one list with deadlines and direct links. Pick your school to see what is there.",
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
            {site.repo && (
              <a
                href={site.repo}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="self-center hover:text-ink"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.1c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                </svg>
              </a>
            )}
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
              publisher: { "@type": "Organization", name: site.name, url: site.url, ...(site.repo ? { sameAs: [site.repo] } : {}) },
            }),
          }}
        />
        </footer>
      </body>
    </html>
  );
}
