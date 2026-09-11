import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminActionFeedback, feedbackFrom } from "@/components/admin/action-feedback";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FormSection } from "@/components/admin/form-section";
import { SubmitButton } from "@/components/admin/submit-button";
import { LocalTime } from "@/components/local-time";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getManagedSeason } from "@/lib/admin/managed-season";
import { MULTIPLIER_REASONS } from "@/lib/admin/parse";
import { listGrandsPrix } from "@/lib/admin/queries";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { recomputeGrandPrix, setManagedSeason, setMultiplier, unlockMultiplier } from "./actions";

export default async function AdminGrandsPrixPage({
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

  const managed = await getManagedSeason();
  if (!managed) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <AdminPageHeader eyebrow={t("nav.grandsPrix")} title={t("grandsPrix.title")} />
        <EmptyState title={t("grandsPrix.noSeason")} className="mt-8" />
      </main>
    );
  }

  const grandsPrix = await listGrandsPrix(managed.season.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="admin-reveal space-y-6">
        <AdminPageHeader
          eyebrow={t("nav.grandsPrix")}
          title={t("grandsPrix.title")}
          description={t("grandsPrix.description")}
          actions={
            <form action={setManagedSeason} className="flex w-full items-center gap-2 sm:w-auto">
              <input type="hidden" name="locale" value={locale} />
              <label htmlFor="season_slug" className="sr-only">
                {t("grandsPrix.seasonLabel")}
              </label>
              <NativeSelect
                id="season_slug"
                name="season_slug"
                defaultValue={managed.season.slug}
                className="h-10 flex-1 sm:h-8 sm:flex-none"
              >
                {managed.seasons.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
              <SubmitButton variant="outline" size="sm">
                {t("grandsPrix.switchSeason")}
              </SubmitButton>
            </form>
          }
        />

        <AdminActionFeedback {...feedback} />

        {!managed.isActive ? (
          <p className="rounded-lg border border-signal/40 bg-signal/10 px-3 py-2 text-sm">
            {t("grandsPrix.notActiveSeason", { season: managed.season.name })}
          </p>
        ) : null}

        {grandsPrix.length === 0 ? (
          <EmptyState
            title={t("grandsPrix.emptyTitle")}
            description={t("grandsPrix.emptyBody")}
            action={
              <Link
                href={localePath(locale, "/admin/operations")}
                className="text-sm font-medium underline"
              >
                {t("grandsPrix.goToOperations")}
              </Link>
            }
          />
        ) : (
          <FormSection
            title={t("grandsPrix.calendarTitle")}
            description={t("grandsPrix.calendarBody", { count: grandsPrix.length })}
          >
            <ul className="grid gap-3">
              {grandsPrix.map((gp) => (
                <li key={gp.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {t("grandsPrix.round", { round: gp.round })} ·{" "}
                        <LocalTime iso={gp.race_at} format="date" /> · {gp.status}
                      </p>
                      <Link
                        href={localePath(locale, `/admin/grands-prix/${gp.id}`)}
                        className="font-heading text-lg font-semibold tracking-tight hover:underline"
                      >
                        {gp.name}
                      </Link>
                      <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted-foreground">
                        <span>{t("grandsPrix.marketsOpen", { count: gp.marketCounts.open })}</span>
                        <span>
                          {t("grandsPrix.marketsLocked", { count: gp.marketCounts.locked })}
                        </span>
                        <span>
                          {t("grandsPrix.marketsResolved", { count: gp.marketCounts.resolved })}
                        </span>
                        {gp.marketCounts.void > 0 ? (
                          <span>
                            {t("grandsPrix.marketsVoid", { count: gp.marketCounts.void })}
                          </span>
                        ) : null}
                        {gp.pendingSuggestions > 0 ? (
                          <span className="text-signal">
                            {t("grandsPrix.pendingSuggestions", { count: gp.pendingSuggestions })}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <form action={recomputeGrandPrix}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="grand_prix_id" value={gp.id} />
                      <SubmitButton variant="outline" size="sm">
                        {t("grandsPrix.recompute")}
                      </SubmitButton>
                    </form>
                  </div>

                  <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:flex sm:flex-wrap sm:items-end">
                    <form
                      action={setMultiplier}
                      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end"
                    >
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="grand_prix_id" value={gp.id} />
                      <div className="space-y-1">
                        <label
                          htmlFor={`multiplier-${gp.id}`}
                          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {t("grandsPrix.multiplier")}
                        </label>
                        <Input
                          id={`multiplier-${gp.id}`}
                          name="multiplier"
                          type="number"
                          step="0.05"
                          min="1"
                          max="99.99"
                          defaultValue={gp.multiplier}
                          className="h-10 w-full sm:h-8 sm:w-24"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`reason-${gp.id}`}
                          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {t("grandsPrix.multiplierReason")}
                        </label>
                        <NativeSelect
                          id={`reason-${gp.id}`}
                          name="multiplier_reason"
                          defaultValue={gp.multiplier_reason}
                          className="h-10 w-full sm:h-8 sm:w-auto"
                        >
                          {MULTIPLIER_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {t(`grandsPrix.reason.${reason}` as never)}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <SubmitButton size="sm" className="col-span-2 h-10 sm:h-7">
                        {t("grandsPrix.saveMultiplier")}
                      </SubmitButton>
                    </form>
                    {gp.multiplier_locked ? (
                      <form action={unlockMultiplier} className="flex items-center gap-2">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="grand_prix_id" value={gp.id} />
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                          {t("grandsPrix.locked")}
                        </span>
                        <SubmitButton variant="ghost" size="sm">
                          {t("grandsPrix.unlock")}
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {t("grandsPrix.syncOwned")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </FormSection>
        )}
      </div>
    </main>
  );
}
