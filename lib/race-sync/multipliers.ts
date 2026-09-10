// Default Grand Prix multiplier, applied by the calendar sync unless an admin
// has locked the row. Precedence: finale > legend > sprint > normal. Values
// mirror the product rules in the design spec; admins can override any row.

import type { MultiplierReason } from "@/lib/db";

export const LEGEND_CIRCUITS: ReadonlySet<string> = new Set([
  "monaco",
  "monza",
  "suzuka",
  "interlagos",
  "silverstone",
]);

export const MULTIPLIER_VALUES: Record<Exclude<MultiplierReason, "custom">, number> = {
  normal: 1,
  sprint: 1.25,
  legend: 1.5,
  finale: 2,
};

export type MultiplierInput = {
  round: number;
  lastRound: number;
  hasSprint: boolean;
  circuitKey: string;
};

export function defaultMultiplier(input: MultiplierInput): {
  multiplier: number;
  reason: Exclude<MultiplierReason, "custom">;
} {
  if (input.lastRound > 0 && input.round === input.lastRound) {
    return { multiplier: MULTIPLIER_VALUES.finale, reason: "finale" };
  }
  if (LEGEND_CIRCUITS.has(input.circuitKey)) {
    return { multiplier: MULTIPLIER_VALUES.legend, reason: "legend" };
  }
  if (input.hasSprint) {
    return { multiplier: MULTIPLIER_VALUES.sprint, reason: "sprint" };
  }
  return { multiplier: MULTIPLIER_VALUES.normal, reason: "normal" };
}
