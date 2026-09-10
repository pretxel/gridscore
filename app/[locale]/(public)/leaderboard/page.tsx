import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeaderboardLive } from "@/components/leaderboard-live";
import { LeaderboardSegmentSwitcher } from "@/components/leaderboard-segment-switcher";
import type { LeaderboardTableRow } from "@/components/leaderboard-table";
import { listSeasonGrandsPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localeAlternates, localePath } from "@/lib/i18n";
import { getGrandPrixBoard, getOverallBoard } from "@/lib/leaderboard";
import { findOwnRow, parseGrandPrixParam } from "@/lib/leaderboard-segment";
import { grandPrixPhase } from "@/lib/market-utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const TOP_N = 50;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "leaderboard" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/leaderboard"),
  };
}

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ gp?: string | string[] }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const { gp: gpParam } = await searchParams;
  const t = await getTranslations("leaderboard");
  const tg = await getTranslations("gp");

  const supabase = await createServerSupabaseClient();
  const [calendar, { data: auth }] = await Promise.all([
    listSeasonGrandsPrix(supabase),
    supabase.auth.getUser(),
  ]);
  const user = auth.user;
  const now = Date.now();

  // Only weekends that can have points are selectable.
  const scoredGps = (calendar?.grandsPrix ?? []).filter(
    (g) => grandPrixPhase(g, now) === "completed" || grandPrixPhase(g, now) === "weekend",
  );
  const segment = parseGrandPrixParam(
    gpParam,
    scoredGps.map((g) => g.slug),
  );
  const activeGp =
    segment.kind === "grand_prix" ? (scoredGps.find((g) => g.slug === segment.slug) ?? null) : null;

  const board = activeGp
    ? await getGrandPrixBoard(activeGp.id, supabase)
    : await getOverallBoard(supabase);
  if (board.error) console.error("[leaderboard] load failed:", board.error);
  const rows = board.rows as LeaderboardTableRow[];
  const top = rows.slice(0, TOP_N);
  const own = findOwnRow(rows, user?.id ?? null);
  const leader = rows[0];

  const labels = {
    rank: t("headerRank"),
    player: t("headerPlayer"),
    points: t("headerPoints"),
    podiums: t("headerPodiums"),
    podiumsHint: t("headerPodiumsHint"),
    exact: t("headerExact"),
    exactHint: t("headerExactHint"),
    scored: t("headerScored"),
    scoredHint: t("headerScoredHint"),
    you: t("you"),
    noName: t("noName"),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("eyebrow", { season: calendar?.season.name ?? "" })}
            {activeGp ? ` · ${tg("roundLabel", { round: activeGp.round })}` : ""}
          </p>
          <h1
            className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ fontStretch: "condensed" }}
          >
            {activeGp ? activeGp.name : t("headline")}
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("lede")}</p>
        </div>
        {leader ? (
          <div className="rounded-xl border border-signal/30 bg-signal px-4 py-3 text-signal-foreground">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
              {t("leaderLabel")}
            </div>
            <div className="mt-1 font-heading text-lg font-semibold tracking-tight">
              {leader.display_name ?? t("noName")}
            </div>
            <div className="mt-0.5 font-mono text-xs uppercase tracking-[0.18em] opacity-80">
              {t("leaderStat", { points: leader.total_points, count: rows.length })}
            </div>
          </div>
        ) : null}
      </header>

      <LeaderboardSegmentSwitcher
        basePath={localePath(locale, "/leaderboard")}
        activeSlug={activeGp?.slug ?? null}
        options={scoredGps.map((g) => ({
          slug: g.slug,
          label: `${tg("roundLabel", { round: g.round })} · ${g.name}`,
        }))}
        labels={{
          overall: t("segmentOverall"),
          grandPrix: t("segmentGrandPrix"),
          select: t("selectGrandPrix"),
        }}
      />

      {board.error ? (
        <div
          role="alert"
          className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center"
        >
          <p className="text-base font-semibold">{t("loadFailedTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("loadFailedBody")}</p>
          <a
            href={localePath(locale, "/leaderboard")}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            {t("retry")}
          </a>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <>
          <LeaderboardLive
            initialRows={top}
            source={activeGp ? { kind: "grand_prix", gpId: activeGp.id } : { kind: "overall" }}
            currentUserId={user?.id ?? null}
            labels={labels}
            limit={TOP_N}
          />
          {user ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {own
                ? `${t("yourRank")}: #${own.rank} · ${own.total_points} ${t("headerPoints").toLowerCase()}`
                : t("notRanked")}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("liveHint")}
          </p>
        </>
      )}
    </main>
  );
}
