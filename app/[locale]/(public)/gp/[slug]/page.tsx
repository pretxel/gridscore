import { ArrowLeftIcon, MapPinIcon, ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketLockCountdown } from "@/components/market-lock-countdown";
import { SessionSchedule } from "@/components/session-schedule";
import { isCurrentUserAdmin } from "@/lib/admin/current-user";
import type { HitType } from "@/lib/db";
import { listSeasonDrivers } from "@/lib/drivers";
import { getGrandPrixBySlug, getMarketsForGrandPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { grandPrixPhase, nextLockingMarket } from "@/lib/market-utils";
import type { MarketPick } from "@/lib/markets";
import { getMyPickStates } from "@/lib/predictions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatMultiplier } from "../page";
import { MarketForm } from "./market-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "gp" });
  const found = await getGrandPrixBySlug(slug);
  if (!found) return { title: t("title") };
  return {
    title: found.grandPrix.name,
    description: `${found.grandPrix.circuit_name} · ${t("roundLabel", { round: found.grandPrix.round })}`,
    alternates: { canonical: `/gp/${slug}` },
  };
}

export default async function GrandPrixPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("gp");
  const tc = await getTranslations("common");
  const tp = await getTranslations("pickForm");

  const supabase = await createServerSupabaseClient();
  const found = await getGrandPrixBySlug(slug, supabase);
  if (!found) notFound();
  const { season, grandPrix } = found;

  const [markets, drivers, { data: auth }] = await Promise.all([
    getMarketsForGrandPrix(grandPrix.id, supabase),
    listSeasonDrivers(season.id, supabase),
    supabase.auth.getUser(),
  ]);
  const user = auth.user;
  const isAdmin = user ? await isCurrentUserAdmin(supabase) : false;
  const picks = user
    ? await getMyPickStates(
        markets.map((m) => m.id),
        supabase,
      )
    : new Map();

  // Opportunistic status refresh: flips overdue markets to locked after the
  // response is sent. The lock itself does not depend on this.
  const now = Date.now();
  if (markets.some((m) => m.status === "open" && Date.parse(m.locks_at) <= now)) {
    after(async () => {
      const admin = await createServerSupabaseClient();
      await admin.rpc("lock_due_markets");
    });
  }

  const phase = grandPrixPhase(grandPrix, now);
  const next = nextLockingMarket(markets, now);
  const place = [grandPrix.locality, grandPrix.country].filter(Boolean).join(", ");
  const units = {
    days: tc("units.days"),
    hours: tc("units.hours"),
    mins: tc("units.mins"),
    secs: tc("units.secs"),
  };
  const sessionLabels = {
    fp1: t("session.fp1"),
    fp2: t("session.fp2"),
    fp3: t("session.fp3"),
    sprintQualifying: t("session.sprintQualifying"),
    sprint: t("session.sprint"),
    qualifying: t("session.qualifying"),
    race: t("session.race"),
  };
  const signInHref = `${localePath(locale, "/sign-in")}?next=${encodeURIComponent(localePath(locale, `/gp/${slug}`))}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={localePath(locale, "/gp")}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden />
        {t("backToCalendar")}
      </Link>

      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {season.name} · {t("roundLabel", { round: grandPrix.round })}
          </p>
          <h1
            className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ fontStretch: "condensed" }}
          >
            {grandPrix.name}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
            {grandPrix.circuit_name}
            {place ? ` · ${place}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-semibold tracking-[0.1em]",
              Number(grandPrix.multiplier) > 1
                ? "bg-flag text-flag-foreground"
                : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
            )}
          >
            <ZapIcon className="size-4" aria-hidden />
            {t("multiplierBadge", { value: formatMultiplier(grandPrix.multiplier) })}
            <span className="font-sans text-xs font-normal tracking-normal opacity-80">
              {t(`multiplierReason.${grandPrix.multiplier_reason}`)}
            </span>
          </span>
          {next ? (
            <MarketLockCountdown
              locksAt={next.locks_at}
              units={units}
              closesInTemplate={tp.raw("closesIn")}
              lockedLabel={tp("lockedLabel")}
            />
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t(`phase.${phase}`)}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">{t("markets")}</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("marketsLede")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {markets.map((m) => {
              const state = picks.get(m.id);
              return (
                <MarketForm
                  key={m.id}
                  market={{
                    id: m.id,
                    type: m.type,
                    locksAt: m.locks_at,
                    status: m.status,
                    result: (m.result as MarketPick | null) ?? null,
                  }}
                  slug={slug}
                  drivers={drivers}
                  initial={(state?.prediction?.pick as MarketPick | null) ?? null}
                  score={
                    state?.score
                      ? { points: state.score.points, hitType: state.score.hit_type as HitType }
                      : null
                  }
                  signedIn={!!user}
                  isAdmin={isAdmin}
                  signInHref={signInHref}
                />
              );
            })}
          </div>
        </section>

        <aside>
          <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("sessions")}
          </h2>
          <SessionSchedule grandPrix={grandPrix} labels={sessionLabels} now={now} />
        </aside>
      </div>
    </main>
  );
}
