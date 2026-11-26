import posthog from "posthog-js";

// PostHog starts only when a project key is set, so local dev works without one.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  try {
    posthog.init(key, {
      // Sent through our own domain (see rewrites in next.config.ts) so ad blockers do not drop events.
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://us.posthog.com",
      // Also counts client-side navigations, such as the move to the status page after signup.
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
  } catch (err) {
    console.error("PostHog failed to start", err);
  }
}
