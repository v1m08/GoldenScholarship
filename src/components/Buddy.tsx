"use client";

import { useEffect, useRef, useState } from "react";

// "run" means busy: it bounces in place while something loads.
export type Mood = "idle" | "run" | "happy" | "wave" | "think" | "confused" | "point";

/** What the page wants the buddy to do next. A new `id` starts a new cue. */
export type Cue = { id: number; mood: Mood; say?: string; at?: number };

// A soft blue gumdrop in a graduation cap. Small wide-set eyes, no outlines.
function Character({ mood, size, once = false }: { mood: Mood; size: number; once?: boolean }) {
  return (
    <svg className="bud" data-mood={mood} data-once={once ? "" : undefined} viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="bud-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9cc4ff" />
          <stop offset="1" stopColor="#3d7bf3" />
        </linearGradient>
      </defs>

      <ellipse className="bud-shadow" cx="100" cy="188" rx="46" ry="6" fill="#0d1326" fillOpacity="0.12" />

      <g className="bud-all">
        <ellipse cx="78" cy="172" rx="15" ry="8" fill="#2f63d9" />
        <ellipse cx="122" cy="172" rx="15" ry="8" fill="#2f63d9" />

        <g className="bud-body">
          <ellipse className="bud-arm bud-arm-l" cx="31" cy="130" rx="10" ry="15" fill="#4a86f5" />
          <ellipse className="bud-arm bud-arm-r" cx="169" cy="130" rx="10" ry="15" fill="#4a86f5" />

          <path
            d="M100 46 C150 46 172 84 172 124 C172 160 146 176 100 176 C54 176 28 160 28 124 C28 84 50 46 100 46 Z"
            fill="url(#bud-body)"
          />
          <ellipse cx="70" cy="80" rx="20" ry="9" transform="rotate(-28 70 80)" fill="#ffffff" fillOpacity="0.38" />

          {/* face */}
          <g className="bud-eyes">
            <g className="bud-pupils">
              {/* Big dark eyes with two highlights each: most of the cuteness lives here. */}
              <ellipse cx="70" cy="116" rx="11" ry="13.5" fill="#14203f" />
              <ellipse cx="130" cy="116" rx="11" ry="13.5" fill="#14203f" />
              <circle cx="66.5" cy="110.5" r="4" fill="#ffffff" />
              <circle cx="126.5" cy="110.5" r="4" fill="#ffffff" />
              <circle cx="74" cy="121" r="1.8" fill="#ffffff" fillOpacity="0.85" />
              <circle cx="134" cy="121" r="1.8" fill="#ffffff" fillOpacity="0.85" />
            </g>
          </g>
          <ellipse cx="50" cy="139" rx="11" ry="6" fill="#ff8fa3" fillOpacity="0.55" />
          <ellipse cx="150" cy="139" rx="11" ry="6" fill="#ff8fa3" fillOpacity="0.55" />

          {mood === "happy" || mood === "wave" ? (
            <path d="M90 135 Q100 151 110 135 Z" fill="#14203f" />
          ) : mood === "think" || mood === "run" ? (
            <ellipse cx="100" cy="140" rx="4.5" ry="5.5" fill="#14203f" />
          ) : mood === "confused" ? (
            <path d="M90 142 Q95 136 100 141 T110 140" fill="none" stroke="#14203f" strokeWidth="3.5" strokeLinecap="round" />
          ) : (
            <path d="M92 137 Q100 145 108 137" fill="none" stroke="#14203f" strokeWidth="3.5" strokeLinecap="round" />
          )}

          {/* graduation cap, worn at a tilt */}
          <g className="bud-cap">
            <path d="M70 50 V63 Q100 77 130 63 V50 L100 61 Z" fill="#1b2a52" />
            <path d="M100 24 L152 42 L100 61 L48 42 Z" fill="#14203f" />
            <g className="bud-tassel">
              <path d="M100 42 L142 46 V64" fill="none" stroke="#ffc93c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="142" cy="67" r="4.5" fill="#ffc93c" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * The buddy and its speech bubble. It stays put and reacts in place: floats
 * while idle, hops when pleased, tilts when thinking, bounces while busy.
 * Its eyes follow the pointer.
 */
export function BuddyStage({
  cue,
  size = 150,
  className = "",
}: {
  cue: Cue;
  size?: number;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [poke, setPoke] = useState<{ cue: number; n: number }>({ cue: -1, n: 0 });
  const [calm, setCalm] = useState<number>(-1);

  // Reactions (a hop, a wave) settle back to idle; ongoing states stay.
  const passing = cue.mood === "happy" || cue.mood === "wave" || cue.mood === "confused" || cue.mood === "point";
  useEffect(() => {
    if (!passing) return;
    const t = setTimeout(() => setCalm(cue.id), cue.mood === "point" ? 2600 : 1500);
    return () => clearTimeout(t);
  }, [cue.id, cue.mood, passing]);

  // Clicking it earns one hop.
  useEffect(() => {
    if (poke.n === 0) return;
    const t = setTimeout(() => setPoke((p) => ({ ...p, n: 0 })), 650);
    return () => clearTimeout(t);
  }, [poke]);

  // Eyes follow the pointer. Written straight to the element so it never re-renders.
  useEffect(() => {
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = root.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.6);
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, d / 260) * 4;
        el.style.setProperty("--look-x", `${(dx / d) * reach}px`);
        el.style.setProperty("--look-y", `${(dy / d) * reach}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  const poked = poke.n > 0 && poke.cue === cue.id;
  const mood: Mood = poked ? "happy" : passing && calm === cue.id ? "idle" : cue.mood;

  return (
    <div className={`flex flex-col items-center ${className}`} aria-hidden="true">
      {/* A minimum height so short lines do not shift the page; long ones grow it. */}
      <div className="flex min-h-16 items-end">
        {cue.say && (
          <p
            key={cue.say}
            className="bud-bubble relative w-max max-w-[min(25rem,88vw)] text-balance rounded-2xl bg-sheet px-4 py-2 text-center text-[15px] font-medium leading-snug shadow-[0_6px_24px_-8px_rgba(13,19,38,0.28)]"
          >
            {cue.say}
          </p>
        )}
      </div>
      <div ref={root} className="mt-2">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setPoke((p) => ({ cue: cue.id, n: p.n + 1 }))}
          className="block cursor-pointer"
        >
          {/* A new key per cue restarts the reaction animation. */}
          <span key={`${cue.id}-${poke.n}`} className="block">
            <Character mood={mood} size={size} once={poked} />
          </span>
        </button>
      </div>
    </div>
  );
}
