import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_SIZE } from "@/lib/og/size";

// Shared pieces for the generated social cards (opengraph-image routes).
// Satori cannot read CSS variables, so the brand tokens are restated as hex.

export { OG_SIZE } from "@/lib/og/size";

export const OG_COLORS = {
  ink: "#121317",
  paper: "#F4F5F7",
  muted: "#9AA0AB",
  signal: "#E4572E",
  line: "rgba(255,255,255,0.08)",
};

let fontData: Promise<Buffer> | null = null;

// Archivo Black (OFL, assets/fonts) — the same face as the site's headings.
export function ogFonts() {
  fontData ??= readFile(join(process.cwd(), "assets/fonts/ArchivoBlack-Regular.ttf"));
  return fontData.then((data) => [
    { name: "Archivo Black", data, weight: 400 as const, style: "normal" as const },
  ]);
}

// The brand tile: signal square, white "g", kerb stripes along the bottom.
export function OgTile({ size }: { size: number }) {
  const stripe = size / 6;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: OG_COLORS.signal,
        color: "white",
        fontSize: size * 0.66,
        lineHeight: 1,
        paddingBottom: size * 0.12,
      }}
    >
      g
      <div
        style={{
          position: "absolute",
          left: stripe * 0.5,
          bottom: size * 0.095,
          display: "flex",
          gap: stripe,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: stripe,
              height: size * 0.075,
              background: "rgba(255,255,255,0.55)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// A kerb band along the bottom edge of the card. Solid blocks rather than a
// repeating gradient, which Satori softens at the edges.
export function OgKerb() {
  return (
    <div
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, display: "flex" }}
    >
      {Array.from({ length: OG_SIZE.width / 80 }, (_, i) => (
        <div
          key={i}
          style={{ width: 80, height: 14, background: i % 2 ? "transparent" : OG_COLORS.signal }}
        />
      ))}
    </div>
  );
}
