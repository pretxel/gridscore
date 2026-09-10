import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminActionFeedback, feedbackFrom } from "@/components/admin/action-feedback";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FormSection } from "@/components/admin/form-section";
import { SubmitButton } from "@/components/admin/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toDatetimeLocal } from "@/lib/admin/parse";
import { getGrandPrixDetail } from "@/lib/admin/queries";
import { listSeasonDrivers } from "@/lib/drivers";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { recomputeGrandPrix } from "../actions";
import { saveGrandPrix } from "./actions";
import { MarketResultForm } from "./market-result-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SESSIONS = [
  "fp1_at",
  "fp2_at",
  "fp3_at",
  "sprint_qualifying_at",
  "sprint_at",
  "qualifying_at",
  "race_at",
] as const;

const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

export default async function AdminGrandPrixPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw, id } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  if (!UUID_RE.test(id)) notFound();
  const feedback = feedbackFrom(await searchParams);
  const t = await getTranslations("admin");

  const detail = await getGrandPrixDetail(id);
  if (!detail) notFound();
  const { grandPrix: gp, markets } = detail;

  // The roster comes from the weekend's own season, so editing a past season
  // still offers that season's drivers.
  const drivers = await listSeasonDrivers(gp.season_id, createAdminSupabaseClient());

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="admin-reveal space-y-6">
        <Link
          href={localePath(locale, "/admin/grands-prix")}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          ← {t("nav.grandsPrix")}
        </Link>

        <AdminPageHeader
          eyebrow={t("grandsPrix.round", { round: gp.round })}
          title={gp.name}
          description={t("grandPrix.description", {
            multiplier: gp.multiplier,
            points: detail.scoredPoints,
            rows: detail.scoredRows,
          })}
          actions={
            <form action={recomputeGrandPrix}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="grand_prix_id" value={gp.id} />
              <input
                type="hidden"
                name="back"
                value={localePath(locale, `/admin/grands-prix/${gp.id}`)}
              />
              <SubmitButton variant="outline" size="sm">
                {t("grandsPrix.recompute")}
              </SubmitButton>
            </form>
          }
        />

        <AdminActionFeedback {...feedback} />

        <FormSection title={t("grandPrix.sessionsTitle")} description={t("grandPrix.sessionsBody")}>
          <form action={saveGrandPrix} className="space-y-4 rounded-xl border border-border p-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="grand_prix_id" value={gp.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              {SESSIONS.map((key) => (
                <div key={key} className="space-y-1">
                  <label
                    htmlFor={key}
                    className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {t(`grandPrix.session.${key}` as never)}
                    {key === "race_at" ? " *" : ""}
                  </label>
                  <Input
                    id={key}
                    name={key}
                    type="datetime-local"
                    required={key === "race_at"}
                    defaultValue={toDatetimeLocal(gp[key])}
                    className="h-9"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label
                  htmlFor="status"
                  className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {t("grandPrix.status")}
                </label>
                <NativeSelect id="status" name="status" defaultValue={gp.status}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`grandPrix.statusValue.${status}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="has_sprint"
                defaultChecked={gp.has_sprint}
                className="size-4 rounded border-input"
              />
              {t("grandPrix.hasSprint")}
            </label>
            <p className="text-xs text-muted-foreground">{t("grandPrix.timesAreUtc")}</p>
            <SubmitButton size="sm">{t("grandPrix.saveSessions")}</SubmitButton>
          </form>
        </FormSection>

        <FormSection title={t("grandPrix.marketsTitle")} description={t("grandPrix.marketsBody")}>
          <ul className="grid gap-3">
            {markets.map((market) => (
              <MarketResultForm
                key={market.id}
                market={market}
                drivers={drivers}
                locale={locale}
                grandPrixId={gp.id}
              />
            ))}
          </ul>
        </FormSection>
      </div>
    </main>
  );
}
