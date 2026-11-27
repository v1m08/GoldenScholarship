"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, Fragment } from "react";
import { BuddyStage, type Cue } from "@/components/Buddy";
import { ReportBox } from "@/components/Report";
import { SchoolJump } from "@/components/SchoolJump";
import { analyticsId, track } from "@/lib/analytics";
import { PAGE_SIZE } from "@/lib/config";
import { daysBetween, localToday, pacificToday } from "@/lib/day";
import { useMediaQuery, useSaved } from "@/lib/hooks";
import {
  ABOUT,
  ABOUT_STORAGE_KEY,
  DUES,
  FIELDS,
  FRESH_FLAG_KEY,
  GPAS,
  GRADES,
  NO_FILTERS,
  LIST_STATE_KEY,
  SAVED_STORAGE_KEY,
  type ListState,
  SORTS,
  STATES,
  activeCount,
  defaultSort,
  filtersQuery,
  parseFilters,
  type Filters,
  type Sort,
  type Status,
} from "@/lib/profile";
import {
  decodeRows,
  filterRows,
  scholarshipPath,
  type Result,
  type Row,
  type Shown,
} from "@/lib/rows";

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  undated: "No date listed",
  closed: "Closed",
};
const STATUS_ORDER: Status[] = ["open", "undated", "closed"];
const LOADING_LINES = [
  "Reading every listing…",
  "Checking who can apply…",
  "Sorting by deadline…",
];
const MIN_LOADING_MS = 2200;

// Nothing changes the date while a page is open, so there is nothing to listen for.
const never = () => () => {};
function shortDate(iso: string, withYear = false): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
function money(s: Shown): string | null {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const per = s.perYear ? "/yr" : "";
  if (s.awardMin && s.awardMax && s.awardMin !== s.awardMax)
    return `${fmt(s.awardMin)}–${fmt(s.awardMax)}${per}`;
  const one = s.awardMax || s.awardMin;
  return one ? `${fmt(one)}${per}` : null;
}

