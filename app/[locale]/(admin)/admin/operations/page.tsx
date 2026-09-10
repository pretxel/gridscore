import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminActionFeedback, feedbackFrom } from "@/components/admin/action-feedback";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FormSection } from "@/components/admin/form-section";
import { SubmitButton } from "@/components/admin/submit-button";
import { LocalTime } from "@/components/local-time";
import type { OperationKind, OperationRunRow } from "@/lib/db";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { listRecentRuns } from "@/lib/operations/queries";
import { OPERATION_KINDS } from "@/lib/operations/record-run";
import { nextScheduledRun, OPERATION_SCHEDULES } from "@/lib/operations/schedule";
import { getOperationSettings } from "@/lib/operations/settings";
import { runNow, toggleOperation } from "./actions";

const RUN_LIMIT = 20;

export default async function AdminOperationsPage({
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

  const settings = await getOperationSettings();
  const runsByKind = new Map<OperationKind, OperationRunRow[]>();
  for (const kind of OPERATION_KINDS) {
    runsByKind.set(kind, await listRecentRuns(kind, RUN_LIMIT));
  }
  const now = new Date();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="admin-reveal space-y-6">
        <AdminPageHeader
          eyebrow={t("nav.operations")}
          title={t("operations.title")}
          description={t("operations.description")}
        />

        <AdminActionFeedback {...feedback} />

        {OPERATION_KINDS.map((kind) => {
          const enabled = settings[kind];
          const runs = runsByKind.get(kind) ?? [];
          return (
            <FormSection
              key={kind}
              title={t(`operations.kind.${kind}` as never)}
              description={t("operations.cadence", {
                cron: OPERATION_SCHEDULES[kind].cron,
              })}
              action={
                <div className="flex items-center gap-2">
                  <form action={runNow}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="kind" value={kind} />
                    <SubmitButton size="sm" pendingLabel={t("operations.running")}>
                      {t("operations.runNow")}
                    </SubmitButton>
                  </form>
                  <form action={toggleOperation}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
                    <SubmitButton size="sm" variant="outline">
                      {enabled ? t("operations.pause") : t("operations.resume")}
                    </SubmitButton>
                  </form>
                </div>
              }
            >
              <div className="rounded-xl border border-border bg-card">
                <p className="border-b border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {enabled ? (
                    <>
                      {t("operations.enabled")} · {t("operations.nextRun")}{" "}
                      <LocalTime
                        iso={nextScheduledRun(kind, now).toISOString()}
                        format="datetime"
                      />
                    </>
                  ) : (
                    <span className="text-destructive">{t("operations.paused")}</span>
                  )}
                </p>
                {runs.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {t("operations.noRuns")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {runs.map((run) => (
                      <li key={run.id} className="px-4 py-2.5 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            <LocalTime iso={run.started_at} format="datetime" /> ·{" "}
                            {t(`operations.trigger.${run.trigger}` as never)} · {run.duration_ms}ms
                          </span>
                          <span
                            className={
                              run.status === "error"
                                ? "font-mono text-[11px] font-semibold uppercase text-destructive"
                                : "font-mono text-[11px] font-semibold uppercase text-muted-foreground"
                            }
                          >
                            {t(`operations.status.${run.status}` as never)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {run.error ?? JSON.stringify(run.summary)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FormSection>
          );
        })}
      </div>
    </main>
  );
}
