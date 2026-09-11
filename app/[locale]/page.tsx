import { ArrowRightIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocalTime } from "@/components/local-time";
import { MarketLockCountdown } from "@/components/market-lock-countdown";
import { Reveal } from "@/components/reveal";
import { StartingLights } from "@/components/starting-lights";
import { buttonVariants } from "@/components/ui/button";
import { formatPoints } from "@/lib/format";
import { getMarketsForGrandPrix, listSeasonGrandsPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { getOverallBoard } from "@/lib/leaderboard";
import { nextGrandPrix, nextLockingMarket } from "@/lib/market-utils";
import { MARKET_TYPES } from "@/lib/markets";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const TOP_N = 3;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "siteMeta" });
  return { title: t("title"), description: t("description") };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tg = await getTranslations("gp");
  const tm = await getTranslations("markets");
  const tp = await getTranslations("pickForm");
  const tc = await getTranslations("common");
  const tl = await getTranslations("leaderboard");

  const supabase = await createServerSupabaseClient();
  const [{ data: auth }, calendar, board] = await Promise.all([
    supabase.auth.getUser(),
    listSeasonGrandsPrix(supabase),
    getOverallBoard(supabase),
  ]);
  const user = auth.user;
  const now = Date.now();
  const next = calendar ? nextGrandPrix(calendar.grandsPrix, now) : null;
  const nextMarket = next
    ? nextLockingMarket(await getMarketsForGrandPrix(next.id, supabase), now)
    : null;
  const seasonLabel = calendar?.season.name ?? "";
  const rounds = calendar?.grandsPrix.length ?? 0;
  const leaders = board.error ? [] : board.rows.slice(0, TOP_N);
  const startHref = localePath(locale, user ? "/gp" : "/sign-in");

  return (
    <main className="relative isolate overflow-hidden">
      {/* Hero backdrop: a timing-screen grid, a kerb sweep and film grain. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]">
        <div className="bg-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(80%_60%_at_50%_0%,black,transparent)]" />
        <div className="bg-kerb-stripes absolute -right-40 -top-40 h-[38rem] w-[38rem] -rotate-12 opacity-[0.10] dark:opacity-[0.18] [mask-image:radial-gradient(closest-side_at_50%_50%,black_30%,transparent_75%)]" />
        <div className="bg-grain absolute inset-0" />
      </div>

      <section className="relative mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <div className="rise flex flex-wrap items-center gap-3">
            <StartingLights label={t("lightsLabel")} />
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {t("eyebrow", { season: seasonLabel })}
            </p>
          </div>
          <h1
            className="rise font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl"
            style={{ animationDelay: "60ms", fontStretch: "condensed" }}
          >
            {t("headline")}
          </h1>
          <p
            className="rise max-w-xl text-base leading-relaxed text-muted-foreground"
            style={{ animationDelay: "120ms" }}
          >
            {t("lede")}
          </p>
          <div className="rise flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
            <Link
              href={startHref}
              className={cn(
                buttonVariants({ size: "lg" }),
                "group/cta gap-2 transition-transform hover:-translate-y-0.5",
              )}
            >
              {user ? t("ctaCalendar") : t("ctaSignIn")}
              <ArrowRightIcon className="transition-transform group-hover/cta:translate-x-0.5" />
            </Link>
            {!user ? (
              <Link
                href={localePath(locale, "/gp")}
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                {t("ctaCalendar")}
              </Link>
            ) : null}
          </div>
          {rounds > 0 ? (
            <dl
              className="rise flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              style={{ animationDelay: "240ms" }}
            >
              <div className="flex items-baseline gap-1.5">
                <dt className="sr-only">{t("statRoundsLabel")}</dt>
                <dd className="text-base font-semibold text-foreground">{rounds}</dd>
                <span>{t("statRounds")}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="sr-only">{t("statMarketsLabel")}</dt>
                <dd className="text-base font-semibold text-foreground">{MARKET_TYPES.length}</dd>
                <span>{t("statMarkets")}</span>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="rise" style={{ animationDelay: "300ms" }}>
          {next ? (
            <Link
              href={localePath(locale, `/gp/${next.slug}`)}
              className="group/next block rounded-2xl border border-signal/50 bg-card p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-1 hover:border-signal hover:shadow-[0_28px_70px_-32px_rgba(0,0,0,0.55)]"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal">
                {t("nextUp")} · {tg("roundLabel", { round: next.round })}
              </p>
              <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
                {next.name}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{next.circuit_name}</span>
              </p>
              <p className="mt-3 font-mono text-xs tabular-nums text-muted-foreground">
                <LocalTime iso={next.race_at} format="datetime" />
              </p>
              {nextMarket ? (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">{t("nextLockLabel")}</p>
                  <MarketLockCountdown
                    locksAt={nextMarket.locks_at}
                    units={{
                      days: tc("units.days"),
                      hours: tc("units.hours"),
                      mins: tc("units.mins"),
                      secs: tc("units.secs"),
                    }}
                    closesInTemplate={tp.raw("closesIn")}
                    lockedLabel={tp("lockedLabel")}
                    className="mt-1 text-sm"
                  />
                </div>
              ) : null}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                {t("openWeekend")}
                <ArrowRightIcon
                  className="size-4 transition-transform group-hover/next:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              {t("noSeason")}
            </div>
          )}
        </div>
      </section>

      <div aria-hidden className="kerb-scroll h-1.5 w-full opacity-70" />

      {/* What a weekend asks of you. */}
      <Reveal as="section" className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("marketsTitle")}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("marketsLede")}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>li]:min-w-0">
          {MARKET_TYPES.map((type, index) => (
            <Reveal
              as="li"
              key={type}
              delayMs={index * 60}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-signal/50 hover:bg-muted/40"
            >
              <p className="font-heading text-base font-semibold">{tm(`type.${type}`)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tm(`hint.${type}`)}</p>
            </Reveal>
          ))}
        </ul>
      </Reveal>

      {/* Three steps, in the order they happen. */}
      <Reveal as="section" className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("stepsTitle")}
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3 [&>li]:min-w-0">
            {(["call", "lock", "score"] as const).map((step, index) => (
              <Reveal
                as="li"
                key={step}
                delayMs={index * 90}
                className="relative rounded-xl border border-border bg-card p-5"
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-signal">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 font-heading text-lg font-semibold tracking-tight">
                  {t(`step.${step}.title` as never)}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`step.${step}.body` as never)}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* Who is winning, from the real board. */}
      {leaders.length > 0 ? (
        <Reveal as="section" className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("boardTitle")}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("boardLede")}</p>
            </div>
            <Link
              href={localePath(locale, "/leaderboard")}
              className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              {t("boardCta")}
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          <ol className="mt-6 grid gap-2 [&>li]:min-w-0">
            {leaders.map((row, index) => (
              <Reveal
                as="li"
                key={row.user_id}
                delayMs={index * 80}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-semibold tabular-nums",
                    index === 0
                      ? "bg-signal text-signal-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {row.display_name ?? tl("noName")}
                </span>
                <span className="shrink-0 font-mono font-semibold tabular-nums">
                  {formatPoints(locale, row.total_points ?? 0)}
                </span>
              </Reveal>
            ))}
          </ol>
        </Reveal>
      ) : null}

      {/* Closing call to action. */}
      <Reveal as="section" className="relative isolate overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="bg-kerb-stripes absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.12]"
        />
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-4 py-16 sm:py-20">
          <h2 className="max-w-2xl font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t("finalTitle")}
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">{t("finalLede")}</p>
          <Link
            href={startHref}
            className={cn(
              buttonVariants({ size: "lg" }),
              "group/final gap-2 transition-transform hover:-translate-y-0.5",
            )}
          >
            {user ? t("ctaCalendar") : t("ctaSignIn")}
            <ArrowRightIcon className="transition-transform group-hover/final:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
