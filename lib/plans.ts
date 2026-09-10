// Monetization hooks, no payments yet.
//
// This file is the only place that decides what a plan unlocks: every other
// module asks `hasFeature`, `isPro` or `leagueMemberCap` instead of comparing
// against the string "pro". `tests/plans.test.ts` enforces that, so adding a
// paid feature later means editing one table rather than hunting comparisons.
//
// The league cap mirrors `league_member_cap(plan)` in SQL. The database is the
// authority there; this copy only drives copy and UI.

import type { Plan } from "@/lib/db";

export const FREE_LEAGUE_MEMBER_CAP = 10;

// Boolean capabilities a plan unlocks. `sponsorFree` is stated as a capability
// rather than "show sponsors to free users" so the table reads as a list of
// what you get, not what you are denied.
export type PlanFeature = "premiumStats" | "sponsorFree";

export type PlanCapabilities = {
  // null means unlimited.
  leagueMemberCap: number | null;
} & Record<PlanFeature, boolean>;

export const PLAN_FEATURES: Record<Plan, PlanCapabilities> = {
  free: {
    leagueMemberCap: FREE_LEAGUE_MEMBER_CAP,
    premiumStats: false,
    sponsorFree: false,
  },
  pro: {
    leagueMemberCap: null,
    premiumStats: true,
    sponsorFree: true,
  },
};

export const PLAN_FEATURE_KEYS: readonly PlanFeature[] = ["premiumStats", "sponsorFree"];

export function isPlan(value: unknown): value is Plan {
  return value === "free" || value === "pro";
}

// Unknown or missing plans are treated as free: a bad value must never unlock
// something.
function capabilities(plan: string | null | undefined): PlanCapabilities {
  return isPlan(plan) ? PLAN_FEATURES[plan] : PLAN_FEATURES.free;
}

export function hasFeature(plan: string | null | undefined, feature: PlanFeature): boolean {
  return capabilities(plan)[feature];
}

export function leagueMemberCap(plan: string | null | undefined): number | null {
  return capabilities(plan).leagueMemberCap;
}

// Accepts a plan string or anything carrying one (a profile, a league row).
export function isPro(subject: { plan?: string | null } | string | null | undefined): boolean {
  const plan = typeof subject === "string" ? subject : subject?.plan;
  return isPlan(plan) && plan === "pro";
}

export function leagueIsFull(plan: string | null | undefined, memberCount: number): boolean {
  const cap = leagueMemberCap(plan);
  return cap !== null && memberCount >= cap;
}
