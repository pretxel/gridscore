import { describe, expect, it } from "vitest";
import { findOwnRow, parseGrandPrixParam } from "@/lib/leaderboard-segment";

describe("parseGrandPrixParam", () => {
  const known = ["monaco", "monza"];
  it("returns the season when absent or unknown", () => {
    expect(parseGrandPrixParam(undefined, known)).toEqual({ kind: "overall" });
    expect(parseGrandPrixParam("spa", known)).toEqual({ kind: "overall" });
    expect(parseGrandPrixParam("", known)).toEqual({ kind: "overall" });
  });
  it("returns the first known slug, trimmed", () => {
    expect(parseGrandPrixParam(" monza ", known)).toEqual({ kind: "grand_prix", slug: "monza" });
    expect(parseGrandPrixParam(["spa", "monaco"], known)).toEqual({
      kind: "grand_prix",
      slug: "monaco",
    });
  });
});

describe("findOwnRow", () => {
  const rows = [{ user_id: "a" }, { user_id: "b" }];
  it("finds the caller's row or null", () => {
    expect(findOwnRow(rows, "b")).toEqual({ user_id: "b" });
    expect(findOwnRow(rows, "z")).toBeNull();
    expect(findOwnRow(rows, null)).toBeNull();
  });
});
