// Renders tests/scoring-cases.ts into supabase/tests/scoring_parity.sql so the
// SQL scoring function is checked against the exact numbers the TypeScript
// replica is tested with. Run with `pnpm gen:scoring-parity`; the Vitest suite
// tests/scoring-parity.test.ts fails when the committed file is stale.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderScoringParitySql } from "../tests/scoring-parity-render.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "supabase", "tests", "scoring_parity.sql");
writeFileSync(target, renderScoringParitySql());
console.log(`wrote ${target}`);
