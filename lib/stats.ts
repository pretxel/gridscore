// Per-user season statistics behind /stats. The SQL functions do the
// grouping; everything derived from those rows lives here as pure functions so
// the arithmetic is unit-tested without a database.

import type { MarketType } from "@/lib/markets";

export type MarketStat = {
  marketType: MarketType;
  scored: number;
  hits: number;
  points: number;
};

export type WeekendPoints = {
  grandPrixId: string;
  round: number;
  name: string;
  points: number;
  scored: number;
};

// Share of scored calls that were not a miss, 0–1. A market with nothing
// scored yet has no accuracy rather than 0%, so the UI can say "—".
export function accuracy(stat: { scored: number; hits: number }): number | null {
  if (stat.scored <= 0) return null;
  return stat.hits / stat.scored;
}

export function formatAccuracy(value: number | null, locale: string): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

export type Totals = { scored: number; hits: number; points: number };

export function totals(stats: readonly MarketStat[]): Totals {
  return stats.reduce<Totals>(
    (acc, s) => ({
      scored: acc.scored + s.scored,
      hits: acc.hits + s.hits,
      points: acc.points + s.points,
    }),
    { scored: 0, hits: 0, points: 0 },
  );
}

// A weekend counts towards a streak when it paid at least one point. Weekends
// arrive oldest first, so the current streak is the run at the end.
export function currentStreak(weekends: readonly WeekendPoints[]): number {
  let streak = 0;
  for (let i = weekends.length - 1; i >= 0; i--) {
    if (weekends[i].points <= 0) break;
    streak++;
  }
  return streak;
}

export function bestStreak(weekends: readonly WeekendPoints[]): number {
  let best = 0;
  let run = 0;
  for (const weekend of weekends) {
    run = weekend.points > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export function bestWeekend(weekends: readonly WeekendPoints[]): WeekendPoints | null {
  let best: WeekendPoints | null = null;
  for (const weekend of weekends) {
    // Ties keep the earlier round: the first time you hit that score.
    if (!best || weekend.points > best.points) best = weekend;
  }
  return best;
}

// How far the user sits from the field's average total. Positive means ahead.
// Rounded to a whole point because that is the unit the board shows.
export function deltaVsAverage(myPoints: number, averagePoints: number): number {
  return Math.round(myPoints - averagePoints);
}

// The market a user is best at, ignoring markets with too little history to
// mean anything.
export const MIN_SCORED_FOR_BEST_MARKET = 3;

export function strongestMarket(stats: readonly MarketStat[]): MarketStat | null {
  let best: MarketStat | null = null;
  let bestAccuracy = -1;
  for (const stat of stats) {
    if (stat.scored < MIN_SCORED_FOR_BEST_MARKET) continue;
    const value = accuracy(stat);
    if (value === null) continue;
    // Same accuracy: prefer the market with more calls behind it.
    if (value > bestAccuracy || (value === bestAccuracy && best && stat.scored > best.scored)) {
      best = stat;
      bestAccuracy = value;
    }
  }
  return best;
}
