import { NextResponse } from "next/server";
import { authorizeCron, skipped } from "@/lib/cron/authorize";
import { recordRun } from "@/lib/operations/record-run";
import { isOperationEnabled } from "@/lib/operations/settings";
import { defaultProvider } from "@/lib/race-sync/providers";
import { hasRecentLocks, runResultsSync } from "@/lib/race-sync/results";
import { createSupabaseResultsStore } from "@/lib/race-sync/store";
import { getActiveSeason } from "@/lib/seasons";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Hourly: resolve markets whose session has run. Self-skips when no
// provider-resolvable market locked in the last 7 days, so quiet weeks cost
// no provider requests. `?force=1` (admin backfill) bypasses the check.
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  if (!(await isOperationEnabled("sync_results"))) return skipped("disabled");

  const admin = createAdminSupabaseClient();
  const season = await getActiveSeason(admin);
  if (!season) return skipped("no-active-season");

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force) {
    const { data, error } = await admin
      .from("markets")
      .select("locks_at, status, type, suggested_result, grands_prix!inner(season_id)")
      .eq("grands_prix.season_id", season.id)
      .in("status", ["open", "locked"]);
    if (error) throw new Error(error.message);
    if (!hasRecentLocks(data ?? [], new Date())) return skipped("nothing-due");
  }

  const provider = defaultProvider();
  if (!provider.available()) return skipped("missing-env");

  const { summary } = await recordRun("sync_results", "cron", () =>
    runResultsSync({
      seasonYear: season.year,
      provider,
      store: createSupabaseResultsStore(admin),
    }),
  );
  console.log("[cron:sync-results] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
