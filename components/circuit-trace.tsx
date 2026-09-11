import { tracePath } from "@/lib/circuit-trace";
import { CIRCUIT_LAYOUT_VIEWBOX, circuitLayout } from "@/lib/circuits/layouts";
import { cn } from "@/lib/utils";

// The circuit outline on a Grand Prix card.
//
// Real layouts come from OpenStreetMap (© OpenStreetMap contributors, ODbL),
// traced once by scripts/gen-circuit-layouts.mts and committed — nothing is
// fetched at runtime. Wherever these are drawn the app credits OSM, which the
// licence asks of a Produced Work.
//
// A circuit OSM has not mapped as a closed racing lap — several street
// circuits run on ordinary roads — falls back to the generated loop in
// lib/circuit-trace.ts. That one is decorative and makes no claim to be the
// real course.
export function CircuitTrace({ seed, className }: { seed: string; className?: string }) {
  const real = circuitLayout(seed);
  const d = real ?? tracePath(seed);

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${CIRCUIT_LAYOUT_VIEWBOX} ${CIRCUIT_LAYOUT_VIEWBOX}`}
      className={cn("pointer-events-none select-none", className)}
      fill="none"
    >
      {/* A wide soft pass under a crisp one reads as asphalt with a kerb. */}
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={real ? 8 : 11}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="opacity-25"
      />
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={real ? 2.6 : 3.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}

// Whether a circuit has a real traced layout, so a page credits OpenStreetMap
// only when one is actually on screen.
export function hasRealLayout(seed: string | null | undefined): boolean {
  return circuitLayout(seed) !== null;
}
