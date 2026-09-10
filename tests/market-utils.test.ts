import { describe, expect, it } from "vitest";
import {
  grandPrixPhase,
  isClosingSoon,
  isMarketLocked,
  lockReason,
  marketsNeedingPick,
  nextGrandPrix,
  nextLockingMarket,
  sortMarkets,
  weekendStart,
} from "@/lib/market-utils";
import { formatPick } from "@/lib/pick-format";

const NOW = Date.parse("2026-05-24T12:00:00Z");
const before = "2026-05-24T11:59:59Z";
const after = "2026-05-24T13:00:00Z";

describe("lockReason / isMarketLocked", () => {
  it("is open only while status is open and locks_at is ahead", () => {
    expect(lockReason({ locks_at: after, status: "open" }, NOW)).toBeNull();
    expect(isMarketLocked({ locks_at: after, status: "open" }, NOW)).toBe(false);
  });
  it("locks on time regardless of a stale open status", () => {
    expect(lockReason({ locks_at: before, status: "open" }, NOW)).toBe("time");
  });
  it("reports the terminal states", () => {
    expect(lockReason({ locks_at: after, status: "locked" }, NOW)).toBe("locked");
    expect(lockReason({ locks_at: after, status: "resolved" }, NOW)).toBe("resolved");
    expect(lockReason({ locks_at: after, status: "void" }, NOW)).toBe("void");
  });
});

describe("isClosingSoon", () => {
  it("is true inside the lead window and false outside or past", () => {
    expect(isClosingSoon("2026-05-24T12:10:00Z", NOW)).toBe(true);
    expect(isClosingSoon("2026-05-24T14:00:00Z", NOW)).toBe(false);
    expect(isClosingSoon(before, NOW)).toBe(false);
  });
});

describe("sortMarkets", () => {
  it("orders by lock time, then by display rank", () => {
    const sorted = sortMarkets([
      { type: "safety_car", locks_at: after },
      { type: "pole", locks_at: before },
      { type: "podium", locks_at: after },
      { type: "sprint_winner", locks_at: "2026-05-23T10:00:00Z" },
    ]);
    expect(sorted.map((m) => m.type)).toEqual(["sprint_winner", "pole", "podium", "safety_car"]);
  });
});

const gp = (over: Partial<Parameters<typeof grandPrixPhase>[0]> & { round: number }) => ({
  status: "scheduled",
  race_at: "2026-05-24T13:00:00Z",
  fp1_at: "2026-05-22T11:30:00Z",
  sprint_qualifying_at: null,
  sprint_at: null,
  qualifying_at: "2026-05-23T14:00:00Z",
  ...over,
});

describe("grandPrixPhase / weekendStart", () => {
  it("starts the weekend at the first session", () => {
    expect(weekendStart(gp({ round: 1 }))).toBe("2026-05-22T11:30:00.000Z");
    expect(grandPrixPhase(gp({ round: 1 }), NOW)).toBe("weekend");
    expect(grandPrixPhase(gp({ round: 1 }), Date.parse("2026-05-20T00:00:00Z"))).toBe("upcoming");
  });
  it("respects terminal statuses", () => {
    expect(grandPrixPhase(gp({ round: 1, status: "completed" }), NOW)).toBe("completed");
    expect(grandPrixPhase(gp({ round: 1, status: "cancelled" }), NOW)).toBe("cancelled");
  });
});

describe("nextGrandPrix", () => {
  const season = [
    gp({
      round: 1,
      status: "completed",
      race_at: "2026-03-08T04:00:00Z",
      fp1_at: "2026-03-06T01:00:00Z",
      qualifying_at: "2026-03-07T05:00:00Z",
    }),
    gp({ round: 2, race_at: "2026-05-24T13:00:00Z" }),
    gp({
      round: 3,
      race_at: "2026-06-07T13:00:00Z",
      fp1_at: "2026-06-05T11:00:00Z",
      qualifying_at: "2026-06-06T14:00:00Z",
    }),
  ];
  it("prefers the weekend in progress", () => {
    expect(nextGrandPrix(season, NOW)?.round).toBe(2);
  });
  it("falls back to the next upcoming, then the last one", () => {
    expect(nextGrandPrix(season, Date.parse("2026-05-30T00:00:00Z"))?.round).toBe(3);
    expect(nextGrandPrix(season, Date.parse("2026-12-30T00:00:00Z"))?.round).toBe(3);
    expect(nextGrandPrix([], NOW)).toBeNull();
  });
  it("skips cancelled weekends", () => {
    expect(nextGrandPrix([gp({ round: 1, status: "cancelled" })], NOW)).toBeNull();
  });
});

describe("marketsNeedingPick / nextLockingMarket", () => {
  const markets = [
    { id: "a", locks_at: before, status: "open" },
    { id: "b", locks_at: after, status: "open" },
    { id: "c", locks_at: "2026-05-24T18:00:00Z", status: "open" },
    { id: "d", locks_at: "2026-05-24T18:00:00Z", status: "void" },
  ];
  it("lists open, unpicked markets", () => {
    expect(marketsNeedingPick(markets, new Set(["b"]), NOW).map((m) => m.id)).toEqual(["c"]);
  });
  it("finds the soonest open market", () => {
    expect(nextLockingMarket(markets, NOW)?.id).toBe("b");
    expect(nextLockingMarket([markets[0]!, markets[3]!], NOW)).toBeNull();
  });
});

describe("formatPick", () => {
  const drivers = new Map([
    ["1", { code: "VER", givenName: "Max", familyName: "Verstappen" }],
    ["2", { code: null, givenName: "Lando", familyName: "Norris" }],
  ]);
  const labels = { none: "None", yes: "Yes", no: "No", unknown: "?" };
  it("renders every shape", () => {
    expect(formatPick("pole", { driver_id: "1" }, drivers, labels)).toBe("VER");
    expect(formatPick("pole", { driver_id: "2" }, drivers, labels)).toBe("Norris");
    expect(formatPick("pole", { driver_id: "9" }, drivers, labels)).toBe("?");
    expect(formatPick("first_retirement", { driver_id: null }, drivers, labels)).toBe("None");
    expect(formatPick("safety_car", { value: true }, drivers, labels)).toBe("Yes");
    expect(formatPick("podium", { p1: "1", p2: "2", p3: "9" }, drivers, labels)).toBe(
      "VER · Norris · ?",
    );
    expect(formatPick("pole", null, drivers, labels)).toBe("");
  });
});
