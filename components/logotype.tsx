import { cn } from "@/lib/utils";

type Size = "xs" | "md" | "xl";

// Geometry tuned for the viewBox 0 0 260 64.
// Full form: (signal tile with a "g") | ridscore
// Compact form (xs): the tile alone, viewBox tightened to 0 0 64 64.

const FULL_VIEWBOX = "0 0 260 64";
const COMPACT_VIEWBOX = "0 0 64 64";

const PIXEL_HEIGHT: Record<Size, number> = {
  xs: 22,
  md: 44,
  xl: 96,
};

const DISPLAY_FONT = "var(--font-archivo), 'Archivo Black', sans-serif";

export function Logotype({
  size = "md",
  className,
  ariaLabel,
}: {
  size?: Size;
  className?: string;
  ariaLabel?: string;
}) {
  const compact = size === "xs";
  const viewBox = compact ? COMPACT_VIEWBOX : FULL_VIEWBOX;
  const heightPx = PIXEL_HEIGHT[size];
  const widthPx = compact ? heightPx : heightPx * (260 / 64);

  return (
    <svg
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      viewBox={viewBox}
      width={widthPx}
      height={heightPx}
      preserveAspectRatio="xMidYMid meet"
      className={cn("shrink-0 align-middle text-foreground", className)}
    >
      {/* Tile: signal-colored rounded square with the brand initial and a
          kerb stripe along the bottom edge. */}
      <g>
        <rect
          x={compact ? 8 : 4}
          y="8"
          width="48"
          height="48"
          rx="10"
          style={{ fill: "var(--signal)" }}
        />
        <rect
          x={compact ? 8 : 4}
          y="8"
          width="48"
          height="16"
          rx="10"
          fill="white"
          fillOpacity="0.08"
        />
        <g fill="white" fillOpacity="0.55">
          <rect x={compact ? 12 : 8} y="48" width="8" height="4" />
          <rect x={compact ? 28 : 24} y="48" width="8" height="4" />
          <rect x={compact ? 44 : 40} y="48" width="8" height="4" />
        </g>
        <text
          x={compact ? 32 : 28}
          y="42"
          textAnchor="middle"
          style={{
            fontFamily: DISPLAY_FONT,
            fill: "var(--signal-foreground)",
          }}
          fontSize="30"
          letterSpacing="-1"
        >
          g
        </text>
      </g>

      {compact ? null : (
        <g fill="currentColor">
          <text
            x="62"
            y="43"
            style={{ fontFamily: DISPLAY_FONT }}
            fontSize="26"
            letterSpacing="0.5"
          >
            ridscore
          </text>
        </g>
      )}
    </svg>
  );
}
