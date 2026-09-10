import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasFeature,
  isPlan,
  isPro,
  leagueIsFull,
  leagueMemberCap,
  PLAN_FEATURE_KEYS,
  PLAN_FEATURES,
} from "@/lib/plans";

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

describe("hasFeature", () => {
  it("is the gate for every paid capability", () => {
    expect(hasFeature("pro", "premiumStats")).toBe(true);
    expect(hasFeature("pro", "sponsorFree")).toBe(true);
    expect(hasFeature("free", "premiumStats")).toBe(false);
    expect(hasFeature("free", "sponsorFree")).toBe(false);
  });

  it("denies everything to an unknown or missing plan", () => {
    for (const feature of PLAN_FEATURE_KEYS) {
      expect(hasFeature(null, feature), feature).toBe(false);
      expect(hasFeature(undefined, feature), feature).toBe(false);
      expect(hasFeature("platinum", feature), feature).toBe(false);
    }
  });

  it("lists every capability for both plans", () => {
    for (const plan of ["free", "pro"] as const) {
      for (const feature of PLAN_FEATURE_KEYS) {
        expect(typeof PLAN_FEATURES[plan][feature], `${plan}.${feature}`).toBe("boolean");
      }
    }
  });
});

describe("plan gating is centralised", () => {
  const ROOT = path.resolve(__dirname, "..");
  const SCAN_DIRS = ["app", "components", "lib"];
  // lib/plans.ts is where the comparison is allowed to live.
  const OWNER = path.join("lib", "plans.ts");

  function walk(dir: string, out: string[]): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(path.join(dir, entry.name), out);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        out.push(path.join(dir, entry.name));
      }
    }
  }

  it("no file outside lib/plans.ts compares a plan against a literal", () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir), files);

    const offenders: string[] = [];
    for (const file of files) {
      const relative = path.relative(ROOT, file);
      if (relative === OWNER) continue;
      const source = fs.readFileSync(file, "utf8");
      // `=== "pro"` and friends: a gate that bypasses PLAN_FEATURES.
      for (const match of source.matchAll(/[!=]==\s*["'](pro|free)["']/g)) {
        offenders.push(`${relative}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
