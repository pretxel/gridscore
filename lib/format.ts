// Locale-aware formatting for the two things the UI repeats everywhere:
// points and session instants. Pure, so both the server fallback and the
// client swap use the same code.
//
// Every instant is stored in UTC. The server cannot know the viewer's zone, so
// it renders an unambiguous UTC string and the client re-formats after mount;
// `LocalTime` owns that hand-off.

import type { Locale } from "@/lib/i18n";

export type TimeFormat = "datetime" | "time" | "date";

// Points are plain integers, but a Spanish reader expects 1.250 where an
// English one expects 1,250.
export function formatPoints(locale: Locale, points: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(points);
}

// Multipliers carry up to two decimals and should never show trailing zeros:
// ×1,25 in Spanish, ×1.25 in English, and ×2 rather than ×2.00.
export function formatMultiplier(locale: Locale, multiplier: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(multiplier);
}

const OPTIONS: Record<TimeFormat, Intl.DateTimeFormatOptions> = {
  date: { weekday: "short", year: "numeric", month: "short", day: "numeric" },
  time: { hour: "2-digit", minute: "2-digit" },
  datetime: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
};

// One session instant in the viewer's zone (or an explicit one, which is what
// makes this testable). Returns the UTC fallback for an unparseable value so a
// bad row never blanks a page.
export function formatSessionTime(
  iso: string,
  locale: Locale,
  format: TimeFormat = "datetime",
  timeZone?: string,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    ...OPTIONS[format],
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

// The deterministic string the server renders: identical in every locale and
// zone, so hydration cannot mismatch. Marked UTC because it is.
export function utcFallback(iso: string, format: TimeFormat = "datetime"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const stamp = date.toISOString();
  if (format === "date") return `${stamp.slice(0, 10)} UTC`;
  if (format === "time") return `${stamp.slice(11, 16)} UTC`;
  return `${stamp.replace("T", " ").slice(0, 16)} UTC`;
}
