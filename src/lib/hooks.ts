"use client";

import { useSyncExternalStore } from "react";

// True while a CSS media query matches. False on the server.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// The raw string stored under a localStorage key, or null. Null on the server.
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      return () => window.removeEventListener("storage", notify);
    },
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

const SAVED_EVENT = "sd-saved-changed";

// Ids of scholarships this student starred, kept in the browser.
export function useSaved(key: string): { ids: string[]; toggle: (id: string) => boolean } {
  const raw = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(SAVED_EVENT, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(SAVED_EVENT, notify);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  const ids = raw ? raw.split(",") : [];
  // Returns true when the id is now saved.
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-500);
    try {
      localStorage.setItem(key, next.join(","));
    } catch {
      // Private browsing: saving is unavailable.
    }
    window.dispatchEvent(new Event(SAVED_EVENT));
    return next.includes(id);
  };
  return { ids, toggle };
}
