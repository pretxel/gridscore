import { ArrowRightIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CircuitTrace } from "@/components/circuit-trace";
import { JsonLd } from "@/components/json-ld";
import { LocalTime } from "@/components/local-time";
import { MarketLockCountdown } from "@/components/market-lock-countdown";
import { Reveal } from "@/components/reveal";
import { StartingLights } from "@/components/starting-lights";
import { buttonVariants } from "@/components/ui/button";
import { env } from "@/lib/env";
import { formatPoints } from "@/lib/format";
import { getMarketsForGrandPrix, listSeasonGrandsPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { getOverallBoard } from "@/lib/leaderboard";
import { nextGrandPrix, nextLockingMarket } from "@/lib/market-utils";
import { type LockSession, MARKET_LOCK_SESSION, MARKET_TYPES } from "@/lib/markets";
import { pageMetadata } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const TOP_N = 5;

// The order a weekend locks in: each market closes at its own session.
const LOCK_ORDER: readonly LockSession[] = ["qualifying", "sprint", "race"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "siteMeta" });
  return pageMetadata(locale, "/", {
    title: t("title"),
    description: t("description"),
    absoluteTitle: true,
    ownImage: true,
  });
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
  const ts = await getTranslations("siteMeta");

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
  const leaderPoints = leaders[0]?.total_points ?? 0;
  // The sessions a call can lock at, as this weekend schedules them.
  const nextSessions = next
    ? (
        [
          ["qualifying", next.qualifying_at],
          ["sprint", next.has_sprint ? next.sprint_at : null],
          ["race", next.race_at],
        ] as const
      ).filter((entry): entry is readonly [LockSession, string] => Boolean(entry[1]))
    : [];
  const startHref = localePath(locale, user ? "/gp" : "/sign-in");
  const site = env.siteUrl.replace(/\/$/, "");
  // Who publishes the site and what it is, for search engines.
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: "gridscore",
        url: site,
        logo: `${site}/icon-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        name: "gridscore",
        url: `${site}${localePath(locale, "/")}`,
        inLanguage: locale,
        description: ts("description"),
        publisher: { "@id": `${site}/#organization` },
      },
    ],
  };

  return (
    <main className="relative isolate overflow-hidden">
      <JsonLd data={siteJsonLd} />
      {/* Hero backdrop: a timing-screen grid fading out under film grain. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] [mask-image:linear-gradient(black_65%,transparent)]"
      >
        <div className="bg-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(90%_70%_at_30%_0%,black,transparent)]" />
        <div className="bg-grain absolute inset-0" />
      </div>

      <section className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-16 sm:pt-20 sm:pb-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-col gap-7">
          <div className="rise flex flex-wrap items-center gap-3">
            <StartingLights label={t("lightsLabel")} />
            {seasonLabel ? (
              <p className="font-heading text-sm text-muted-foreground">
                {t("eyebrow", { season: seasonLabel })}
              </p>
            ) : null}
          </div>
          <h1
            className="rise font-heading text-[2.75rem] leading-[0.95] tracking-[-0.035em] text-balance sm:text-7xl lg:text-[4.5rem] xl:text-[5rem]"
            style={{ animationDelay: "60ms" }}
          >
            {t("headline")}
          </h1>
          <p
            className="rise max-w-[34rem] text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "120ms" }}
          >
            {t("lede")}
          </p>
          <div
            className="rise flex flex-wrap items-center gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              href={startHref}
              className={cn(
                buttonVariants({ size: "lg" }),
                "group/cta h-12 gap-2 px-6 text-base transition-transform hover:-translate-y-0.5",
              )}
            >
              {user ? t("ctaCalendar") : t("ctaSignIn")}
              <ArrowRightIcon className="transition-transform group-hover/cta:translate-x-0.5" />
            </Link>
            {!user ? (
              <Link
                href={localePath(locale, "/gp")}
                className={cn(
                  buttonVariants({ size: "lg", variant: "ghost" }),
                  "h-12 px-4 text-base underline-offset-4 hover:underline",
                )}
              >
                {t("ctaCalendar")}
              </Link>
            ) : null}
          </div>
          {rounds > 0 ? (
            <dl
              className="rise flex flex-wrap gap-x-8 gap-y-2 border-t border-border/60 pt-5 text-sm text-muted-foreground"
              style={{ animationDelay: "240ms" }}
            >
              <div className="flex items-baseline gap-2">
                <dt className="sr-only">{t("statRoundsLabel")}</dt>
                <dd className="font-heading text-3xl tabular-nums text-foreground">{rounds}</dd>
                <span>{t("statRounds")}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="sr-only">{t("statMarketsLabel")}</dt>
                <dd className="font-heading text-3xl tabular-nums text-foreground">
                  {MARKET_TYPES.length}
                </dd>
                <span>{t("statMarkets")}</span>
              </div>
            </dl>
          ) : null}
        </div>

        {/* The next weekend as a pit-wall screen: its circuit, its sessions,
            and the clock on the next call. */}
        <div className="rise min-w-0" style={{ animationDelay: "200ms" }}>
          {next ? (
            <Link
              href={localePath(locale, `/gp/${next.slug}`)}
              className="group/next relative block overflow-hidden rounded-3xl border border-border bg-card/80 shadow-[0_40px_80px_-48px_color-mix(in_oklab,var(--signal)_70%,transparent)] backdrop-blur-sm transition-colors hover:border-signal/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-6">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-signal">
                    {t("nextUp")}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {tg("roundLabel", { round: next.round })}
                    </span>
                  </p>
                  <h2 className="mt-1 font-heading text-2xl leading-tight tracking-tight sm:text-3xl">
                    {next.name}
                  </h2>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{next.circuit_name}</span>
                  </p>
                </div>
              </div>

              <div className="relative mx-auto aspect-[4/3] w-full max-w-md px-8 py-4">
                <CircuitTrace
                  seed={next.circuit_key || next.slug}
                  animated
                  className="size-full text-foreground"
                />
              </div>

              {nextSessions.length > 0 ? (
                <dl
                  aria-label={t("weekendLabel")}
                  className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] border-t border-border"
                >
                  {nextSessions.map(([session, at]) => (
                    <div key={session} className="border-border px-6 py-3 not-first:border-l">
                      <dt className="text-xs text-muted-foreground">{tg(`session.${session}`)}</dt>
                      <dd className="mt-0.5 font-mono text-xs tabular-nums">
                        <LocalTime iso={at} format="datetime" />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4">
                {nextMarket ? (
                  <div className="min-w-0">
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
                      className="mt-0.5 text-sm"
                    />
                  </div>
                ) : (
                  <span />
                )}
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-signal">
                  {t("openWeekend")}
                  <ArrowRightIcon
                    className="size-4 transition-transform group-hover/next:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>
            </Link>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
              {t("noSeason")}
            </div>
          )}
        </div>
      </section>

      <div aria-hidden className="kerb-scroll h-1.5 w-full opacity-70" />

      {/* What a weekend asks of you, laid out along the sessions that lock it. */}
      <Reveal as="section" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl tracking-tight sm:text-5xl">{t("marketsTitle")}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t("marketsLede")}</p>
        </div>
        <ol className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr_2fr] lg:gap-0 [&>li]:min-w-0">
          {LOCK_ORDER.map((session) => {
            const types = MARKET_TYPES.filter((type) => MARKET_LOCK_SESSION[type] === session);
            return (
              <li key={session} className="relative lg:pr-8">
                {/* One continuous track runs under the three sessions. */}
                <div aria-hidden className="flex items-center">
                  <span
                    className={cn(
                      "size-3 shrink-0 rounded-full ring-4 ring-background",
                      session === "race" ? "bg-signal" : "bg-foreground",
                    )}
                  />
                  <span className="h-px flex-1 bg-border lg:-mr-8" />
                </div>
                <h3 className="mt-4 font-heading text-lg">{tm(`locksAt.${session}`)}</h3>
                {session === "sprint" ? (
                  <p className="mt-0.5 text-xs text-flag">{t("sprintOnly")}</p>
                ) : null}
                <ul
                  className={cn(
                    "mt-5 grid gap-x-8 gap-y-5",
                    session === "race" && "sm:grid-cols-2",
                  )}
                >
                  {types.map((type) => (
                    <li key={type} className="border-l-2 border-signal/60 pl-4">
                      <p className="font-semibold">{tm(`type.${type}`)}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {tm(`hint.${type}`)}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </Reveal>

      {/* Three steps, in the order they happen. */}
      <Reveal as="section" className="border-y border-border bg-muted/25">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <h2 className="font-heading text-3xl tracking-tight sm:text-5xl">{t("stepsTitle")}</h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 [&>li]:min-w-0">
            {(["call", "lock", "score"] as const).map((step, index) => (
              <li key={step} className="border-t-2 border-foreground/80 pt-5">
                <span className="font-heading text-5xl leading-none text-signal tabular-nums">
                  {index + 1}
                </span>
                <p className="mt-4 font-heading text-xl tracking-tight">
                  {t(`step.${step}.title` as never)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`step.${step}.body` as never)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* Who is winning, from the real board, set like a timing tower. */}
      {leaders.length > 0 ? (
        <Reveal
          as="section"
          className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:py-28 lg:grid-cols-[1fr_1.3fr] lg:items-start"
        >
          <div>
            <h2 className="font-heading text-3xl tracking-tight sm:text-5xl">{t("boardTitle")}</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              {t("boardLede")}
            </p>
            <Link
              href={localePath(locale, "/leaderboard")}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-signal underline-offset-4 hover:underline"
            >
              {t("boardCta")}
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          <ol className="overflow-hidden rounded-2xl border border-border bg-card [&>li]:min-w-0">
            {leaders.map((row, index) => {
              const points = row.total_points ?? 0;
              return (
                <li
                  key={row.user_id}
                  className="flex items-center gap-4 border-border px-4 py-3.5 not-first:border-t sm:px-5"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-heading text-base tabular-nums",
                      index === 0 ? "bg-signal text-signal-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {row.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {row.display_name ?? tl("noName")}
                  </span>
                  <span className="hidden w-24 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums sm:block">
                    {index === 0 ? (
                      t("boardLeader")
                    ) : (
                      <>
                        <span className="sr-only">{t("boardGapLabel")}: </span>
                        {t("boardGap", { points: formatPoints(locale, leaderPoints - points) })}
                      </>
                    )}
                  </span>
                  <span className="w-14 shrink-0 text-right font-heading text-lg tabular-nums">
                    {formatPoints(locale, points)}
                  </span>
                </li>
              );
            })}
          </ol>
        </Reveal>
      ) : null}

      {/* Closing call to action. */}
      <Reveal as="section" className="relative isolate overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="bg-kerb-stripes absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.12]"
        />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:py-28">
          <StartingLights label={t("lightsLabel")} />
          <h2 className="max-w-3xl font-heading text-4xl leading-[1.02] tracking-tight text-balance sm:text-6xl">
            {t("finalTitle")}
          </h2>
          <p className="max-w-xl text-base text-muted-foreground">{t("finalLede")}</p>
          <Link
            href={startHref}
            className={cn(
              buttonVariants({ size: "lg" }),
              "group/final h-12 gap-2 px-6 text-base transition-transform hover:-translate-y-0.5",
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
