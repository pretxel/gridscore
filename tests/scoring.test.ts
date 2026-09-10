import { describe, expect, it } from "vitest";
import type { MarketPick } from "@/lib/markets";
import { roundHalfUp, rulePoints, scoreMarket } from "@/lib/scoring";
import { DEFAULT_RULES, SCORING_CASES } from "./scoring-cases";

describe("scoreMarket (shared cases)", () => {
  for (const c of SCORING_CASES) {
    it(c.name, () => {
      expect(
        scoreMarket({
          type: c.type,
          pick: c.pick as MarketPick,
          result: c.result as MarketPick,
          rules: DEFAULT_RULES,
          multiplier: c.multiplier,
        }),
      ).toEqual({ points: c.points, hitType: c.hitType });
    });
  }

  it("covers every market type and hit type", () => {
    const types = new Set(SCORING_CASES.map((c) => c.type));
    const hits = new Set(SCORING_CASES.map((c) => c.hitType));
    expect([...types].sort()).toEqual(
      ["fastest_lap", "first_retirement", "podium", "pole", "safety_car", "sprint_winner"].sort(),
    );
    expect([...hits].sort()).toEqual(["exact", "miss", "podium_exact_all", "podium_partial"]);
  });
});

describe("rules and rounding", () => {
  it("scores 0 for a missing rule without throwing", () => {
    expect(rulePoints({}, "pole", "exact")).toBe(0);
    expect(
      scoreMarket({
        type: "pole",
        pick: { driver_id: "a" },
        result: { driver_id: "a" },
        rules: {},
        multiplier: 1.5,
      }),
    ).toEqual({ points: 0, hitType: "exact" });
  });

  it("rounds half up like Postgres round(numeric)", () => {
    expect(roundHalfUp(82.5)).toBe(83);
    expect(roundHalfUp(4.5)).toBe(5);
    expect(roundHalfUp(22.5)).toBe(23);
    expect(roundHalfUp(7.4999)).toBe(7);
    expect(roundHalfUp(1.15 * 3)).toBe(3);
  });

  it("applies custom rule values", () => {
    const rules = { podium: { exact_position: 1, in_podium: 1, all_exact_bonus: 100 } };
    expect(
      scoreMarket({
        type: "podium",
        pick: { p1: "a", p2: "b", p3: "c" },
        result: { p1: "a", p2: "b", p3: "c" },
        rules,
        multiplier: 1,
      }),
    ).toEqual({ points: 103, hitType: "podium_exact_all" });
  });
});
