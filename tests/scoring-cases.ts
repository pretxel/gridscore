// Single source of truth for scoring expectations. tests/scoring.test.ts runs
// every case through lib/scoring.ts; scripts/gen-scoring-parity.mts renders the
// same cases into supabase/tests/scoring_parity.sql so the SQL function is held
// to identical numbers. Driver ids are placeholders d1..d6 resolved per season.

import type { ScoringRules } from "@/lib/scoring";

export const DEFAULT_RULES: ScoringRules = {
  podium: { exact_position: 10, in_podium: 4, all_exact_bonus: 25 },
  pole: { exact: 8 },
  fastest_lap: { exact: 6 },
  first_retirement: { exact: 6 },
  safety_car: { exact: 3 },
  sprint_winner: { exact: 6 },
};

export type ScoringCase = {
  name: string;
  type: "pole" | "podium" | "fastest_lap" | "first_retirement" | "safety_car" | "sprint_winner";
  pick: Record<string, string | boolean | null>;
  result: Record<string, string | boolean | null>;
  multiplier: number;
  points: number;
  hitType: "exact" | "podium_exact_all" | "podium_partial" | "miss";
};

const podium = (p1: string, p2: string, p3: string) => ({ p1, p2, p3 });
const driver = (id: string | null) => ({ driver_id: id });
const sc = (value: boolean) => ({ value });

export const SCORING_CASES: ScoringCase[] = [
  // Podium, multiplier 1.
  {
    name: "podium all exact",
    type: "podium",
    pick: podium("d1", "d2", "d3"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1,
    points: 55,
    hitType: "podium_exact_all",
  },
  {
    name: "podium two exact, one wrong",
    type: "podium",
    pick: podium("d1", "d2", "d4"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1,
    points: 20,
    hitType: "podium_partial",
  },
  {
    name: "podium two exact, one in podium",
    type: "podium",
    pick: podium("d1", "d2", "d3"),
    result: podium("d1", "d2", "d4"),
    multiplier: 1,
    points: 20,
    hitType: "podium_partial",
  },
  {
    name: "podium one exact, two swapped",
    type: "podium",
    pick: podium("d1", "d3", "d2"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1,
    points: 18,
    hitType: "podium_partial",
  },
  {
    name: "podium three in wrong order",
    type: "podium",
    pick: podium("d3", "d1", "d2"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1,
    points: 12,
    hitType: "podium_partial",
  },
  {
    name: "podium one in podium only",
    type: "podium",
    pick: podium("d4", "d5", "d1"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1,
    points: 4,
    hitType: "podium_partial",
  },
  {
    name: "podium none",
    type: "podium",
    pick: podium("d4", "d5", "d6"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1,
    points: 0,
    hitType: "miss",
  },
  // Single-answer markets.
  {
    name: "pole exact",
    type: "pole",
    pick: driver("d1"),
    result: driver("d1"),
    multiplier: 1,
    points: 8,
    hitType: "exact",
  },
  {
    name: "pole miss",
    type: "pole",
    pick: driver("d2"),
    result: driver("d1"),
    multiplier: 1,
    points: 0,
    hitType: "miss",
  },
  {
    name: "fastest lap exact",
    type: "fastest_lap",
    pick: driver("d3"),
    result: driver("d3"),
    multiplier: 1,
    points: 6,
    hitType: "exact",
  },
  {
    name: "sprint winner exact",
    type: "sprint_winner",
    pick: driver("d2"),
    result: driver("d2"),
    multiplier: 1,
    points: 6,
    hitType: "exact",
  },
  {
    name: "sprint winner miss",
    type: "sprint_winner",
    pick: driver("d2"),
    result: driver("d5"),
    multiplier: 1,
    points: 0,
    hitType: "miss",
  },
  {
    name: "first retirement driver exact",
    type: "first_retirement",
    pick: driver("d6"),
    result: driver("d6"),
    multiplier: 1,
    points: 6,
    hitType: "exact",
  },
  {
    name: "first retirement none/none",
    type: "first_retirement",
    pick: driver(null),
    result: driver(null),
    multiplier: 1,
    points: 6,
    hitType: "exact",
  },
  {
    name: "first retirement none vs driver",
    type: "first_retirement",
    pick: driver(null),
    result: driver("d1"),
    multiplier: 1,
    points: 0,
    hitType: "miss",
  },
  {
    name: "first retirement driver vs none",
    type: "first_retirement",
    pick: driver("d1"),
    result: driver(null),
    multiplier: 1,
    points: 0,
    hitType: "miss",
  },
  {
    name: "safety car yes/yes",
    type: "safety_car",
    pick: sc(true),
    result: sc(true),
    multiplier: 1,
    points: 3,
    hitType: "exact",
  },
  {
    name: "safety car no/no",
    type: "safety_car",
    pick: sc(false),
    result: sc(false),
    multiplier: 1,
    points: 3,
    hitType: "exact",
  },
  {
    name: "safety car mismatch",
    type: "safety_car",
    pick: sc(false),
    result: sc(true),
    multiplier: 1,
    points: 0,
    hitType: "miss",
  },
  // Multipliers and rounding (half away from zero).
  {
    name: "pole x1.25 = 10",
    type: "pole",
    pick: driver("d1"),
    result: driver("d1"),
    multiplier: 1.25,
    points: 10,
    hitType: "exact",
  },
  {
    name: "podium all exact x1.5 = 82.5 -> 83",
    type: "podium",
    pick: podium("d1", "d2", "d3"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1.5,
    points: 83,
    hitType: "podium_exact_all",
  },
  {
    name: "safety car x1.5 = 4.5 -> 5",
    type: "safety_car",
    pick: sc(true),
    result: sc(true),
    multiplier: 1.5,
    points: 5,
    hitType: "exact",
  },
  {
    name: "podium 18 x1.25 = 22.5 -> 23",
    type: "podium",
    pick: podium("d1", "d3", "d2"),
    result: podium("d1", "d2", "d3"),
    multiplier: 1.25,
    points: 23,
    hitType: "podium_partial",
  },
  {
    name: "pole x2 = 16",
    type: "pole",
    pick: driver("d1"),
    result: driver("d1"),
    multiplier: 2,
    points: 16,
    hitType: "exact",
  },
  {
    name: "miss stays 0 under x2",
    type: "podium",
    pick: podium("d4", "d5", "d6"),
    result: podium("d1", "d2", "d3"),
    multiplier: 2,
    points: 0,
    hitType: "miss",
  },
  {
    name: "fastest lap x1.25 = 7.5 -> 8",
    type: "fastest_lap",
    pick: driver("d3"),
    result: driver("d3"),
    multiplier: 1.25,
    points: 8,
    hitType: "exact",
  },
];
