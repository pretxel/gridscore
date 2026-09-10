import { NextResponse } from "next/server";
import { authorizeCron, skipped } from "@/lib/cron/authorize";
import { recordRun } from "@/lib/operations/record-run";
import { isOperationEnabled } from "@/lib/operations/settings";
import { runCalendarSync } from "@/lib/race-sync/calendar";
import { defaultProvider } from "@/lib/race-sync/providers";
import { createSupabaseCalendarStore } from "@/lib/race-sync/store";
import { getActiveSeason } from "@/lib/seasons";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Daily: import or refresh the active season's teams, drivers and calendar.
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  if (!(await isOperationEnabled("sync_calendar"))) return skipped("disabled");

  const admin = createAdminSupabaseClient();
  const season = await getActiveSeason(admin);
  if (!season) return skipped("no-active-season");

  const provider = defaultProvider();
  if (!provider.available()) return skipped("missing-env");

  const { summary } = await recordRun("sync_calendar", "cron", () =>
    runCalendarSync({
      seasonYear: season.year,
      provider,
      store: createSupabaseCalendarStore(admin),
    }),
  );
  console.log("[cron:sync-calendar] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
