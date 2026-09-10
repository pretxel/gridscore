"use server";

import { field, localeFromForm, trimmed } from "@/lib/admin/parse";
import { runAdminAction } from "@/lib/admin/run-action";
import type { OperationKind } from "@/lib/db";
import { localePath } from "@/lib/i18n";
import { OPERATION_KINDS, recordRun } from "@/lib/operations/record-run";
import { setOperationEnabled } from "@/lib/operations/settings";
import { runCalendarSync } from "@/lib/race-sync/calendar";
import { defaultProvider } from "@/lib/race-sync/providers";
import { runResultsSync } from "@/lib/race-sync/results";
import { createSupabaseCalendarStore, createSupabaseResultsStore } from "@/lib/race-sync/store";
import { getActiveSeason } from "@/lib/seasons";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function kindOf(form: FormData): OperationKind {
  const raw = trimmed(form, "kind");
  if (!(OPERATION_KINDS as readonly string[]).includes(raw)) {
    throw new Error(`unknown operation: ${raw}`);
  }
  return raw as OperationKind;
}

const REVALIDATE = ["/admin/operations", "/admin", "/gp", "/leaderboard"];

// Runs the job in-process rather than calling the cron route: no bearer token
// is involved, the kill switch is deliberately bypassed (an operator asked for
// this run), and the ledger records `trigger = 'manual'`.
export async function runNow(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  return runAdminAction(localePath(locale, "/admin/operations"), REVALIDATE, async () => {
    const kind = kindOf(form);
    const admin = createAdminSupabaseClient();
    const season = await getActiveSeason(admin);
    if (!season) throw new Error("no active season");

    const provider = defaultProvider();
    if (!provider.available()) throw new Error("race data provider is not configured");

    if (kind === "sync_calendar") {
      await recordRun("sync_calendar", "manual", () =>
        runCalendarSync({
          seasonYear: season.year,
          provider,
          store: createSupabaseCalendarStore(admin),
        }),
      );
    } else {
      // The scheduled run self-skips on a quiet week; a manual run never does.
      await recordRun("sync_results", "manual", () =>
        runResultsSync({
          seasonYear: season.year,
          provider,
          store: createSupabaseResultsStore(admin),
        }),
      );
    }
    return "ranNow";
  });
}

// Pauses or resumes the scheduled job. The cron route returns 204 with
// `x-skipped: disabled` while a job is off; "Run now" still works.
export async function toggleOperation(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  return runAdminAction(
    localePath(locale, "/admin/operations"),
    ["/admin/operations"],
    async () => {
      const kind = kindOf(form);
      const enabled = field(form, "enabled") === "true";
      await setOperationEnabled(kind, enabled);
      return enabled ? "operationResumed" : "operationPaused";
    },
  );
}
