import { ImageResponse } from "next/og";

// The picture shown when a page is shared in a chat, a post or a search result.
export const ogSize = { width: 1200, height: 630 };

export function ogCard({ kicker, title, foot }: { kicker: string; title: string; foot: string }) {
  const long = title.length > 34;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f3f6fc",
          color: "#0d1326",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            {/* The logo: "golden" over highlighter strokes. */}
            <div style={{ display: "flex", position: "relative", padding: "0 6px", marginLeft: -6 }}>
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" width="100%" height="96%" style={{ position: "absolute", left: 0, top: "6%" }}>
                <path d="M3 29Q8 18 14 7Q17 20 21 33Q28 19 35 5Q38 20 43 35Q50 21 57 8Q60 20 64 32Q71 18 79 5Q82 19 86 34Q91 22 97 10" fill="none" stroke="#ffc93c" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                <path d="M8 34Q14 22 20 9Q24 21 29 31Q36 20 44 8Q47 19 52 33Q59 21 66 10Q69 20 74 31Q81 21 89 9" fill="none" stroke="#ffc93c" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
              </svg>
              <div style={{ display: "flex" }}>golden</div>
            </div>
            <div style={{ display: "flex" }}>scholarship</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#2563eb" }}>{kicker}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <div style={{ display: "flex", fontSize: long ? 68 : 92, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>
              {title}
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#586178" }}>{foot}</div>
          </div>
          <svg viewBox="14 14 172 172" width="250" height="250">
            <ellipse cx="78" cy="172" rx="15" ry="8" fill="#2f63d9" />
      <ellipse cx="122" cy="172" rx="15" ry="8" fill="#2f63d9" />
      <path d="M100 46 C150 46 172 84 172 124 C172 160 146 176 100 176 C54 176 28 160 28 124 C28 84 50 46 100 46 Z" fill="#5b93f7" />
      <ellipse cx="70" cy="116" rx="11" ry="13.5" fill="#14203f" />
      <ellipse cx="130" cy="116" rx="11" ry="13.5" fill="#14203f" />
      <circle cx="66.5" cy="110.5" r="4" fill="#ffffff" />
      <circle cx="126.5" cy="110.5" r="4" fill="#ffffff" />
      <ellipse cx="50" cy="139" rx="11" ry="6" fill="#ff8fa3" />
      <ellipse cx="150" cy="139" rx="11" ry="6" fill="#ff8fa3" />
      <path d="M90 135 Q100 151 110 135 Z" fill="#14203f" />
      <path d="M70 50 V63 Q100 77 130 63 V50 L100 61 Z" fill="#1b2a52" />
      <path d="M100 24 L152 42 L100 61 L48 42 Z" fill="#14203f" />
      <path d="M100 42 L142 46 V64" fill="none" stroke="#ffc93c" strokeWidth="3" />
      <circle cx="142" cy="67" r="4.5" fill="#ffc93c" />
          </svg>
        </div>
      </div>
    ),
    ogSize,
  );
}
