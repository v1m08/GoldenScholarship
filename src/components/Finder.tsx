"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BuddyStage, type Cue, type Mood } from "@/components/Buddy";
import { SchoolSearch, type FoundSchool, type SearchStatus } from "@/components/SchoolSearch";
import { track } from "@/lib/analytics";
import { useMediaQuery } from "@/lib/hooks";
import {
  ABOUT,
  ABOUT_STORAGE_KEY,
  FRESH_FLAG_KEY,
  PROFILE_STORAGE_KEY,
  QUESTIONS,
  profileQuery,
  type Profile,
} from "@/lib/profile";

// The four dropdowns, then one optional "about you" step.
const STEPS = QUESTIONS.length + 1;

// The whole home page: type a school, answer four dropdowns, go to your matches.
export function Finder() {
  const router = useRouter();
  const params = useSearchParams();
  const [school, setSchool] = useState<FoundSchool | null>(null);
  const [answers, setAnswers] = useState<Partial<Profile>>({});
  const [step, setStep] = useState(0); // 0 = school, 1..4 = questions, 5 = about you
  const [about, setAbout] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);
  const small = useMediaQuery("(max-width: 640px)");
  // On arrival Penny hops and introduces herself.
  const [cue, setCue] = useState<Cue>({
    id: 0,
    mood: "happy",
    say: "I'm Penny, and I help you find scholarships! First, let's get your school name.",
  });
  // Whether anything has been typed yet, so the empty box does not cut the introduction short.
  const typed = useRef(false);
  const cueId = useRef(0);

  // Coming back to this page (browser Back) restores it exactly as it was left,
  // including the "One second…" state. Clear that whenever the page is shown again.
  useEffect(() => {
    const reset = () => setLeaving(false);
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      // Also runs when the router hides this page after navigating away.
      reset();
    };
  }, []);

  const act = (mood: Mood, say: string, at?: number) => {
    cueId.current += 1;
    setCue((c) => ({ id: cueId.current, mood, say, at: at ?? c.at }));
  };

  // Arriving from a school page ("see which fit you") skips the typing step.
  const preset = params.get("s");
  useEffect(() => {
    if (!preset) return;
    let live = true;
    fetch(`/api/schools?id=${encodeURIComponent(preset)}`)
      .then((r) => r.json())
      .then((d: { schools: FoundSchool[] }) => {
        const s = d.schools?.[0];
        if (!live || !s) return;
        setSchool(s);
        setStep(1);
        cueId.current += 1;
        setCue({ id: cueId.current, mood: "wave", say: `${s.name}. Five quick ones.`, at: 0.14 });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [preset]);

  function onStatus(status: SearchStatus) {
    if (school) return;
    if (status === "empty" && !typed.current) return;
    typed.current = true;
    if (status === "typing") act("think", "Looking…");
    else if (status === "found") act("point", "Is it one of these?");
    else if (status === "nomatch") act("confused", "Hm. I don't know that one.");
    else act("idle", "Type your school.");
  }

  function chooseSchool(s: FoundSchool) {
    setSchool(s);
    if (s.total === 0) {
      // Nothing to match against: go straight to the page that says so and logs the request.
      act("confused", "I don't have that one yet. Noting it.");
      setLeaving(true);
      setTimeout(() => router.push(`/schools/${s.slug}`), 1100);
      return;
    }
    // Start loading this school's listings and page now, while the questions
    // are being answered, so the results are already there at the end.
    void fetch(`/data/s/${s.unitid}.json`).catch(() => {});
    router.prefetch(`/schools/${s.slug}`);
    act(
      "happy",
      s.open > 0 ? `${s.open.toLocaleString()} open there right now!` : `${s.total.toLocaleString()} on file there.`,
    );
    setTimeout(() => setStep(1), 650);
  }

  function answer(key: keyof Profile, value: string) {
    const q = QUESTIONS[step - 1];
    const opt = q.options.find((o) => o.v === value);
    if (!opt || !school) return;
    const next = { ...answers, [key]: value };
    setAnswers(next);
    track("finder_answered", { step, question: key, value });

    // The buddy crosses to the other side for each new question.
    act("happy", opt.say, step % 2 === 1 ? 0.86 : 0.14);
    if (step === QUESTIONS.length) {
      // Start from whatever was picked on an earlier visit.
      try {
        const known = (localStorage.getItem(ABOUT_STORAGE_KEY) ?? "").split(",");
        setAbout(ABOUT.filter((a) => known.includes(a.v)).map((a) => a.v));
      } catch {
        // No storage: start with nothing picked.
      }
    }
    setTimeout(() => setStep(step + 1), 700);
  }

  // The last step. These picks stay in this browser: they are not put in the
  // address and not sent to analytics.
  function finish() {
    if (!school) return;
    const profile = answers as Profile;
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      localStorage.setItem(ABOUT_STORAGE_KEY, about.join(","));
      sessionStorage.setItem(FRESH_FLAG_KEY, "1");
    } catch {
      // Private browsing: the four answers still travel in the URL.
    }
    track("finder_completed", { unitid: school.unitid, ...profile });
    act("happy", "That's all I need!");
    setLeaving(true);
    setTimeout(() => router.push(`/schools/${school.slug}?${profileQuery(profile)}`), 900);
  }

  const flip = (v: string) => setAbout((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  // For students who would rather browse and filter the list themselves.
  function skip() {
    if (!school) return;
    track("finder_skipped", { unitid: school.unitid, at_step: step });
    setLeaving(true);
    router.push(`/schools/${school.slug}`);
  }

  function back() {
    if (step <= 1) {
      setSchool(null);
      setAnswers({});
      setStep(0);
      act("wave", "Type your school.", 0.5);
    } else {
      setStep(step - 1);
      act("idle", "No rush.");
    }
  }

  const q = step >= 1 && step <= QUESTIONS.length ? QUESTIONS[step - 1] : null;

  return (
    <div className="flex min-h-[calc(100dvh-19rem)] flex-col justify-center pt-6">
      <div className="relative z-20 mx-auto w-full max-w-3xl px-5">
        {step === 0 && !school && (
          <h1 className="mb-5 text-center font-display text-xl font-semibold tracking-tight text-soft sm:text-2xl">
            We help you find scholarships.
          </h1>
        )}

        {step === 0 && !school && <SchoolSearch onChoose={chooseSchool} onStatus={onStatus} />}

        {school && (
          <p className="text-center font-mono text-xs uppercase tracking-wider text-soft">
            {school.name}
            {step >= 1 && (
              <span className="ml-3 normal-case tracking-normal">
                {step} of {STEPS}
              </span>
            )}
          </p>
        )}

        {q && !leaving && (
          <div key={step} className="step-in mt-5 text-center">
            <label htmlFor="answer" className="block font-display text-4xl font-bold tracking-tight sm:text-6xl">
              {q.ask}
            </label>
            <div className="relative mx-auto mt-8 max-w-md">
              <select
                id="answer"
                autoFocus
                value={answers[q.key] ?? ""}
                onChange={(e) => answer(q.key, e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-2xl border-2 border-ink bg-sheet px-5 py-4 pr-12 font-display text-2xl font-semibold outline-none focus:border-blue focus:ring-4 focus:ring-blue/20"
              >
                <option value="" disabled>
                  Choose one
                </option>
                {q.options.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2"
                aria-hidden="true"
              >
                <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-6 flex justify-center gap-6 font-mono text-xs uppercase tracking-wider text-soft">
              <button type="button" onClick={back} className="underline underline-offset-4">
                Back
              </button>
              <button type="button" onClick={skip} className="underline underline-offset-4">
                Skip, show me everything
              </button>
            </p>
          </div>
        )}

        {step === STEPS && !leaving && (
          <div className="step-in ph-no-capture mt-5 text-center">
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">Anything else about you?</h2>
            <p className="mt-3 text-soft">Pick any that fit, or none.</p>
            <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
              {ABOUT.map((a) => {
                const on = about.includes(a.v);
                return (
                  <button
                    key={a.v}
                    type="button"
                    aria-pressed={on}
                    onClick={() => flip(a.v)}
                    className={`press rounded-full border-2 px-4 py-2 font-display text-lg font-semibold ${
                      on ? "border-blue bg-blue text-white" : "border-hair bg-sheet hover:border-ink"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={finish}
              className="press mt-7 inline-flex rounded-full bg-ink px-7 py-3 font-display text-xl font-bold text-white hover:bg-blue"
            >
              Show my scholarships <span aria-hidden="true" className="ml-2">→</span>
            </button>
            <p className="mt-5 font-mono text-xs uppercase tracking-wider text-soft">
              <button type="button" onClick={back} className="underline underline-offset-4">
                Back
              </button>
            </p>
          </div>
        )}

        {leaving && (
          <p className="step-in mt-6 text-center font-display text-3xl font-bold tracking-tight sm:text-5xl">
            One second…
          </p>
        )}
      </div>

      <BuddyStage cue={cue} size={small ? 112 : 150} className="mt-6 sm:mt-8" />

      {step === 0 && !school && (
        <p className="mt-4 text-center text-[15px]">
          <Link href="/scholarships" className="font-medium text-blue underline underline-offset-4">
            Skip to the scholarships <span aria-hidden="true">→</span>
          </Link>
        </p>
      )}
    </div>
  );
}
