// Monetization hooks, no payments yet. Mirrors `league_member_cap(plan)` in
// SQL: the database enforces the cap; this copy only drives copy and UI.
import type { Plan } from "@/lib/db";

export const FREE_LEAGUE_MEMBER_CAP = 10;

export const PLAN_FEATURES: Record<
  Plan,
  { leagueMemberCap: number | null; premiumStats: boolean }
> = {
  free: { leagueMemberCap: FREE_LEAGUE_MEMBER_CAP, premiumStats: false },
  pro: { leagueMemberCap: null, premiumStats: true },
};

export function isPlan(value: unknown): value is Plan {
  return value === "free" || value === "pro";
}

// null means unlimited. Unknown plans fall back to the free cap so a bad
// value can never lift the limit in the UI.
export function leagueMemberCap(plan: string | null | undefined): number | null {
  return isPlan(plan) ? PLAN_FEATURES[plan].leagueMemberCap : FREE_LEAGUE_MEMBER_CAP;
}

export function isPro(subject: { plan?: string | null } | string | null | undefined): boolean {
  const plan = typeof subject === "string" ? subject : subject?.plan;
  return plan === "pro";
}

export function leagueIsFull(plan: string | null | undefined, memberCount: number): boolean {
  const cap = leagueMemberCap(plan);
  return cap !== null && memberCount >= cap;
}
