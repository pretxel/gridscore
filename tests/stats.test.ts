import { describe, expect, it } from "vitest";
import {
  accuracy,
  bestStreak,
  bestWeekend,
  currentStreak,
  deltaVsAverage,
  formatAccuracy,
  type MarketStat,
  strongestMarket,
  totals,
  type WeekendPoints,
} from "@/lib/stats";

// A hand-computed fixture: three weekends, five market rows.
const STATS: MarketStat[] = [
  { marketType: "pole", scored: 4, hits: 3, points: 30 },
  { marketType: "podium", scored: 4, hits: 2, points: 28 },
  { marketType: "fastest_lap", scored: 4, hits: 1, points: 6 },
  { marketType: "safety_car", scored: 3, hits: 3, points: 9 },
  { marketType: "sprint_winner", scored: 1, hits: 1, points: 6 },
];

const WEEKENDS: WeekendPoints[] = [
  { grandPrixId: "a", round: 1, name: "One", points: 18, scored: 4 },
  { grandPrixId: "b", round: 2, name: "Two", points: 0, scored: 4 },
  { grandPrixId: "c", round: 3, name: "Three", points: 25, scored: 4 },
  { grandPrixId: "d", round: 4, name: "Four", points: 36, scored: 4 },
];

describe("accuracy", () => {
  it("is the share of scored calls that hit", () => {
    expect(accuracy({ scored: 4, hits: 3 })).toBe(0.75);
    expect(accuracy({ scored: 3, hits: 3 })).toBe(1);
    expect(accuracy({ scored: 4, hits: 0 })).toBe(0);
  });

  it("is unknown rather than zero with nothing scored", () => {
    expect(accuracy({ scored: 0, hits: 0 })).toBeNull();
  });
});

describe("formatAccuracy", () => {
  it("renders a whole percentage per locale", () => {
    expect(formatAccuracy(0.75, "en")).toBe("75%");
    // Spanish puts a non-breaking space before the sign.
    expect(formatAccuracy(1, "es")).toBe("100 %");
  });

  it("shows a dash when there is nothing to measure", () => {
    expect(formatAccuracy(null, "en")).toBe("—");
  });
});

describe("totals", () => {
  it("adds up every market row", () => {
    expect(totals(STATS)).toEqual({ scored: 16, hits: 10, points: 79 });
  });

  it("is zero for an empty season", () => {
    expect(totals([])).toEqual({ scored: 0, hits: 0, points: 0 });
  });
});

describe("streaks", () => {
  it("counts the run of scoring weekends at the end", () => {
    expect(currentStreak(WEEKENDS)).toBe(2);
  });

  it("is broken by a blank weekend", () => {
    expect(currentStreak([...WEEKENDS, { ...WEEKENDS[1], round: 5, points: 0 }])).toBe(0);
  });

  it("finds the longest run anywhere in the season", () => {
    expect(bestStreak(WEEKENDS)).toBe(2);
    expect(
      bestStreak([
        { grandPrixId: "a", round: 1, name: "One", points: 5, scored: 1 },
        { grandPrixId: "b", round: 2, name: "Two", points: 5, scored: 1 },
        { grandPrixId: "c", round: 3, name: "Three", points: 5, scored: 1 },
        { grandPrixId: "d", round: 4, name: "Four", points: 0, scored: 1 },
      ]),
    ).toBe(3);
  });

  it("is zero with no weekends", () => {
    expect(currentStreak([])).toBe(0);
    expect(bestStreak([])).toBe(0);
  });
});

describe("bestWeekend", () => {
  it("returns the highest-scoring weekend", () => {
    expect(bestWeekend(WEEKENDS)?.round).toBe(4);
  });

  it("keeps the earlier round on a tie", () => {
    const tied: WeekendPoints[] = [
      { grandPrixId: "a", round: 1, name: "One", points: 20, scored: 4 },
      { grandPrixId: "b", round: 2, name: "Two", points: 20, scored: 4 },
    ];
    expect(bestWeekend(tied)?.round).toBe(1);
  });

  it("is null with no weekends", () => {
    expect(bestWeekend([])).toBeNull();
  });
});

describe("deltaVsAverage", () => {
  it("is positive when ahead of the field", () => {
    expect(deltaVsAverage(79, 61.4)).toBe(18);
    expect(deltaVsAverage(40, 61.4)).toBe(-21);
    expect(deltaVsAverage(0, 0)).toBe(0);
  });
});

describe("strongestMarket", () => {
  it("picks the best accuracy among markets with enough history", () => {
    // safety_car is 3/3, and sprint_winner's single call is ignored.
    expect(strongestMarket(STATS)?.marketType).toBe("safety_car");
  });

  it("prefers the market with more calls when accuracy ties", () => {
    const tied: MarketStat[] = [
      { marketType: "pole", scored: 3, hits: 3, points: 24 },
      { marketType: "podium", scored: 6, hits: 6, points: 60 },
    ];
    expect(strongestMarket(tied)?.marketType).toBe("podium");
  });

  it("is null when no market has enough history", () => {
    expect(strongestMarket([{ marketType: "pole", scored: 2, hits: 2, points: 16 }])).toBeNull();
    expect(strongestMarket([])).toBeNull();
  });
});
