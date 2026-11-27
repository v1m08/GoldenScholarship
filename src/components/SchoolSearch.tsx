"use client";

import { useEffect, useId, useRef, useState } from "react";
import { reportMiss, track } from "@/lib/analytics";

export type FoundSchool = {
  unitid: number;
  name: string;
  city: string | null;
  state: string | null;
  slug: string;
  total: number;
  open: number;
};

export type SearchStatus = "empty" | "typing" | "found" | "nomatch";

// The only thing a student types: their school.
export function SchoolSearch({
  onChoose,
  onStatus,
}: {
  onChoose: (school: FoundSchool) => void;
  onStatus?: (status: SearchStatus) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundSchool[]>([]);
  const [settled, setSettled] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const lastMiss = useRef("");

  const term = query.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    if (!searching) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/schools?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { schools: FoundSchool[] };
        setResults(data.schools);
        setSettled(term);
        setActive(0);
        setOpen(true);
        if (data.schools.length > 0) track("school_search", { query: term, results: data.schools.length });
      } catch {
        // Aborted or offline: keep whatever is on screen.
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [term, searching]);

  const shown = searching ? results : [];
  const noMatch = open && searching && settled === term && shown.length === 0;

  // A search that finds nothing is a request for a school we should add.
  // Wait until typing stops so half-typed words are not recorded.
  useEffect(() => {
    if (!noMatch || lastMiss.current === term) return;
    const timer = setTimeout(() => {
      lastMiss.current = term;
      track("school_search_no_results", { query: term });
      reportMiss("no_school_match", term, null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [noMatch, term]);

  // Tell the page what the search is doing, so the buddy can react.
  const status: SearchStatus = !searching ? "empty" : noMatch ? "nomatch" : settled === term && shown.length > 0 ? "found" : "typing";
  useEffect(() => {
    onStatus?.(status);
    // Only the status itself should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function choose(s: FoundSchool) {
    setOpen(false);
    track("school_selected", { unitid: s.unitid, school: s.name, state: s.state, query: term, scholarships: s.total });
    onChoose(s);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor="school" className="sr-only">
        Your school
      </label>
      <input
        id="school"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus
        placeholder="type your school"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => shown.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="w-full border-0 border-b-[3px] border-ink bg-transparent px-0 py-3 text-center font-display text-4xl font-bold tracking-tight outline-none placeholder:font-semibold placeholder:text-soft focus:border-blue sm:text-6xl"
      />
      {open && shown.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-2 max-h-80 w-full overflow-auto overscroll-contain rounded-2xl border border-hair bg-sheet text-left shadow-[0_18px_50px_-12px_rgba(13,19,38,0.25)]"
        >
          {shown.map((s, i) => (
            <li
              key={s.unitid}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-4 border-b border-hair px-4 py-3 last:border-b-0 ${
                i === active ? "bg-blue text-white" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block font-medium">{s.name}</span>
                <span className={`block font-mono text-xs ${i === active ? "text-white/75" : "text-soft"}`}>
                  {[s.city, s.state].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className={`nums shrink-0 font-mono text-xs ${i === active ? "text-white/85" : "text-soft"}`}>
                {s.total > 0 ? `${s.total.toLocaleString()} found` : "not yet"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {noMatch && (
        <p className="mt-4 text-center text-[15px] text-soft">
          No school by that name. Try the full name. We&rsquo;ve noted what you searched.
        </p>
      )}
    </div>
  );
}
