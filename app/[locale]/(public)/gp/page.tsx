import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GrandPrixCard, type GrandPrixCardLabels } from "@/components/grand-prix-card";
import { formatMultiplier } from "@/lib/format";
import { getMarketsForGrandsPrix, listSeasonGrandsPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localeAlternates, localePath } from "@/lib/i18n";
import { grandPrixPhase, marketsNeedingPick, nextGrandPrix } from "@/lib/market-utils";
import { getMyPickStates } from "@/lib/predictions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "gp" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/gp"),
  };
}

export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("gp");

  const supabase = await createServerSupabaseClient();
  const calendar = await listSeasonGrandsPrix(supabase);
  const now = Date.now();

  if (!calendar) return <Empty title={t("headline")} body={t("noSeason")} />;
  if (calendar.grandsPrix.length === 0) {
    return <Empty title={t("headline")} body={t("empty")} />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Per-weekend call counts for the signed-in visitor (upcoming weekends only).
  const openGps = calendar.grandsPrix.filter((g) => grandPrixPhase(g, now) !== "completed");
  const markets = await getMarketsForGrandsPrix(
    openGps.map((g) => g.id),
    supabase,
  );
  const allMarketIds = [...markets.values()].flat().map((m) => m.id);
  const picks = user ? await getMyPickStates(allMarketIds, supabase) : new Map();
  const pickedIds = new Set(picks.keys());

  const next = nextGrandPrix(calendar.grandsPrix, now);

  const labelsFor = (gp: (typeof calendar.grandsPrix)[number]): GrandPrixCardLabels => {
    const phase = grandPrixPhase(gp, now);
    const gpMarkets = markets.get(gp.id) ?? [];
    const open = gpMarkets.filter((m) => m.status === "open" && Date.parse(m.locks_at) > now);
    let calls: string | null = null;
    if (phase !== "completed" && phase !== "cancelled") {
      if (user) {
        const missing = marketsNeedingPick(gpMarkets, pickedIds, now).length;
        calls =
          open.length === 0
            ? null
            : missing === 0
              ? t("allCallsMade")
              : t("callsMissing", { count: missing });
      } else {
        calls = t("callsOpen", { count: open.length });
      }
    }
    return {
      round: t("roundLabel", { round: gp.round }),
      sprint: t("sprintBadge"),
      multiplier: t("multiplierBadge", { value: formatMultiplier(locale, Number(gp.multiplier)) }),
      multiplierReason: t(`multiplierReason.${gp.multiplier_reason}`),
      phase: t(`phase.${phase}`),
      calls,
      open: t("viewWeekend"),
    };
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow", { season: calendar.season.name })}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("lede")}</p>
      </header>

      {next ? (
        <section className="mb-8">
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("nextUp")}
          </h2>
          <GrandPrixCard
            grandPrix={next}
            href={localePath(locale, `/gp/${next.slug}`)}
            phase={grandPrixPhase(next, now)}
            labels={labelsFor(next)}
            highlight
          />
        </section>
      ) : null}

      <ol className="grid gap-3 [&>li]:min-w-0">
        {calendar.grandsPrix.map((gp) => (
          <li key={gp.id}>
            <GrandPrixCard
              grandPrix={gp}
              href={localePath(locale, `/gp/${gp.slug}`)}
              phase={grandPrixPhase(gp, now)}
              labels={labelsFor(gp)}
            />
          </li>
        ))}
      </ol>
    </main>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-heading text-4xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        {body}
      </div>
    </main>
  );
}
