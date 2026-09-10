import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocalTime } from "@/components/local-time";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { listSeasonDrivers } from "@/lib/drivers";
import { getMarketsForGrandsPrix, listSeasonGrandsPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { lockReason } from "@/lib/market-utils";
import type { MarketPick } from "@/lib/markets";
import { formatPick } from "@/lib/pick-format";
import { getMyPickStates } from "@/lib/predictions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "myPicks" });
  return { title: t("title"), description: t("description"), robots: { index: false } };
}

export default async function MyPicksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("myPicks");
  const tm = await getTranslations("markets");
  const tg = await getTranslations("gp");

  const supabase = await createServerSupabaseClient();
  const calendar = await listSeasonGrandsPrix(supabase);
  if (!calendar) return <Shell eyebrow="" title={t("headline")} lede={t("lede")} />;

  const markets = await getMarketsForGrandsPrix(
    calendar.grandsPrix.map((g) => g.id),
    supabase,
  );
  const allIds = [...markets.values()].flat().map((m) => m.id);
  const [picks, drivers] = await Promise.all([
    getMyPickStates(allIds, supabase),
    listSeasonDrivers(calendar.season.id, supabase),
  ]);
  const driverMap = new Map(drivers.map((d) => [d.id, d]));
  const pickLabels = { none: tm("none"), yes: tm("yes"), no: tm("no"), unknown: "?" };
  const now = Date.now();

  const weekends = calendar.grandsPrix
    .map((gp) => {
      const rows = (markets.get(gp.id) ?? [])
        .map((m) => ({ market: m, state: picks.get(m.id) }))
        .filter((r) => r.state?.prediction);
      const points = rows.reduce((sum, r) => sum + (r.state?.score?.points ?? 0), 0);
      return { gp, rows, points };
    })
    .filter((w) => w.rows.length > 0)
    .sort((a, b) => b.gp.round - a.gp.round);

  const total = weekends.reduce((sum, w) => sum + w.points, 0);

  return (
    <Shell
      eyebrow={t("eyebrow", { season: calendar.season.name })}
      title={t("headline")}
      lede={t("lede")}
      aside={
        <div className="rounded-xl border border-signal/30 bg-signal px-4 py-3 text-signal-foreground">
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {t("totalPoints", { points: total })}
          </div>
        </div>
      }
    >
      {weekends.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <Link href={localePath(locale, "/gp")} className={cn(buttonVariants(), "mt-5")}>
            {t("goToCalendar")}
          </Link>
        </div>
      ) : (
        <ol className="grid gap-4">
          {weekends.map(({ gp, rows, points }) => (
            <li key={gp.id} className="rounded-xl border border-border bg-card">
              <Link
                href={localePath(locale, `/gp/${gp.slug}`)}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {tg("roundLabel", { round: gp.round })} ·{" "}
                    <LocalTime iso={gp.race_at} format="date" />
                  </p>
                  <h2 className="truncate font-heading text-base font-semibold tracking-tight">
                    {gp.name}
                  </h2>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {t("weekendPoints", { points })}
                </span>
              </Link>
              <ul className="divide-y divide-border">
                {rows.map(({ market, state }) => {
                  const statusKey =
                    market.status === "resolved" || market.status === "void"
                      ? market.status
                      : lockReason(market, now)
                        ? "locked"
                        : "open";
                  const score = state?.score;
                  return (
                    <li
                      key={market.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[160px_1fr_1fr_auto]"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {tm(`type.${market.type}`)}
                      </span>
                      <span className="sm:order-4">
                        <MarketStatusBadge
                          status={statusKey}
                          label={tm(`status.${statusKey}`)}
                          size="sm"
                        />
                      </span>
                      <span className="col-span-2 text-muted-foreground sm:col-span-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
                          {tm("yourCall")}
                        </span>{" "}
                        <span className="text-foreground">
                          {formatPick(
                            market.type,
                            state?.prediction?.pick as MarketPick,
                            driverMap,
                            pickLabels,
                          )}
                        </span>
                      </span>
                      <span className="col-span-2 text-muted-foreground sm:col-span-1">
                        {market.result ? (
                          <>
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
                              {tm("result")}
                            </span>{" "}
                            <span className="text-foreground">
                              {formatPick(
                                market.type,
                                market.result as MarketPick,
                                driverMap,
                                pickLabels,
                              )}
                            </span>
                            {score ? (
                              <span
                                className={cn(
                                  "ml-2 font-mono text-xs font-semibold tabular-nums",
                                  score.hit_type === "miss"
                                    ? "text-muted-foreground"
                                    : "text-signal",
                                )}
                              >
                                +{score.points}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Shell>
  );
}

function Shell({
  eyebrow,
  title,
  lede,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1
            className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ fontStretch: "condensed" }}
          >
            {title}
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{lede}</p>
        </div>
        {aside}
      </header>
      {children}
    </main>
  );
}
