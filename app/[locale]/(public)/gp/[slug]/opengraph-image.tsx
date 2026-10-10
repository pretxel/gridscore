import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { tracePath } from "@/lib/circuit-trace";
import { CIRCUIT_LAYOUT_VIEWBOX, circuitLayout } from "@/lib/circuits/layouts";
import { getGrandPrixBySlug } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { OG_COLORS, OG_SIZE, OgKerb, OgTile, ogFonts } from "@/lib/og/brand";
import { SITE_NAME } from "@/lib/seo";

// A Grand Prix's social card: its name, round and race date beside the
// circuit outline the page itself draws.

export const alt = "Grand Prix on gridscore";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "gp" });
  const found = await getGrandPrixBySlug(slug);
  const gp = found?.grandPrix;
  const d = gp
    ? (circuitLayout(gp.circuit_key || gp.slug) ?? tracePath(gp.circuit_key || gp.slug))
    : null;
  const raceDate = gp
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(gp.race_at))
    : "";

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        padding: "72px 80px 90px",
        background: OG_COLORS.ink,
        color: OG_COLORS.paper,
        fontFamily: "Archivo Black",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <OgTile size={64} />
          <div style={{ fontSize: 36, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        {gp ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
            <div style={{ fontSize: 30, color: OG_COLORS.signal }}>
              {t("roundLabel", { round: gp.round })}
            </div>
            <div style={{ fontSize: 76, lineHeight: 1, letterSpacing: -2.5 }}>{gp.name}</div>
            <div style={{ fontSize: 26, color: OG_COLORS.muted }}>
              {`${gp.circuit_name}, ${raceDate}`}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 76, letterSpacing: -2.5 }}>{t("title")}</div>
        )}
      </div>
      {d ? (
        <svg
          width="420"
          height="420"
          viewBox={`0 0 ${CIRCUIT_LAYOUT_VIEWBOX} ${CIRCUIT_LAYOUT_VIEWBOX}`}
          style={{ alignSelf: "center" }}
        >
          <path
            d={d}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={d}
            fill="none"
            stroke={OG_COLORS.signal}
            strokeWidth="2.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      <OgKerb />
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