// A dropdown styled as a pill. Filled blue when it is narrowing the list.
function Pick({
  label,
  value,
  options,
  onChange,
  plain = false,
}: {
  label: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
  // For controls that order the list instead of narrowing it.
  plain?: boolean;
}) {
  const lit = Boolean(value) && !plain;
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`press cursor-pointer appearance-none rounded-full border py-2 pl-4 pr-8 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-blue/25 ${
          lit
            ? "border-blue bg-blue text-white"
            : "border-hair bg-sheet hover:border-ink"
        }`}
      >
        {!plain && <option value="">{label}</option>}
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${lit ? "text-white" : ""}`}
        aria-hidden="true"
      >
        <path
          d="M5 7.5 10 12.5 15 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`press rounded-full border px-4 py-2 text-sm font-medium ${
        on
          ? "border-blue bg-blue text-white"
          : "border-hair bg-sheet hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

// "About you": an optional checklist in a small panel. Choices stay out of the
// address and out of analytics ("ph-no-capture" covers session recordings);
// they are saved only alongside an email the student chooses to leave.
function About({
  value,
  only,
  onChange,
}: {
  value: string;
  only: boolean;
  onChange: (me: string, only: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const picked = value ? value.split(",") : [];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const flip = (v: string) => {
    const next = ABOUT.filter((a) =>
      a.v === v ? !picked.includes(v) : picked.includes(a.v),
    ).map((a) => a.v);
    onChange(next.join(","), next.length > 0 && only);
  };
  const lit = picked.length > 0;

  return (
    <div ref={box} className="ph-no-capture relative z-20 inline-flex">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`press inline-flex items-center gap-2 rounded-full border py-2 pl-4 pr-3 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-blue/25 ${
          lit
            ? "border-blue bg-blue text-white"
            : "border-hair bg-sheet hover:border-ink"
        }`}
      >
        About you{lit ? ` (${picked.length})` : ""}
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 max-w-[86vw] rounded-2xl border border-hair bg-sheet p-3 shadow-[0_12px_32px_-12px_rgba(13,19,38,0.35)]">
          <div className="flex flex-wrap gap-1.5">
            {ABOUT.map((a) => {
              const on = picked.includes(a.v);
              return (
                <button
                  key={a.v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => flip(a.v)}
                  className={`press rounded-full border px-3 py-1.5 text-sm font-medium ${
                    on
                      ? "border-blue bg-blue text-white"
                      : "border-hair hover:border-ink"
                  }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
          {lit && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-hair px-1 pt-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={only}
                onChange={(e) => onChange(value, e.target.checked)}
                className="h-4 w-4 accent-blue"
              />
              Only show ones made for me
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// The clock, read only from event handlers.
const nowMs = () => Date.now();

/**
 * A list of scholarships with filters on top.
 *
 * The page arrives with the first screen already rendered. This then loads
 * the list's full data file once and does all filtering, sorting and paging
 * in the browser, so every change is instant and nothing waits on a server.
 */
export function Explorer({
  unitid,
  school,
  sources,
  initial,
  initialStatus = "open",
  other,
  extra,
  fourYear,
  base: listBase,
}: {
  // The school's id, or 0 for the list that is open to students at any school.
  unitid: number;
  school: string;
  // Data files to load, first screen's file first.
  sources: string[];
  // The first screen, worked out on the server.
  initial: Result;
  // The tab the server chose because it is the first with anything in it.
  initialStatus?: Status;
  // The neighbouring list to offer: the any-school list from a school.
  other?: { href: string; label: string };
  // On a school's page: the data files of scholarships open to any school,
  // shown underneath the school's own.
  extra?: string[];
  // On a school's page: whether it is a four-year school.
  fourYear?: boolean;
  // Where this list lives, for links to each scholarship's own page.
  base: string;
}) {
  const params = useSearchParams();
  const small = useMediaQuery("(max-width: 640px)");
  const { ids: savedIds, toggle: toggleSaved } = useSaved(SAVED_STORAGE_KEY);

  const [filters, setFilters] = useState<Filters>(() => {
    const f = parseFilters((k) => params.get(k));
    return params.get("status") ? f : { ...f, status: initialStatus };
  });
  // The visitor's own date, so "today" and "3d" match their calendar. The server
  // cannot know it, so the first paint uses US Pacific time and corrects itself.
  const today = useSyncExternalStore(never, localToday, pacificToday);
  // Everything loaded so far, and whether every file has arrived.
  const [rows, setRows] = useState<Row[] | null>(null);
  const [complete, setComplete] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Straight from the questions: play the loading screen once.
  const [loading, setLoading] = useState(() => {
    try {
      if (sessionStorage.getItem(FRESH_FLAG_KEY)) {
        sessionStorage.removeItem(FRESH_FLAG_KEY);
        return true;
      }
    } catch {
      // No session storage: skip the loading screen.
    }
    return false;
  });
  const [lineAt, setLineAt] = useState(0);
  const [cue, setCue] = useState<Cue>({
    id: 0,
    mood: "wave",
    say: "Filter away.",
  });
  const cueId = useRef(0);
  const mounted = useRef(0);
  const firstRun = useRef(true);
  const sentinel = useRef<HTMLDivElement>(null);
  // The one listing whose report form is open.
  const [reporting, setReporting] = useState<string | null>(null);

  // "About you" lives in this browser only, never in the address, so it is
  // picked up after the page has matched what the server sent.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const stored = localStorage.getItem(ABOUT_STORAGE_KEY);
        const known = (stored ?? "").split(",");
        const me = ABOUT.filter((a) => known.includes(a.v)).map((a) => a.v).join(",");
        // Having answered at all, even with nothing picked, lets group-only scholarships be ruled out.
        if (stored !== null)
          setFilters((f) => ({ ...f, me, asked: true, sort: f.sort === defaultSort(f) ? defaultSort({ ...f, me }) : f.sort }));
      } catch {
        // No storage: start with nothing picked.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Coming back from a scholarship's page: pick up the list where it was left.
  const resumeAt = useRef<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const s = JSON.parse(sessionStorage.getItem(LIST_STATE_KEY) ?? "null") as ListState | null;
        if (!s || s.path !== window.location.pathname + window.location.search || Date.now() - s.t > 30 * 60_000) return;
        // Used once, so a later fresh visit starts at the top.
        sessionStorage.removeItem(LIST_STATE_KEY);
        resumeAt.current = s.y;
        setVisible(Math.max(PAGE_SIZE, s.visible));
        if (s.loose || s.only) setFilters((f) => ({ ...f, loose: s.loose, only: s.only }));
      } catch {
        // No session storage: the list simply starts at the top.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // The scroll waits for the full list, since the first screen is only 50 rows long.
  useEffect(() => {
    if (!rows || resumeAt.current === null) return;
    const y = resumeAt.current;
    // The list grows as it renders; keep trying until the page is tall enough to reach the spot.
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) < 8 || tries >= 25) {
        resumeAt.current = null;
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
  }, [rows, visible, complete]);

  function remember(id: string) {
    try {
      const state: ListState = {
        id,
        path: window.location.pathname + window.location.search,
        visible,
        y: window.scrollY,
        loose: filters.loose,
        only: filters.only,
        t: nowMs(),
      };
      sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(state));
    } catch {
      // Without it the back button returns to the top of the list.
    }
  }

  // Load the data files one after another, showing each as soon as it lands.
  const sourceKey = sources.join(",");
  const extraKey = (extra ?? []).join(",");
  useEffect(() => {
    let live = true;
    mounted.current = Date.now();
    (async () => {
      const all: Row[] = [];
      for (const url of sourceKey.split(",")) {
        try {
          const res = await fetch(url);
          if (res.ok) all.push(...decodeRows(await res.json()));
        } catch {
          // A missing file just means fewer rows; the first screen is already on the page.
        }
        if (!live) return;
        setRows([...all]);
      }
      for (const url of extraKey ? extraKey.split(",") : []) {
        try {
          const res = await fetch(url);
          if (res.ok) all.push(...decodeRows(await res.json()).map((r) => ({ ...r, any: true })));
        } catch {
          // The school's own list still stands.
        }
        if (!live) return;
        setRows([...all]);
      }
      if (live) setComplete(true);
    })();
    return () => {
      live = false;
    };
  }, [sourceKey, extraKey]);

  // Filters without the tab, then the tab only when it differs from the
  // server's default, so a plain visit keeps a clean address.
  const base = filtersQuery({ ...filters, status: "open" });
  const query = [
    base,
    filters.status === initialStatus ? "" : `status=${filters.status}`,
  ]
    .filter(Boolean)
    .join("&");
  const isDefault = query === "";

  // Typing in the search box stays smooth while a big list refilters.
  const deferred = useDeferredValue(filters);
  const data: Result = useMemo(() => {
    // Until the data file lands, the server's first screen stands in.
    if (!rows) return initial;
    return filterRows(rows, deferred, savedIds, today, visible, {
      school: unitid !== 0 ? school : undefined,
      fourYear,
      merge: unitid !== 0,
    });
  }, [rows, deferred, savedIds, today, visible, initial, unitid, school, fourYear]);
  // Filters are applied but the data to apply them to is still on its way.
  const waiting = !rows && (!isDefault || filters.me !== "");

  // Keep the address in step so a filtered view can be shared, and start each new view at the top of its list.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
    const t = setTimeout(() => setVisible(PAGE_SIZE), 0);
    return () => clearTimeout(t);
  }, [query]);

  // The buddy reports the result once things settle, and the change is recorded.
  const total = data.total;
  useEffect(() => {
    if (!rows || (isDefault && !filters.me && cueId.current === 0)) return;
    const t = setTimeout(() => {
      track("list_filtered", {
        unitid,
        results: total,
        filters: query || "none",
      });
      cueId.current += 1;
      setCue(
        total === 0
          ? {
              id: cueId.current,
              mood: "confused",
              say: "Nothing. Loosen a filter?",
            }
          : {
              id: cueId.current,
              mood: "happy",
              say: `${total.toLocaleString()} for you!`,
            },
      );
    }, 350);
    return () => clearTimeout(t);
    // Reports once per settled view, not on every keystroke's intermediate total.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.me, filters.only, total, Boolean(rows)]);

  // The loading screen stays long enough to read, and never longer than the data takes plus that.
  useEffect(() => {
    if (!loading) return;
    const tick = setInterval(
      () => setLineAt((i) => (i + 1) % LOADING_LINES.length),
      750,
    );
    const done = rows
      ? setTimeout(
          () => setLoading(false),
          Math.max(0, MIN_LOADING_MS - (Date.now() - mounted.current)),
        )
      : undefined;
    const giveUp = setTimeout(() => setLoading(false), 8000);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
      clearTimeout(giveUp);
    };
  }, [loading, rows]);

  // More rows appear as the reader nears the end of the list.
  const hasMore = Boolean(rows) && data.rows.length < data.total;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setVisible((v) => v + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, data.rows.length]);

  const set = (patch: Partial<Filters>) => {
    if ("me" in patch) {
      try {
        localStorage.setItem(ABOUT_STORAGE_KEY, patch.me ?? "");
      } catch {
        // Not saved for next time; it still applies now.
      }
    }
    setFilters((f) => {
      const next = { ...f, ...patch, ...("me" in patch ? { asked: true } : {}) };
      // Moving between the automatic orders follows the filters, unless a sort was picked by hand.
      if (!("sort" in patch) && f.sort === defaultSort(f))
        next.sort = defaultSort(next);
      return next;
    });
  };

  function more() {
    setVisible((v) => v + PAGE_SIZE);
    track("list_more", { unitid, loaded: data.rows.length + PAGE_SIZE });
  }

  function star(id: string) {
    const nowSaved = toggleSaved(id);
    track("scholarship_saved", { scholarship_id: id, unitid, saved: nowSaved });
    cueId.current += 1;
    setCue({
      id: cueId.current,
      mood: nowSaved ? "happy" : "idle",
      say: nowSaved ? "Saved for later." : "Removed.",
    });
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper px-5"
        role="status"
      >
        <p className="text-center font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Digging through {school}
        </p>
        <p key={lineAt} className="step-in mt-4 font-mono text-sm text-soft">
          {LOADING_LINES[lineAt]}
        </p>
        <div className="mt-8 h-2 w-full max-w-md overflow-hidden rounded-full bg-hair">
          <div className="bar-fill h-full w-full rounded-full bg-blue" />
        </div>
        <BuddyStage
          cue={{ id: 1, mood: "run" }}
          size={small ? 120 : 160}
          className="mt-4"
        />
      </div>
    );
  }

  const active = activeCount(filters);

  return (
    <section className="pb-16">
      <div className="grid items-end gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="flex items-end gap-4 lg:col-span-7">
          <BuddyStage cue={cue} size={small ? 84 : 104} className="shrink-0" />
          <div className="min-w-0 pb-3">
            <h2 className="font-display text-[clamp(2rem,6vw,3.75rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
              <span className="nums text-blue">
                {data.total.toLocaleString()}
              </span>{" "}
              {filters.only
                ? "made for you"
                : filters.g ||
                    filters.gpa ||
                    filters.n ||
                    filters.f ||
                    filters.me
                  ? "match your answers"
                  : active > 0
                    ? "match"
                    : filters.status === "open"
                      ? "open now"
                      : STATUS_LABEL[filters.status].toLowerCase()}
            </h2>
            {active === 0 && unitid !== 0 && (
              <Link
                href={`/?s=${unitid}`}
                onClick={() => track("finder_started_from_school", { unitid })}
                className="mt-2 inline-block text-[15px] font-medium text-blue underline underline-offset-4"
              >
                Which fit me? 5 quick questions
              </Link>
            )}
          </div>
        </div>
        <div className="pb-3 lg:col-span-5">
          <EmailBox
            unitid={unitid}
            context={() => {
              // Everything they told us, in codes and in words, so an email can open with it.
              const label = (options: { v: string; label: string }[], v: string) => options.find((o) => o.v === v)?.label ?? null;
              const picked = filters.me ? filters.me.split(",") : [];
              const about = ABOUT.filter((a) => picked.includes(a.v));
              const starred = (rows ?? []).filter((r) => savedIds.includes(r.id)).slice(0, 20);
              const labels = {
                year: label(GRADES, filters.g),
                field: label(FIELDS, filters.f),
                gpa: label(GPAS, filters.gpa),
                need: filters.n === "y" ? "Has financial need" : filters.n === "n" ? "No financial need" : null,
                deadline: label(DUES, filters.due),
                about: about.map((a) => a.label),
                search: filters.q.trim() || null,
                only_with_amount: filters.amt,
                only_made_for_me: filters.only,
                tab: STATUS_LABEL[filters.status],
                sort: label(SORTS, filters.sort),
              };
              const summary = [
                labels.year,
                labels.field,
                labels.gpa ? `GPA ${labels.gpa}` : null,
                labels.need,
                filters.st ? (filters.st === "zz" ? "lives outside the US" : `lives in ${filters.st}`) : null,
                ...labels.about,
                labels.deadline,
                labels.search ? `searched "${labels.search}"` : null,
                unitid === 0 ? "browsing scholarships open to any school" : `at ${school}`,
                `${data.total.toLocaleString("en-US")} matches`,
                starred.length ? `saved ${savedIds.length}: ${starred.slice(0, 5).map((r) => r.name).join("; ")}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return {
                list: unitid === 0 ? "any-school" : school,
                summary,
                labels,
                filters,
                about: about.map((a) => a.v),
                results: data.total,
                top_results: data.rows.slice(0, 5).map((r) => ({ id: r.id, name: r.name, deadline: r.deadline || null })),
                saved: savedIds.slice(0, 100),
                saved_scholarships: starred.map((r) => ({ id: r.id, name: r.name, deadline: r.deadline || null })),
                page: window.location.pathname + window.location.search,
                referrer: document.referrer || null,
                analytics_id: analyticsId(),
              };
            }}
            onSaved={() => {
              cueId.current += 1;
              setCue({
                id: cueId.current,
                mood: "happy",
                say: "You're on the list!",
              });
            }}
          />
        </div>
      </div>

      {other && (
        <p className="mt-5">
          <Link
            href={`${other.href}${base ? `?${filtersQuery({ ...filters, status: "open", saved: false })}` : ""}`}
            onClick={() => track("list_switched", { from: unitid })}
            className="press inline-flex items-center gap-2 rounded-full bg-blue-soft px-4 py-2 text-sm font-semibold text-blue hover:bg-blue hover:text-white"
          >
            {other.label} <span aria-hidden="true">→</span>
          </Link>
        </p>
      )}

      {/* Filters. Every control narrows the same list below. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SchoolJump
          label={unitid === 0 ? "Find my school" : "Change school"}
          query={filtersQuery({ ...filters, status: "open", saved: false })}
        />
        <Pick
          label="Any year"
          value={filters.g}
          options={GRADES}
          onChange={(g) => set({ g })}
        />
        <Pick
          label="Any field"
          value={filters.f}
          options={FIELDS.filter((f) => f.v !== "other")}
          onChange={(f) => set({ f })}
        />
        <Pick
          label="Any GPA"
          value={filters.gpa}
          options={GPAS.filter((g) => g.v !== "x")}
          onChange={(gpa) => set({ gpa })}
        />
        <Pick
          label="Need: any"
          value={filters.n}
          options={[
            { v: "y", label: "I have financial need" },
            { v: "n", label: "No financial need" },
          ]}
          onChange={(n) => set({ n })}
        />
        <Pick
          label="Any state"
          value={filters.st}
          options={[...STATES.map(([v, label]) => ({ v, label })), { v: "zz", label: "Outside the US" }]}
          onChange={(st) => set({ st })}
        />
        <About
          value={filters.me}
          only={filters.only}
          onChange={(me, only) => set({ me, only })}
        />
        <Pick
          label="Any deadline"
          value={filters.due}
          options={DUES}
          onChange={(due) =>
            set({ due, status: due ? "open" : filters.status })
          }
        />
        <Toggle on={filters.amt} onClick={() => set({ amt: !filters.amt })}>
          States an amount
        </Toggle>
        <Toggle on={filters.strict} onClick={() => set({ strict: !filters.strict })}>
          No extra requirements
        </Toggle>
        <Toggle
          on={filters.saved}
          onClick={() => set({ saved: !filters.saved })}
        >
          Saved{savedIds.length > 0 ? ` (${savedIds.length})` : ""}
        </Toggle>
        {active > 0 && (
          <button
            type="button"
            onClick={() => {
              set({ me: "" });
              setFilters({ ...NO_FILTERS, status: filters.status });
            }}
            className="ml-1 font-mono text-xs uppercase tracking-wider text-soft underline underline-offset-4"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-hair pb-3">
        <div role="tablist" className="flex gap-1">
          {STATUS_ORDER.filter(
            (s) => data.counts[s] > 0 || s === filters.status,
          ).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={s === filters.status}
              onClick={() => set({ status: s })}
              className={`press rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-wider ${
                s === filters.status
                  ? "bg-ink text-white"
                  : "text-soft hover:text-ink"
              }`}
            >
              {STATUS_LABEL[s]}{" "}
              <span className="nums">{data.counts[s].toLocaleString()}</span>
            </button>
          ))}
        </div>
        {/* A fixed starting width, so on a narrow row this wraps below the tabs instead of being squashed. */}
        <div className="flex flex-1 basis-72 items-center justify-end gap-3">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={
              unitid === 0 ? "Search a name, town or state" : "Search names"
            }
            aria-label="Search scholarship names"
            className="w-full min-w-36 max-w-56 rounded-full border border-hair bg-sheet px-4 py-2 text-sm outline-none placeholder:text-soft/60 focus:border-blue"
          />
          <Pick
            plain
            label="Sort"
            value={filters.sort}
            options={SORTS}
            onChange={(sort) => set({ sort: sort as Sort })}
          />
        </div>
      </div>

      {rows && ((data.hidden ?? 0) > 0 || filters.loose) && (
        <p className="mt-4 text-sm text-soft">
          {filters.loose
            ? "Also showing the ones that require something you don\u2019t have, at the end."
            : `${(data.hidden ?? 0).toLocaleString()} hidden because they require something you don\u2019t have.`}{" "}
          <button
            type="button"
            onClick={() => set({ loose: !filters.loose })}
            className="font-medium text-blue underline underline-offset-4"
          >
            {filters.loose ? "Hide them" : "Show them"}
          </button>
        </p>
      )}

      <ul
        className={`mt-4 overflow-hidden rounded-3xl border border-hair bg-sheet ${waiting ? "opacity-60" : ""}`}
      >
        {data.rows.map((s, i) => {
          const days = s.deadline ? daysBetween(today, s.deadline) : null;
          const isOpen = days !== null && days >= 0;
          const amount = money(s);
          const isSaved = savedIds.includes(s.id);
          // Where the school's own scholarships end and the any-school ones begin.
          const divides = Boolean(s.any) && !data.rows[i - 1]?.any;
          return (
            <Fragment key={s.id}>
            {divides && (
              <li className="border-b border-hair bg-paper px-4 py-3 sm:px-5">
                <h3 className="font-display text-lg font-bold tracking-tight">
                  {i === 0 ? "Open to students at any school" : "More you can apply for, open to any school"}
                </h3>
                {i === 0 && unitid !== 0 && (
                  <p className="text-sm text-soft">Nothing at {school} fits these filters, but these are worth a look.</p>
                )}
              </li>
            )}
            <li
              className="row-hover flex flex-wrap gap-x-4 border-b border-hair px-4 py-4 last:border-b-0 sm:px-5"
            >
              <div className="nums w-14 shrink-0 font-mono text-sm sm:w-16">
                {s.deadline ? (
                  <>
                    <span
                      className={`block font-medium ${isOpen && days <= 14 ? "text-due" : ""}`}
                    >
                      {isOpen ? (days === 0 ? "today" : `${days}d`) : "closed"}
                    </span>
                    <span className="block text-xs text-soft">
                      {shortDate(s.deadline, !isOpen)}
                    </span>
                  </>
                ) : (
                  <span className="block text-xs text-soft">no date</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {/* The name opens this scholarship's own page; "Apply" goes straight to the official one. */}
                <Link
                  href={scholarshipPath(s.any ? "/scholarships" : listBase, s)}
                  onClick={() => remember(s.id)}
                  className="text-[17px] font-semibold leading-snug underline decoration-hair decoration-2 underline-offset-4 hover:decoration-blue"
                >
                  {s.name}
                </Link>
                {s.provider && (
                  <p className="mt-0.5 text-sm text-soft">{s.provider}</p>
                )}
                {(amount || s.reasons.length > 0 || s.renewable || s.essay || s.url || (extra && !s.any)) && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          track("scholarship_link_clicked", {
                            scholarship_id: s.id,
                            unitid,
                            position: i + 1,
                            tab: filters.status,
                            days_left: days,
                          })
                        }
                        className="press rounded-full bg-ink px-3 py-0.5 text-xs font-semibold text-white hover:bg-blue"
                      >
                        Apply <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {extra && !s.any && (
                      <span className="rounded-full bg-[#ffe08a] px-2.5 py-0.5 text-xs font-semibold text-ink">
                        Only at {school}
                      </span>
                    )}
                    {amount && (
                      <span className="nums font-mono text-sm font-medium">
                        {amount}
                      </span>
                    )}
                    {s.reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-medium text-blue"
                      >
                        {r}
                      </span>
                    ))}
                    {s.renewable && (
                      <span className="font-mono text-xs text-soft">
                        renewable
                      </span>
                    )}
                    {s.essay && (
                      <span className="font-mono text-xs text-soft">essay</span>
                    )}
                  </p>
                )}
                {s.needs.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                    {s.needs.map((n) => (
                      <span key={n} className="rounded-full bg-[#fff1cf] px-2.5 py-0.5 text-xs font-medium text-[#6b4a00]">
                        {n === "does not fit your answers" ? n : n.startsWith("~") ? `M${n.slice(2)}` : `Requires: ${n}`}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="-mr-1 flex shrink-0 flex-col items-center self-start">
                <button
                  type="button"
                  onClick={() => star(s.id)}
                  aria-pressed={isSaved}
                  aria-label={
                    isSaved ? `Remove ${s.name} from saved` : `Save ${s.name}`
                  }
                  className="press h-9 w-9 rounded-full hover:bg-blue-soft"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="mx-auto h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
                      fill={isSaved ? "#ffc93c" : "none"}
                      stroke={isSaved ? "#e0a800" : "currentColor"}
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setReporting(reporting === s.id ? null : s.id)}
                  aria-expanded={reporting === s.id}
                  aria-label={`Report a problem with ${s.name}`}
                  title="Report a problem"
                  className={`press h-8 w-9 rounded-full hover:bg-blue-soft ${reporting === s.id ? "text-due" : "text-soft/70 hover:text-ink"}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="mx-auto h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 21V4m0 1h11l-2.2 4L17 13H6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              {reporting === s.id && (
                <ReportBox
                  id={s.id}
                  name={s.name}
                  unitid={s.any ? 0 : unitid}
                  onClose={() => setReporting(null)}
                  onSent={() => {
                    cueId.current += 1;
                    setCue({
                      id: cueId.current,
                      mood: "happy",
                      say: "Thanks, I'll check it.",
                    });
                  }}
                />
              )}
            </li>
            </Fragment>
          );
        })}
        {data.rows.length === 0 && (
          <li className="px-5 py-10 text-center text-soft">
            {filters.saved && savedIds.length === 0
              ? "Nothing saved yet. Tap a star to keep one for later."
              : "Nothing matches. Clear a filter to see more."}
          </li>
        )}
      </ul>

      <div
        ref={sentinel}
        className="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <p className="nums font-mono text-xs text-soft">
          {data.rows.length.toLocaleString()} of {data.total.toLocaleString()}
          {rows && !complete && " · loading the rest…"}
        </p>
        {hasMore && (
          <button
            type="button"
            onClick={more}
            className="press rounded-full border border-ink px-6 py-2.5 font-display font-bold hover:bg-ink hover:text-white"
          >
            Show more
          </button>
        )}
      </div>
    </section>
  );
}

// Optional, and offered only after the student has seen their list. One line:
// the placeholder says what it is for.
function EmailBox({
  unitid,
  context,
  onSaved,
}: {
  unitid: number;
  // Everything known about what this student is looking for, saved with the address.
  context: () => Record<string, unknown>;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<
    "idle" | "busy" | "done" | "error" | "off"
  >("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, unitid, website, context: context() }),
      });
      if (res.ok) {
        setState("done");
        track("email_subscribed", { unitid });
        onSaved();
      } else {
        // 503 means signups are not switched on yet; never pretend it saved.
        setState(res.status === 503 ? "off" : "error");
        track("email_subscribe_failed", { unitid, status: res.status });
      }
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-full bg-blue-soft px-5 py-3 text-center font-medium">
        You&rsquo;re in.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex gap-2 rounded-full bg-blue-soft p-1.5">
        <label htmlFor="email" className="sr-only">
          Your email, for updates that fit you
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email for updates that fit you"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded-full border-2 border-transparent bg-sheet px-4 py-2 outline-none placeholder:text-soft/70 focus:border-blue"
        />
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="press rounded-full bg-blue px-5 py-2 font-display font-bold text-white hover:bg-ink disabled:opacity-60"
        >
          {state === "busy" ? "…" : "Send"}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-2 px-4 text-sm font-medium text-due">
          That didn&rsquo;t save. Check the address and try again.
        </p>
      )}
      {state === "off" && (
        <p className="mt-2 px-4 text-sm font-medium text-due">
          Not switched on yet. Nothing was saved.
        </p>
      )}
    </form>
  );
}
