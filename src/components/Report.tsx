"use client";

import { useId, useState } from "react";
import { analyticsId, track } from "@/lib/analytics";
import { REPORT_KINDS } from "@/lib/profile";

// The form for flagging one listing: pick what is wrong from a list, add a
// line if you like, send. Nothing is asked about the person reporting.
export function ReportBox({
  id,
  name,
  unitid,
  onClose,
  onSent,
}: {
  id: string;
  name: string;
  // The school's id, or 0 for the any-school list.
  unitid: number;
  onClose: () => void;
  onSent?: () => void;
}) {
  // The same listing can show this form twice on one page, so its fields get their own ids.
  const uid = useId();
  const [kind, setKind] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error" | "off">("idle");
  const picked = REPORT_KINDS.find((k) => k.v === kind);
  // "Something else" says nothing on its own, so it needs a few words.
  const ready = Boolean(kind) && (kind !== "other" || note.trim().length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setState("busy");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          unitid,
          kind,
          note,
          website,
          page: window.location.pathname + window.location.search,
          analytics_id: analyticsId(),
        }),
      });
      if (res.ok) {
        setState("done");
        track("scholarship_reported", { scholarship_id: id, unitid, kind });
        onSent?.();
      } else {
        // 503 means reports are not switched on yet; never pretend it saved.
        setState(res.status === 503 ? "off" : "error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="mt-3 basis-full rounded-2xl bg-blue-soft px-4 py-3 text-sm font-medium">
        Thanks. We&rsquo;ll take a look.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 basis-full rounded-2xl bg-paper p-3 sm:p-4">
      <label htmlFor={`kind-${uid}`} className="text-sm font-semibold">
        What&rsquo;s wrong with this one?
      </label>
      <select
        id={`kind-${uid}`}
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        required
        className="mt-2 block w-full rounded-xl border border-hair bg-sheet px-3 py-2.5 text-sm font-medium outline-none focus:border-blue"
      >
        <option value="" disabled>
          Choose one
        </option>
        {REPORT_KINDS.map((k) => (
          <option key={k.v} value={k.v}>
            {k.label}
          </option>
        ))}
      </select>
      <label htmlFor={`note-${uid}`} className="sr-only">
        {picked?.ask ?? "Anything to add"}
      </label>
      <textarea
        id={`note-${uid}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder={picked?.ask ?? "Anything to add? (optional)"}
        className="mt-3 w-full rounded-xl border border-hair bg-sheet px-3 py-2 text-sm outline-none placeholder:text-soft/60 focus:border-blue"
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
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!ready || state === "busy"}
          className="press rounded-full bg-blue px-5 py-2 font-display text-sm font-bold text-white hover:bg-ink disabled:opacity-50"
        >
          {state === "busy" ? "…" : "Send report"}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-soft underline underline-offset-4">
          Cancel
        </button>
        {state === "error" && <span className="text-sm font-medium text-due">That didn&rsquo;t send. Try again.</span>}
        {state === "off" && <span className="text-sm font-medium text-due">Not switched on yet. Nothing was saved.</span>}
      </div>
    </form>
  );
}

// On a scholarship's own page: a flag button that opens the form under it.
export function ReportButton({ id, name, unitid }: { id: string; name: string; unitid: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`press inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium ${
          open ? "border-due text-due" : "border-hair bg-sheet text-soft hover:border-ink hover:text-ink"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M6 21V4m0 1h11l-2.2 4L17 13H6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Report a problem
      </button>
      {open && <ReportBox id={id} name={name} unitid={unitid} onClose={() => setOpen(false)} />}
    </>
  );
}
