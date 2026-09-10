import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderScoringParitySql } from "./scoring-parity-render";

// The SQL parity suite is generated from the same cases the TS tests use.
// If someone edits the cases without regenerating, this fails with a hint.
describe("supabase/tests/scoring_parity.sql", () => {
  it("matches the scoring cases (run `pnpm gen:scoring-parity` if not)", () => {
    const committed = readFileSync(
      join(__dirname, "..", "supabase", "tests", "scoring_parity.sql"),
      "utf8",
    );
    expect(committed).toBe(renderScoringParitySql());
  });
});
