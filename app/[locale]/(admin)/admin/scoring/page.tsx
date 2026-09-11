import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminActionFeedback, feedbackFrom } from "@/components/admin/action-feedback";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FormSection } from "@/components/admin/form-section";
import { SubmitButton } from "@/components/admin/submit-button";
import { Input } from "@/components/ui/input";
import { getManagedSeason } from "@/lib/admin/managed-season";
import { listScoringRules } from "@/lib/admin/queries";
import type { ScoringRuleKey } from "@/lib/db";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { MARKET_TYPES, type MarketType } from "@/lib/markets";
import { saveScoringRule } from "./actions";

// Which rule keys each market type uses; the podium is the only one scored per
// position, with a bonus on top.
const RULE_KEYS: Record<MarketType, ScoringRuleKey[]> = {
  pole: ["exact"],
  fastest_lap: ["exact"],
  first_retirement: ["exact"],
  safety_car: ["exact"],
  sprint_winner: ["exact"],
  podium: ["exact_position", "in_podium", "all_exact_bonus"],
};

export default async function AdminScoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const feedback = feedbackFrom(await searchParams);
  const t = await getTranslations("admin");
  const tm = await getTranslations("markets");

  const managed = await getManagedSeason();
  if (!managed) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <AdminPageHeader eyebrow={t("nav.scoring")} title={t("scoring.title")} />
        <EmptyState title={t("grandsPrix.noSeason")} className="mt-8" />
      </main>
    );
  }

  const rules = await listScoringRules(managed.season.id);
  const points = new Map(rules.map((r) => [`${r.marketType}:${r.ruleKey}`, r.points]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="admin-reveal space-y-6">
        <AdminPageHeader
          eyebrow={t("nav.scoring")}
          title={t("scoring.title")}
          description={t("scoring.description", { season: managed.season.name })}
        />

        <AdminActionFeedback {...feedback} />

        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t("scoring.rescoreHint")}
        </p>

        <FormSection title={t("scoring.tableTitle")} description={t("scoring.tableBody")}>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {MARKET_TYPES.map((type) => (
              <div key={type} className="p-4">
                <h3 className="font-heading text-base font-semibold">{tm(`type.${type}`)}</h3>
                <div className="mt-2 grid gap-2">
                  {RULE_KEYS[type].map((ruleKey) => {
                    const id = `${type}-${ruleKey}`;
                    return (
                      <form
                        key={ruleKey}
                        action={saveScoringRule}
                        className="flex flex-wrap items-end gap-2 [&>*]:min-w-0"
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="season_id" value={managed.season.id} />
                        <input type="hidden" name="market_type" value={type} />
                        <input type="hidden" name="rule_key" value={ruleKey} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <label htmlFor={id} className="block text-sm text-muted-foreground">
                            {t(`scoring.rule.${ruleKey}` as never)}
                          </label>
                        </div>
                        <Input
                          id={id}
                          name="points"
                          type="number"
                          min="0"
                          max="1000"
                          step="1"
                          defaultValue={points.get(`${type}:${ruleKey}`) ?? 0}
                          className="h-10 w-20 sm:h-8 sm:w-24"
                        />
                        <SubmitButton size="sm" variant="outline">
                          {t("scoring.save")}
                        </SubmitButton>
                      </form>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      </div>
    </main>
  );
}
