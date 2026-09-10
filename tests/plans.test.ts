import { describe, expect, it } from "vitest";
import { isPlan, isPro, leagueIsFull, leagueMemberCap, PLAN_FEATURES } from "@/lib/plans";

describe("plans", () => {
  it("caps free leagues at 10 and lifts the cap on pro", () => {
    expect(leagueMemberCap("free")).toBe(10);
    expect(leagueMemberCap("pro")).toBeNull();
    expect(PLAN_FEATURES.free.leagueMemberCap).toBe(10);
  });

  it("treats unknown plans as free", () => {
    expect(leagueMemberCap(null)).toBe(10);
    expect(leagueMemberCap("enterprise")).toBe(10);
    expect(isPlan("gold")).toBe(false);
  });

  it("isPro reads a plan string or an object with a plan", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro({ plan: "pro" })).toBe(true);
    expect(isPro({ plan: "free" })).toBe(false);
    expect(isPro(null)).toBe(false);
  });

  it("leagueIsFull compares against the cap", () => {
    expect(leagueIsFull("free", 9)).toBe(false);
    expect(leagueIsFull("free", 10)).toBe(true);
    expect(leagueIsFull("pro", 500)).toBe(false);
  });
});
