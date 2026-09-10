import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FormSection } from "@/components/admin/form-section";
import { StatusCard } from "@/components/admin/status-card";
import { LocalTime } from "@/components/local-time";
import { getManagedSeason } from "@/lib/admin/managed-season";
import { listGrandsPrix } from "@/lib/admin/queries";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { grandPrixPhase } from "@/lib/market-utils";
import { lastRun } from "@/lib/operations/queries";
import { OPERATION_KINDS } from "@/lib/operations/record-run";
import { getOperationSettings } from "@/lib/operations/settings";

// The control room's front page: what needs an operator right now, and where
// to go next. Every number here is a link to the screen that changes it.
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const managed = await getManagedSeason();
  if (!managed) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <AdminPageHeader eyebrow={t("dashboard.eyebrow")} title={t("dashboard.title")} />
        <EmptyState
          title={t("dashboard.noSeasonTitle")}
          description={t("dashboard.noSeasonBody")}
          className="mt-8"
        />
      </main>
    );
  }

  const [grandsPrix, settings] = await Promise.all([
    listGrandsPrix(managed.season.id),
    getOperationSettings(),
  ]);
  const now = Date.now();

  const pendingSuggestions = grandsPrix.reduce((sum, gp) => sum + gp.pendingSuggestions, 0);
  // A weekend that has run but still holds unresolved markets is what an
  // operator has to act on.
  const awaitingResults = grandsPrix.filter(
    (gp) =>
      grandPrixPhase(gp, now) === "completed" && gp.marketCounts.open + gp.marketCounts.locked > 0,
  );
  const upcoming = grandsPrix.find((gp) => grandPrixPhase(gp, now) !== "completed") ?? null;
  const pausedJobs = OPERATION_KINDS.filter((kind) => !settings[kind]);
  const lastRuns = await Promise.all(OPERATION_KINDS.map((kind) => lastRun(kind)));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="admin-reveal space-y-8">
        <AdminPageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("dashboard.title")}
          description={t("dashboard.seasonLine", {
            season: managed.season.name,
            status: managed.season.status,
          })}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatusCard
            label={t("dashboard.nextWeekend")}
            value={upcoming ? upcoming.name : t("dashboard.seasonOver")}
            meta={
              upcoming ? (
                <>
                  {t("grandsPrix.round", { round: upcoming.round })} ·{" "}
                  <LocalTime iso={upcoming.race_at} format="datetime" />
                </>
              ) : null
            }
            actions={
              <Link
                href={localePath(locale, "/admin/grands-prix")}
                className="text-sm font-medium underline"
              >
                {t("dashboard.openCalendar")}
              </Link>
            }
          />
          <StatusCard
            label={t("dashboard.needsAttention")}
            value={t("dashboard.awaitingResults", { count: awaitingResults.length })}
            meta={t("dashboard.pendingSuggestions", { count: pendingSuggestions })}
            actions={
              awaitingResults[0] ? (
                <Link
                  href={localePath(locale, `/admin/grands-prix/${awaitingResults[0].id}`)}
                  className="text-sm font-medium underline"
                >
                  {t("dashboard.enterResults", { name: awaitingResults[0].name })}
                </Link>
              ) : null
            }
          />
        </div>

        <FormSection title={t("dashboard.jobsTitle")} description={t("dashboard.jobsBody")}>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {OPERATION_KINDS.map((kind, index) => {
              const run = lastRuns[index];
              return (
                <li key={kind} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                  <span className="text-sm font-medium">
                    {t(`operations.kind.${kind}` as never)}
                    {settings[kind] ? null : (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">
                        {t("operations.paused")}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {run ? (
                      <>
                        <LocalTime iso={run.started_at} format="datetime" /> ·{" "}
                        {t(`operations.status.${run.status}` as never)}
                      </>
                    ) : (
                      t("operations.noRuns")
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {pausedJobs.length > 0 ? (
            <p className="text-xs text-destructive">{t("dashboard.pausedWarning")}</p>
          ) : null}
        </FormSection>

        <FormSection title={t("dashboard.shortcutsTitle")}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(["grandsPrix", "drivers", "scoring", "leagues", "operations"] as const).map((key) => (
              <li key={key}>
                <Link
                  href={localePath(locale, `/admin/${key === "grandsPrix" ? "grands-prix" : key}`)}
                  className="block rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  {t(`nav.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </FormSection>
      </div>
    </main>
  );
}
