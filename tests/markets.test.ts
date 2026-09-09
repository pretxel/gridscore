import { describe, expect, it } from "vitest";
import {
  driverIdsInPick,
  isMarketType,
  MARKET_TYPES,
  marketLocksAt,
  marketTypesForGrandPrix,
  parsePick,
  safeParsePick,
} from "@/lib/markets";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("market vocabulary", () => {
  it("lists the six market types", () => {
    expect(MARKET_TYPES).toEqual([
      "pole",
      "podium",
      "fastest_lap",
      "first_retirement",
      "safety_car",
      "sprint_winner",
    ]);
    expect(isMarketType("pole")).toBe(true);
    expect(isMarketType("winner")).toBe(false);
  });

  it("drops sprint_winner on non-sprint weekends", () => {
    expect(marketTypesForGrandPrix({ has_sprint: false })).toHaveLength(5);
    expect(marketTypesForGrandPrix({ has_sprint: true })).toContain("sprint_winner");
  });
});

describe("marketLocksAt", () => {
  const gp = {
    qualifying_at: "2026-05-23T14:00:00Z",
    sprint_at: "2026-05-23T10:00:00Z",
    race_at: "2026-05-24T13:00:00Z",
  };

  it("maps each market to its session", () => {
    expect(marketLocksAt(gp, "pole")).toBe(gp.qualifying_at);
    expect(marketLocksAt(gp, "sprint_winner")).toBe(gp.sprint_at);
    for (const t of ["podium", "fastest_lap", "first_retirement", "safety_car"] as const) {
      expect(marketLocksAt(gp, t)).toBe(gp.race_at);
    }
  });

  it("falls back to the race when the named session has no time", () => {
    const bare = { qualifying_at: null, sprint_at: null, race_at: gp.race_at };
    expect(marketLocksAt(bare, "pole")).toBe(gp.race_at);
    expect(marketLocksAt(bare, "sprint_winner")).toBe(gp.race_at);
  });
});

describe("pick schemas", () => {
  it("accepts every valid shape", () => {
    expect(parsePick("pole", { driver_id: A })).toEqual({ driver_id: A });
    expect(parsePick("fastest_lap", { driver_id: A })).toEqual({ driver_id: A });
    expect(parsePick("sprint_winner", { driver_id: A })).toEqual({ driver_id: A });
    expect(parsePick("first_retirement", { driver_id: null })).toEqual({ driver_id: null });
    expect(parsePick("first_retirement", { driver_id: B })).toEqual({ driver_id: B });
    expect(parsePick("safety_car", { value: true })).toEqual({ value: true });
    expect(parsePick("podium", { p1: A, p2: B, p3: C })).toEqual({ p1: A, p2: B, p3: C });
  });

  it("rejects wrong keys, extra keys and bad values", () => {
    expect(safeParsePick("pole", { driver: A }).success).toBe(false);
    expect(safeParsePick("pole", { driver_id: A, extra: 1 }).success).toBe(false);
    expect(safeParsePick("pole", { driver_id: null }).success).toBe(false);
    expect(safeParsePick("pole", { driver_id: "not-a-uuid" }).success).toBe(false);
    expect(safeParsePick("safety_car", { value: "yes" }).success).toBe(false);
    expect(safeParsePick("first_retirement", {}).success).toBe(false);
    expect(safeParsePick("podium", { p1: A, p2: B }).success).toBe(false);
    expect(safeParsePick("podium", "nope").success).toBe(false);
  });

  it("rejects duplicate podium drivers", () => {
    const res = safeParsePick("podium", { p1: A, p2: A, p3: C });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toMatch(/distinct/);
    }
  });
});

describe("driverIdsInPick", () => {
  it("extracts the referenced drivers", () => {
    expect(driverIdsInPick("podium", { p1: A, p2: B, p3: C })).toEqual([A, B, C]);
    expect(driverIdsInPick("pole", { driver_id: A })).toEqual([A]);
    expect(driverIdsInPick("first_retirement", { driver_id: null })).toEqual([]);
    expect(driverIdsInPick("safety_car", { value: false })).toEqual([]);
  });
});
