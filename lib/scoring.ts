// TypeScript replica of public.score_market_pick (supabase/migrations/
// 20260910100000_core.sql §7). The SQL is the runtime source of truth; this
// module lets the rules be unit-tested without a database and powers the
// explainer. tests/scoring-cases.ts feeds both this and the SQL parity suite.

import type { HitType, ScoringRuleKey } from "@/lib/db";
import type { MarketPick, MarketType, PodiumPick } from "@/lib/markets";

// Points per (market type, rule key), as loaded from scoring_rules. A missing
// entry scores 0, never throws: the SQL behaves the same.
export type ScoringRules = Partial<Record<MarketType, Partial<Record<ScoringRuleKey, number>>>>;

export function rulePoints(rules: ScoringRules, type: MarketType, key: ScoringRuleKey): number {
  return rules[type]?.[key] ?? 0;
}

// Postgres round(numeric) rounds half away from zero; points are never
// negative, so "half up" is the same thing. The epsilon guards binary float
// artefacts such as 1.15 * 3 = 3.4499999.
export function roundHalfUp(value: number): number {
  return Math.round(value + 1e-9);
}

export type ScoredMarket = { points: number; hitType: HitType };

export function scoreMarket(input: {
  type: MarketType;
  pick: MarketPick;
  result: MarketPick;
  rules: ScoringRules;
  multiplier: number;
}): ScoredMarket {
  const { type, pick, result, rules, multiplier } = input;
  let base = 0;
  let hit: HitType = "miss";

  switch (type) {
    case "pole":
    case "fastest_lap":
    case "sprint_winner": {
      const p = (pick as { driver_id: string }).driver_id;
      const r = (result as { driver_id: string }).driver_id;
      if (p === r) {
        base = rulePoints(rules, type, "exact");
        hit = "exact";
      }
      break;
    }
    case "first_retirement": {
      const p = (pick as { driver_id: string | null }).driver_id;
      const r = (result as { driver_id: string | null }).driver_id;
      if (p === r) {
        base = rulePoints(rules, type, "exact");
        hit = "exact";
      }
      break;
    }
    case "safety_car": {
      if ((pick as { value: boolean }).value === (result as { value: boolean }).value) {
        base = rulePoints(rules, type, "exact");
        hit = "exact";
      }
      break;
    }
    case "podium": {
      const p = pick as PodiumPick;
      const r = result as PodiumPick;
      const resultSet = [r.p1, r.p2, r.p3];
      let exactPositions = 0;
      for (const pos of ["p1", "p2", "p3"] as const) {
        if (p[pos] === r[pos]) {
          base += rulePoints(rules, "podium", "exact_position");
          exactPositions++;
        } else if (resultSet.includes(p[pos])) {
          base += rulePoints(rules, "podium", "in_podium");
        }
      }
      if (exactPositions === 3) {
        base += rulePoints(rules, "podium", "all_exact_bonus");
        hit = "podium_exact_all";
      } else if (base > 0) {
        hit = "podium_partial";
      }
      break;
    }
  }

  return { points: roundHalfUp(base * multiplier), hitType: hit };
}
