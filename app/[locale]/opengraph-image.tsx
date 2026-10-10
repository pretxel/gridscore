import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { OG_COLORS, OG_SIZE, OgKerb, OgTile, ogFonts } from "@/lib/og/brand";
import { SITE_NAME } from "@/lib/seo";

// The social card every page inherits unless its segment draws its own (a
// Grand Prix does). Static per locale, so it is built once at deploy.

export const alt = "gridscore — Grand Prix predictions and season leaderboard";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "home" });

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "72px 80px 90px",
        background: OG_COLORS.ink,
        backgroundImage: `linear-gradient(${OG_COLORS.line} 1px, transparent 1px), linear-gradient(90deg, ${OG_COLORS.line} 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
        color: OG_COLORS.paper,
        fontFamily: "Archivo Black",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <OgTile size={88} />
        <div style={{ fontSize: 48, letterSpacing: -1 }}>{SITE_NAME}</div>
      </div>
      <div
        style={{
          display: "flex",
          maxWidth: 980,
          fontSize: 92,
          lineHeight: 0.98,
          letterSpacing: -3,
        }}
      >
        {t("headline")}
      </div>
      <OgKerb />
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
