"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { reportMiss, track } from "@/lib/analytics";
import { LIST_STATE_KEY, type ListState } from "@/lib/profile";

// Fires once when a school page is opened. A school we hold nothing for is
// recorded as something to collect next.
export function SchoolViewed({
  unitid,
  school,
  state,
  scholarships,
  open,
}: {
  unitid: number;
  school: string;
  state: string | null;
  scholarships: number;
  open: number;
}) {
  useEffect(() => {
    track("school_page_viewed", { unitid, school, state, scholarships, open });
    if (scholarships === 0) {
      track("school_no_data", { unitid, school, state });
      reportMiss("school_no_data", school, unitid);
    }
  }, [unitid, school, state, scholarships, open]);
  return null;
}

// A link from the home page into a school, with its source recorded.
export function SchoolLink({
  slug,
  unitid,
  source,
  className,
  children,
}: {
  slug: string;
  unitid: number;
  source: "closing_soon" | "top_schools";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/schools/${slug}`}
      onClick={() => track("home_school_link_clicked", { unitid, source })}
      className={className}
    >
      {children}
    </Link>
  );
}

// The link out to a scholarship's official page, from its own page here.
export function ApplyLink({
  href,
  scholarshipId,
  unitid,
  daysLeft,
  className,
  children,
}: {
  href: string;
  scholarshipId: string;
  unitid: number;
  daysLeft: number | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("scholarship_link_clicked", { scholarship_id: scholarshipId, unitid, position: 0, tab: "detail", days_left: daysLeft })}
      className={className}
    >
      {children}
    </a>
  );
}

// The way back from a scholarship's page. If the student came from a list, it
// returns to that exact list (same filters, same place on the page). Otherwise
// it goes to the list the scholarship belongs to.
export function BackLink({ id, fallback, label }: { id: string; fallback: string; label: string }) {
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const s = JSON.parse(sessionStorage.getItem(LIST_STATE_KEY) ?? "null") as ListState | null;
        if (s && s.id === id) setFrom(s.path);
      } catch {
        // No session storage: the plain link stands.
      }
    }, 0);
    return () => clearTimeout(t);
  }, [id]);
  return (
    <Link
      href={from ?? fallback}
      className="press inline-flex items-center gap-2 rounded-full border border-hair bg-sheet px-4 py-2 text-sm font-semibold hover:border-ink"
    >
      <span aria-hidden="true">←</span> {from ? "Back to your list" : label}
    </Link>
  );
}
