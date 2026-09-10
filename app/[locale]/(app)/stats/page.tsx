import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatPoints } from "@/lib/format";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { hasFeature } from "@/lib/plans";
import {
  accuracy,
  bestStreak,
  bestWeekend,
  currentStreak,
  deltaVsAverage,
  formatAccuracy,
  strongestMarket,
  totals,
} from "@/lib/stats";
import { getUserStats } from "@/lib/user-stats";
import { getViewer } from "@/lib/viewer";
import { StatsLocked } from "./stats-locked";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stats" });
  return { title: t("title"), description: t("description"), robots: { index: false } };
}

export default async function StatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("stats");
  const tm = await getTranslations("markets");

  const viewer = await getViewer();
  if (!viewer.userId) redirect(localePath(locale, "/sign-in"));

  const stats = await getUserStats(viewer.userId);
  const totalsRow = totals(stats.markets);
  const unlocked = hasFeature(viewer.plan, "premiumStats");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("lede")}</p>
      </header>

      {!unlocked ? (
        <StatsLocked totalPoints={totalsRow.points} />
      ) : totalsRow.scored === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="grid gap-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label={t("metric.accuracy")}
              value={formatAccuracy(accuracy(totalsRow), locale)}
              hint={t("hint.accuracy", { hits: totalsRow.hits, scored: totalsRow.scored })}
            />
            <Metric
              label={t("metric.points")}
              value={formatPoints(locale, totalsRow.points)}
              hint={t("hint.points", { count: stats.weekends.length })}
            />
            <Metric
              label={t("metric.streak")}
              value={String(currentStreak(stats.weekends))}
              hint={t("hint.streak", { best: bestStreak(stats.weekends) })}
            />
            <Metric
              label={t("metric.vsField")}
              value={signed(deltaVsAverage(totalsRow.points, stats.averagePoints), locale)}
              hint={t("hint.vsField", {
                average: formatPoints(locale, Math.round(stats.averagePoints)),
              })}
            />
          </dl>

          <section aria-labelledby="by-market">
            <h2 id="by-market" className="mb-3 font-heading text-lg font-semibold">
              {t("byMarketTitle")}
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">
                      {t("colMarket")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t("colScored")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t("colHits")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t("colAccuracy")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t("colPoints")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.markets.map((stat) => (
                    <tr key={stat.marketType} className="tabular-nums">
                      <td className="px-4 py-2.5 font-medium">{tm(`type.${stat.marketType}`)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{stat.scored}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{stat.hits}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {formatAccuracy(accuracy(stat), locale)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        {formatPoints(locale, stat.points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="highlights" className="grid gap-2 sm:grid-cols-2">
            <h2 id="highlights" className="sr-only">
              {t("highlightsTitle")}
            </h2>
            <Highlight
              label={t("bestWeekend")}
              value={
                bestWeekend(stats.weekends)
                  ? `${bestWeekend(stats.weekends)?.name} · ${formatPoints(
                      locale,
                      bestWeekend(stats.weekends)?.points ?? 0,
                    )}`
                  : "—"
              }
            />
            <Highlight
              label={t("strongestMarket")}
              value={
                strongestMarket(stats.markets)
                  ? tm(`type.${strongestMarket(stats.markets)?.marketType}`)
                  : t("notEnoughData")
              }
            />
          </section>
        </div>
      )}
    </main>
  );
}

// Always shows a sign so "ahead of the field" reads at a glance.
function signed(value: number, locale: Locale): string {
  const formatted = formatPoints(locale, Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</dd>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
