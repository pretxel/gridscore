import { describe, expect, it } from "vitest";
import { leagueErrorKey, leagueNameSchema, normalizeJoinCode } from "@/lib/league-form";
import { safeNextPath } from "@/lib/safe-path";

describe("leagueErrorKey", () => {
  it("maps each RPC refusal to its message key", () => {
    expect(leagueErrorKey({ message: "league is full" })).toBe("errorLeagueFull");
    expect(leagueErrorKey({ message: "invalid join code" })).toBe("errorInvalidCode");
    expect(leagueErrorKey({ message: "owner cannot leave; delete the league instead" })).toBe(
      "errorOwnerCannotLeave",
    );
    expect(leagueErrorKey({ message: "only the owner can remove members" })).toBe("errorNotOwner");
    expect(leagueErrorKey({ message: "season is not active" })).toBe("errorNoSeason");
    expect(leagueErrorKey({ message: "no active season" })).toBe("errorNoSeason");
    expect(leagueErrorKey({ message: "league name must be between 2 and 40 characters" })).toBe(
      "errorName",
    );
    expect(leagueErrorKey({ message: "not authenticated" })).toBe("errorNotSignedIn");
  });

  it("treats RLS refusals as a permission problem", () => {
    expect(leagueErrorKey({ code: "42501", message: "permission denied" })).toBe("errorNotOwner");
    expect(leagueErrorKey({ message: "new row violates row-level security policy" })).toBe(
      "errorNotOwner",
    );
  });

  it("falls back to the generic key", () => {
    expect(leagueErrorKey({ message: "connection reset" })).toBe("errorGeneric");
    expect(leagueErrorKey(null)).toBe("errorGeneric");
  });
});

describe("normalizeJoinCode", () => {
  it("accepts the canonical code", () => {
    expect(normalizeJoinCode("GP-7K3PQ")).toBe("GP-7K3PQ");
  });
  it("uppercases, trims and restores the prefix", () => {
    expect(normalizeJoinCode("  gp-7k3pq ")).toBe("GP-7K3PQ");
    expect(normalizeJoinCode("7K3PQ")).toBe("GP-7K3PQ");
    expect(normalizeJoinCode("GP7K3PQ")).toBe("GP-7K3PQ");
    expect(normalizeJoinCode("GP - 7K3PQ")).toBe("GP-7K3PQ");
  });
  it("extracts the code from an invite link", () => {
    expect(normalizeJoinCode("https://example.test/es/leagues/join/GP-7K3PQ?x=1")).toBe("GP-7K3PQ");
    expect(normalizeJoinCode("/en/leagues/join/gp-7k3pq")).toBe("GP-7K3PQ");
  });
  it("rejects codes with excluded characters or wrong length", () => {
    expect(normalizeJoinCode("GP-0OI1L")).toBeNull();
    expect(normalizeJoinCode("GP-7K3P")).toBeNull();
    expect(normalizeJoinCode("")).toBeNull();
    expect(normalizeJoinCode(null)).toBeNull();
  });
});

describe("leagueNameSchema", () => {
  it("trims and enforces 2–40 characters", () => {
    expect(leagueNameSchema.parse("  Paddock Club ")).toBe("Paddock Club");
    expect(leagueNameSchema.safeParse("x").success).toBe(false);
    expect(leagueNameSchema.safeParse("a".repeat(41)).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("only allows same-origin absolute paths", () => {
    expect(safeNextPath("/en/leagues/join/GP-7K3PQ")).toBe("/en/leagues/join/GP-7K3PQ");
    expect(safeNextPath("//evil.test")).toBeNull();
    expect(safeNextPath("https://evil.test")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
