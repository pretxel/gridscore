import { TRACE_VIEWBOX, tracePath } from "@/lib/circuit-trace";
import { cn } from "@/lib/utils";

// The faint loop behind a Grand Prix card. Decorative only — `aria-hidden`,
// no title, and never presented as the real circuit layout.
//
// Drawn rather than fetched: a published track map is someone's artwork, and
// an SVG costs no request and scales to any card.
export function CircuitTrace({ seed, className }: { seed: string; className?: string }) {
  const d = tracePath(seed);
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${TRACE_VIEWBOX} ${TRACE_VIEWBOX}`}
      className={cn("pointer-events-none select-none", className)}
      fill="none"
    >
      {/* A wide soft pass under a crisp one reads as asphalt with a kerb. */}
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={11}
        strokeLinejoin="round"
        className="opacity-25"
      />
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinejoin="round"
        className="opacity-90"
      />
    </svg>
  );
}
