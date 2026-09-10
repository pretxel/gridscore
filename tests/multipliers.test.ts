import { describe, expect, it } from "vitest";
import { defaultMultiplier, LEGEND_CIRCUITS } from "@/lib/race-sync/multipliers";

describe("defaultMultiplier", () => {
  const base = { lastRound: 23 };

  it("is x1 for a plain weekend", () => {
    expect(
      defaultMultiplier({ ...base, round: 1, hasSprint: false, circuitKey: "albert_park" }),
    ).toEqual({
      multiplier: 1,
      reason: "normal",
    });
  });

  it("is x1.25 for a sprint weekend", () => {
    expect(
      defaultMultiplier({ ...base, round: 2, hasSprint: true, circuitKey: "shanghai" }),
    ).toEqual({
      multiplier: 1.25,
      reason: "sprint",
    });
  });

  it("is x1.5 for every legend circuit, even with a sprint", () => {
    for (const key of LEGEND_CIRCUITS) {
      expect(defaultMultiplier({ ...base, round: 5, hasSprint: true, circuitKey: key })).toEqual({
        multiplier: 1.5,
        reason: "legend",
      });
    }
  });

  it("is x2 for the season finale, above everything else", () => {
    expect(defaultMultiplier({ ...base, round: 23, hasSprint: true, circuitKey: "monza" })).toEqual(
      {
        multiplier: 2,
        reason: "finale",
      },
    );
  });

  it("does not treat round 0 / unknown last round as a finale", () => {
    expect(
      defaultMultiplier({ round: 0, lastRound: 0, hasSprint: false, circuitKey: "x" }).reason,
    ).toBe("normal");
  });
});
