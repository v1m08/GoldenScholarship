// What day it is. A deadline names a day and no hour or timezone, so:
//
//   on the server, "today" is the date in US Pacific time. A deadline then
//   stays open until its day has ended everywhere in the continental US, and
//   never closes hours early because the server's clock runs on UTC.
//
//   in the browser, "today" is the visitor's own date, so "today" and "3d"
//   mean what they would on the visitor's calendar.

// The date in US Pacific time, as YYYY-MM-DD. Must match `today` in scripts/build-data.mjs.
export const pacificToday = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

// The date on the visitor's own clock, as YYYY-MM-DD.
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Whole calendar days from one date to another; negative when `to` is in the past.
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
