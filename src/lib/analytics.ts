"use client";
import posthog from "posthog-js";

// Every product event, in one place, so names and properties stay consistent.
export type AnalyticsEvents = {
  // School search on the home page.
  school_search: { query: string; results: number };
  school_search_no_results: { query: string };
  school_selected: { unitid: number; school: string; state: string | null; query: string; scholarships: number };
  // A school page was opened. `scholarships: 0` means we hold nothing for it.
  school_page_viewed: { unitid: number; school: string; state: string | null; scholarships: number; open: number };
  school_no_data: { unitid: number; school: string; state: string | null };
  // Inside a list. `filters` is the query string of what is applied.
  // `unitid` is the school, or 0 for the list open to students at any school.
  list_filtered: { unitid: number; results: number; filters: string };
  list_more: { unitid: number; loaded: number };
  // Moved between a school's list and the any-school list (unitid 0).
  list_switched: { from: number };
  scholarship_link_clicked: { scholarship_id: string; unitid: number; position: number; tab: string; days_left: number | null };
  scholarship_saved: { scholarship_id: string; unitid: number; saved: boolean };
  // A problem flagged on a listing. The note itself is not sent here.
  scholarship_reported: { scholarship_id: string; unitid: number; kind: string };
  // The question flow.
  finder_answered: { step: number; question: string; value: string };
  finder_completed: { unitid: number; g: string; f: string; gpa: string; n: string; st: string };
  finder_skipped: { unitid: number; at_step: number };
  finder_started_from_school: { unitid: number };
  email_subscribed: { unitid: number };
  email_subscribe_failed: { unitid: number; status: number };
  // Entry points other than search.
  home_school_link_clicked: { unitid: number; source: "closing_soon" | "top_schools" };
};

export function track<E extends keyof AnalyticsEvents>(event: E, props: AnalyticsEvents[E]) {
  if (!posthog.__loaded) return;
  posthog.capture(event, props);
}

// PostHog's id for this browser. Stored with an email signup so the address
// can be tied back to what the person did, without sending the email to PostHog.
export function analyticsId(): string | null {
  return posthog.__loaded ? posthog.get_distinct_id() : null;
}

type MissKind = "no_school_match" | "school_no_data" | "no_scholarship_match";

// Also keeps a durable copy of unmet demand in our own database.
export function reportMiss(kind: MissKind, query: string | null, unitid: number | null) {
  const body = JSON.stringify({ kind, query, unitid });
  try {
    if (navigator.sendBeacon?.("/api/miss", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/miss", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(
    () => {},
  );
}
