"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { track } from "@/lib/analytics";

type School = { unitid: number; name: string; city: string | null; state: string | null; slug: string; total: number };

/**
 * A button on the filter line that turns into a school search. Picking a
 * school goes to its list, carrying the current filters along.
 */
export function SchoolJump({ label, query }: { label: string; query: string }) {
  const listId = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [results, setResults] = useState<School[]>([]);
  const [active, setActive] = useState(0);

  const term = text.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/schools?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { schools: School[] };
        setResults(data.schools);
        setActive(0);
      } catch {
        // Aborted or offline: keep what is on screen.
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [term]);

  const shown = term.length >= 2 ? results : [];

  function choose(s: School) {
    track("school_selected", { unitid: s.unitid, school: s.name, state: s.state, query: term, scholarships: s.total });
    setOpen(false);
    router.push(`/schools/${s.slug}${query ? `?${query}` : ""}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setOpen(false);
    if (shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-blue"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {label}
      </button>
    );
  }

  return (
    <span className="relative inline-flex">
      <input
        autoFocus
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Type your school"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="w-64 max-w-[80vw] rounded-full border-2 border-ink bg-sheet px-4 py-1.5 text-sm font-medium outline-none focus:border-blue"
      />
      {shown.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-40 mt-2 max-h-80 w-80 max-w-[90vw] overflow-auto overscroll-contain rounded-2xl border border-hair bg-sheet shadow-[0_18px_50px_-12px_rgba(13,19,38,0.25)]"
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
              className={`flex cursor-pointer items-baseline justify-between gap-3 border-b border-hair px-4 py-2.5 last:border-b-0 ${
                i === active ? "bg-blue text-white" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.name}</span>
                <span className={`block font-mono text-xs ${i === active ? "text-white/75" : "text-soft"}`}>
                  {[s.city, s.state].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className={`nums shrink-0 font-mono text-xs ${i === active ? "text-white/85" : "text-soft"}`}>
                {s.total > 0 ? s.total.toLocaleString() : "not yet"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
