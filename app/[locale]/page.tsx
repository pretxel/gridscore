import { ArrowRightIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocalTime } from "@/components/local-time";
import { MarketLockCountdown } from "@/components/market-lock-countdown";
import { buttonVariants } from "@/components/ui/button";
import { getMarketsForGrandPrix, listSeasonGrandsPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { nextGrandPrix, nextLockingMarket } from "@/lib/market-utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
  const tp = await getTranslations("pickForm");
  const tc = await getTranslations("common");

  const supabase = await createServerSupabaseClient();
  const [{ data: auth }, calendar] = await Promise.all([
    supabase.auth.getUser(),
    listSeasonGrandsPrix(supabase),
  ]);
  const user = auth.user;
  const now = Date.now();
  const next = calendar ? nextGrandPrix(calendar.grandsPrix, now) : null;
  const nextMarket = next
    ? nextLockingMarket(await getMarketsForGrandPrix(next.id, supabase), now)
    : null;
  const seasonLabel = calendar?.season.name ?? "";

  return (
    <main className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="bg-kerb-stripes absolute -right-32 -top-32 h-[36rem] w-[36rem] -rotate-12 opacity-[0.08] dark:opacity-[0.16]"
        style={{
          maskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
        }}
      />
      <div className="bg-grain pointer-events-none absolute inset-0" />
      <section className="relative mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <p className="rise font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("eyebrow", { season: seasonLabel })}
          </p>
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
              href={localePath(locale, user ? "/gp" : "/sign-in")}
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              {user ? t("ctaCalendar") : t("ctaSignIn")}
              <ArrowRightIcon />
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
        </div>

        <div className="rise" style={{ animationDelay: "240ms" }}>
          {next ? (
            <Link
              href={localePath(locale, `/gp/${next.slug}`)}
              className="block rounded-2xl border border-signal/50 bg-card p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.4)] transition-colors hover:bg-muted/40"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal">
                {t("nextUp")} · {tg("roundLabel", { round: next.round })}
              </p>
              <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
                {next.name}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="size-3.5" aria-hidden />
                {next.circuit_name}
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
                <ArrowRightIcon className="size-4" aria-hidden />
              </span>
            </Link>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              {t("noSeason")}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
