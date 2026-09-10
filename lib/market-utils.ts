// Pure helpers over markets and Grands Prix for the UI. No DB access, no
// `server-only`, so client components and tests can import them.

import type { MarketType } from "@/lib/markets";

export type MarketLockShape = { locks_at: string; status: string };

export type LockReason = "resolved" | "void" | "locked" | "time";

// Why a market cannot take picks right now, or null while it is open.
// `locks_at` alone decides the time lock, mirroring the database rule.
export function lockReason(market: MarketLockShape, now: number = Date.now()): LockReason | null {
  if (market.status === "resolved") return "resolved";
  if (market.status === "void") return "void";
  if (market.status === "locked") return "locked";
  if (Date.parse(market.locks_at) <= now) return "time";
  return null;
}

export function isMarketLocked(market: MarketLockShape, now: number = Date.now()): boolean {
  return lockReason(market, now) !== null;
}

// Lead window for the "closes soon" urgency state.
export const LOCK_LEAD_WINDOW_MS = 30 * 60_000;

export function isClosingSoon(
  locksAt: string,
  now: number = Date.now(),
  leadWindowMs: number = LOCK_LEAD_WINDOW_MS,
): boolean {
  const remaining = Date.parse(locksAt) - now;
  return remaining > 0 && remaining <= leadWindowMs;
}

// Display order: chronological by the session each market locks at.
export const MARKET_DISPLAY_ORDER: readonly MarketType[] = [
  "sprint_winner",
  "pole",
  "podium",
  "fastest_lap",
  "first_retirement",
  "safety_car",
];

export function sortMarkets<T extends { type: MarketType; locks_at: string }>(markets: T[]): T[] {
  const rank = new Map(MARKET_DISPLAY_ORDER.map((t, i) => [t, i]));
  return [...markets].sort((a, b) => {
    const dt = Date.parse(a.locks_at) - Date.parse(b.locks_at);
    if (dt !== 0) return dt;
    return (rank.get(a.type) ?? 99) - (rank.get(b.type) ?? 99);
  });
}

export type GrandPrixPhase = "upcoming" | "weekend" | "completed" | "cancelled";

type GrandPrixShape = {
  status: string;
  race_at: string;
  fp1_at: string | null;
  sprint_qualifying_at: string | null;
  sprint_at: string | null;
  qualifying_at: string | null;
};

// First session instant of the weekend (falls back to the race).
export function weekendStart(gp: GrandPrixShape): string {
  const candidates = [
    gp.fp1_at,
    gp.sprint_qualifying_at,
    gp.sprint_at,
    gp.qualifying_at,
    gp.race_at,
  ]
    .filter((v): v is string => v != null)
    .map((v) => Date.parse(v))
    .filter((ms) => !Number.isNaN(ms));
  return new Date(Math.min(...candidates)).toISOString();
}

// How long after lights out a weekend still counts as running when no
// result has landed yet (a race plus a generous delay).
export const RACE_GRACE_MS = 4 * 60 * 60 * 1000;

export function grandPrixPhase(gp: GrandPrixShape, now: number = Date.now()): GrandPrixPhase {
  if (gp.status === "cancelled") return "cancelled";
  if (gp.status === "completed") return "completed";
  if (Date.parse(gp.race_at) + RACE_GRACE_MS <= now) return "completed";
  if (Date.parse(weekendStart(gp)) <= now) return "weekend";
  return "upcoming";
}

// The Grand Prix a visitor should look at first: the one whose weekend is on
// or the next one to start; the last one once the season is over.
export function nextGrandPrix<T extends GrandPrixShape & { round: number }>(
  gps: T[],
  now: number = Date.now(),
): T | null {
  const live = gps.filter((g) => g.status !== "cancelled").sort((a, b) => a.round - b.round);
  if (live.length === 0) return null;
  const current = live.find((g) => grandPrixPhase(g, now) === "weekend");
  if (current) return current;
  const upcoming = live.find((g) => Date.parse(g.race_at) > now && g.status !== "completed");
  return upcoming ?? live[live.length - 1] ?? null;
}

// Markets a signed-in user can still act on: open and not yet picked.
export function marketsNeedingPick<T extends { id: string } & MarketLockShape>(
  markets: T[],
  pickedIds: ReadonlySet<string>,
  now: number = Date.now(),
): T[] {
  return markets.filter((m) => !pickedIds.has(m.id) && !isMarketLocked(m, now));
}

// The next market to lock among the open ones (drives the page countdown).
export function nextLockingMarket<T extends MarketLockShape>(
  markets: T[],
  now: number = Date.now(),
): T | null {
  const open = markets.filter((m) => !isMarketLocked(m, now));
  if (open.length === 0) return null;
  return open.reduce((a, b) => (Date.parse(a.locks_at) <= Date.parse(b.locks_at) ? a : b));
}
