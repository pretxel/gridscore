import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScoringExplainer } from "@/components/scoring-explainer";
import type { MultiplierReason } from "@/lib/db";
import { formatMultiplier } from "@/lib/format";
import { listSeasonGrandsPrix } from "@/lib/grands-prix";
import { DEFAULT_LOCALE, isLocale, type Locale, localeAlternates } from "@/lib/i18n";
import { getScoringRules } from "@/lib/scoring-rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/how-it-works"),
  };
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");
  const tm = await getTranslations("markets");
  const tg = await getTranslations("gp");

  const supabase = await createServerSupabaseClient();
  const calendar = await listSeasonGrandsPrix(supabase);
  const rules = calendar ? await getScoringRules(calendar.season.id, supabase) : {};

  // Multiplier legend derived from the season's weekends: one line per
  // (reason, value) actually in use, with how many weekends carry it.
  const legend = new Map<string, { reason: MultiplierReason; value: number; count: number }>();
  for (const gp of calendar?.grandsPrix ?? []) {
    const value = Number(gp.multiplier);
    const key = `${gp.multiplier_reason}:${value}`;
    const cur = legend.get(key);
    if (cur) cur.count++;
    else legend.set(key, { reason: gp.multiplier_reason, value, count: 1 });
  }
  const legendRows = [...legend.values()].sort((a, b) => a.value - b.value);

  const sections = [
    { title: t("locksTitle"), body: t("locksBody") },
    { title: t("editTitle"), body: t("editBody") },
    { title: t("tiesTitle"), body: t("tiesBody") },
    { title: t("adminTitle"), body: t("adminBody") },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("lede")}</p>
      </header>

      <section className="mb-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{t("marketsTitle")}</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          {calendar ? t("marketsLede", { season: calendar.season.name }) : t("noSeason")}
        </p>
        <ScoringExplainer
          rules={rules}
          labels={{
            market: t("market"),
            locksAt: t("locksAt"),
            points: t("points"),
            typeLabel: (type) => tm(`type.${type}`),
            lockLabel: (session) => tm(`locksAt.${session}`),
            podiumExact: t("podiumExact"),
            podiumIn: t("podiumIn"),
            podiumBonus: t("podiumBonus"),
            exact: t("exact"),
          }}
        />
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {t("multipliersTitle")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("multipliersLede")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {legendRows.map((row) => (
            <li
              key={`${row.reason}-${row.value}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span>
                <span className="font-medium">{tg(`multiplierReason.${row.reason}`)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t("multiplierRounds", { count: row.count })}
                </span>
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {tg("multiplierBadge", { value: formatMultiplier(locale, row.value) })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-heading text-base font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
