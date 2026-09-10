import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminActionFeedback, feedbackFrom } from "@/components/admin/action-feedback";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FormSection } from "@/components/admin/form-section";
import { SubmitButton } from "@/components/admin/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getManagedSeason } from "@/lib/admin/managed-season";
import { getRoster } from "@/lib/admin/queries";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { saveDriver, saveTeam, toggleDriverActive } from "./actions";

export default async function AdminDriversPage({
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
      <main className="mx-auto max-w-4xl px-4 py-10">
        <AdminPageHeader eyebrow={t("nav.drivers")} title={t("drivers.title")} />
        <EmptyState title={t("grandsPrix.noSeason")} className="mt-8" />
      </main>
    );
  }

  const { teams, drivers } = await getRoster(managed.season.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="admin-reveal space-y-6">
        <AdminPageHeader
          eyebrow={t("nav.drivers")}
          title={t("drivers.title")}
          description={t("drivers.description", { season: managed.season.name })}
        />

        <AdminActionFeedback {...feedback} />

        {drivers.length === 0 && teams.length === 0 ? (
          <EmptyState title={t("drivers.emptyTitle")} description={t("drivers.emptyBody")} />
        ) : (
          <>
            <FormSection title={t("drivers.teamsTitle")} description={t("drivers.teamsBody")}>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {teams.map((team) => (
                  <li key={team.id} className="p-3">
                    <form action={saveTeam} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="team_id" value={team.id} />
                      <span className="min-w-40 flex-1 pb-1.5 text-sm font-medium">
                        {team.name}
                      </span>
                      <div className="space-y-1">
                        <label
                          htmlFor={`short-${team.id}`}
                          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {t("drivers.shortName")}
                        </label>
                        <Input
                          id={`short-${team.id}`}
                          name="short_name"
                          defaultValue={team.short_name}
                          maxLength={24}
                          className="w-36"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`color-${team.id}`}
                          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {t("drivers.color")}
                        </label>
                        <Input
                          id={`color-${team.id}`}
                          name="color"
                          defaultValue={team.color ?? ""}
                          placeholder="#FF8000"
                          className="w-28 font-mono"
                        />
                      </div>
                      <SubmitButton size="sm" variant="outline">
                        {t("drivers.save")}
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </FormSection>

            <FormSection title={t("drivers.driversTitle")} description={t("drivers.driversBody")}>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {drivers.map((driver) => (
                  <li key={driver.id} className="flex flex-wrap items-end gap-2 p-3">
                    <form action={saveDriver} className="flex flex-1 flex-wrap items-end gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="driver_id" value={driver.id} />
                      <span className="min-w-40 flex-1 pb-1.5 text-sm font-medium">
                        {driver.given_name} {driver.family_name}
                        {driver.active ? null : (
                          <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                            {t("drivers.inactive")}
                          </span>
                        )}
                      </span>
                      <div className="space-y-1">
                        <label
                          htmlFor={`code-${driver.id}`}
                          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {t("drivers.code")}
                        </label>
                        <Input
                          id={`code-${driver.id}`}
                          name="code"
                          defaultValue={driver.code ?? ""}
                          maxLength={3}
                          className="w-20 font-mono uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`number-${driver.id}`}
                          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {t("drivers.number")}
                        </label>
                        <Input
                          id={`number-${driver.id}`}
                          name="number"
                          type="number"
                          min="0"
                          max="99"
                          defaultValue={driver.number ?? ""}
                          className="w-20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`team-${driver.id}`}
                          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {t("drivers.team")}
                        </label>
                        <NativeSelect
                          id={`team-${driver.id}`}
                          name="team_id"
                          defaultValue={driver.team_id ?? ""}
                        >
                          <option value="">{t("drivers.noTeam")}</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.short_name}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <SubmitButton size="sm" variant="outline">
                        {t("drivers.save")}
                      </SubmitButton>
                    </form>
                    <form action={toggleDriverActive}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="driver_id" value={driver.id} />
                      <input type="hidden" name="active" value={driver.active ? "false" : "true"} />
                      <SubmitButton size="sm" variant="ghost">
                        {driver.active ? t("drivers.deactivate") : t("drivers.activate")}
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </FormSection>
          </>
        )}
      </div>
    </main>
  );
}
