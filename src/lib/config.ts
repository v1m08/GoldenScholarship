// One place for the things most likely to change.
export const site = {
  name: "GoldenScholarship",
  tagline: "The scholarships worth applying to.",
  // Used for the sitemap, canonical links and share cards. Set NEXT_PUBLIC_SITE_URL
  // to the real domain. Until then, on Vercel, fall back to the project's own
  // production address so nothing points at localhost.
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  // The public GitHub repository. The footer links to it once this is set.
  repo: process.env.NEXT_PUBLIC_REPO_URL ?? "",
};

// A school page is only offered to search engines once it holds this many scholarships.
export const MIN_SCHOLARSHIPS_TO_INDEX = 5;
// Rows per page in a school's list.
export const PAGE_SIZE = 50;
