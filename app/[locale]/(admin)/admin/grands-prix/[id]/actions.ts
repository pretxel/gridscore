"use server";

import { parseResultForm } from "@/lib/admin/market-result";
import {
  checkbox,
  field,
  localeFromForm,
  optionalInstant,
  trimmed,
  uuidSchema,
} from "@/lib/admin/parse";
import { runAdminAction } from "@/lib/admin/run-action";
import type { Json, TablesUpdate } from "@/lib/database.types";
import type { GrandPrixStatus } from "@/lib/db";
import { localePath } from "@/lib/i18n";
import { isMarketType, type MarketPick } from "@/lib/markets";

// Mirrors the grands_prix_status check constraint.
const GRAND_PRIX_STATUSES: readonly GrandPrixStatus[] = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function detailPath(form: FormData, gpId: string): string {
  return localePath(localeFromForm(form), `/admin/grands-prix/${gpId}`);
}

// Public pages that show a weekend, its markets or its points.
const PUBLIC_PATHS = ["/gp", "/leaderboard", "/my-picks", "/admin/grands-prix"];

// Session times and the sprint flag. The `grands_prix` trigger re-runs
// `ensure_markets_for_grand_prix`, which adds or voids `sprint_winner` and
// refreshes `locks_at` on markets still open — so lock times follow the
// schedule without a second write here.
export async function saveGrandPrix(form: FormData): Promise<never> {
  const gpId = trimmed(form, "grand_prix_id");
  return runAdminAction(detailPath(form, gpId), PUBLIC_PATHS, async () => {
    const id = uuidSchema.parse(gpId);
    const sessions = [
      "fp1_at",
      "fp2_at",
      "fp3_at",
      "sprint_qualifying_at",
      "sprint_at",
      "qualifying_at",
    ] as const;

    const status = trimmed(form, "status");
    if (!GRAND_PRIX_STATUSES.includes(status as GrandPrixStatus)) {
      throw new Error(`unknown status: ${status}`);
    }
    const raceAt = optionalInstant(form, "race_at");
    if (raceAt === undefined) throw new Error("invalid instant for race_at");
    if (raceAt === null) throw new Error("race_at is required");

    const patch: TablesUpdate<"grands_prix"> = {
      has_sprint: checkbox(form, "has_sprint"),
      status,
      race_at: raceAt,
    };
    for (const key of sessions) {
      const value = optionalInstant(form, key);
      if (value === undefined) throw new Error(`invalid instant for ${key}`);
      patch[key] = value;
    }

    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("grands_prix").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return "grandPrixSaved";
  });
}

// Writing `result` resolves the market and the recompute trigger rescores it,
// so the leaderboard moves without a second step.
export async function saveMarketResult(form: FormData): Promise<never> {
  const gpId = trimmed(form, "grand_prix_id");
  return runAdminAction(detailPath(form, gpId), PUBLIC_PATHS, async () => {
    const marketId = uuidSchema.parse(trimmed(form, "market_id"));
    const type = trimmed(form, "market_type");
    if (!isMarketType(type)) throw new Error(`unknown market type: ${type}`);

    const parsed = parseResultForm(type, {
      driver_id: field(form, "driver_id"),
      value: field(form, "value"),
      p1: field(form, "p1"),
      p2: field(form, "p2"),
      p3: field(form, "p3"),
    });
    if (!parsed.ok) throw new Error(`result ${parsed.error}`);

    await writeResult(marketId, parsed.pick, "manual");
    return "resultSaved";
  });
}

// Promotes what the results sync proposed. The suggestion is left in place as
// a record of where the result came from.
export async function acceptSuggestion(form: FormData): Promise<never> {
  const gpId = trimmed(form, "grand_prix_id");
  return runAdminAction(detailPath(form, gpId), PUBLIC_PATHS, async () => {
    const marketId = uuidSchema.parse(trimmed(form, "market_id"));
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("markets")
      .select("suggested_result")
      .eq("id", marketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.suggested_result) throw new Error("market has no suggestion");

    await writeResult(marketId, data.suggested_result as MarketPick, "provider");
    return "suggestionAccepted";
  });
}

// A cancelled session: the trigger clears the result and the recompute drops
// every score row, so nobody keeps points for a market that never ran.
export async function voidMarket(form: FormData): Promise<never> {
  const gpId = trimmed(form, "grand_prix_id");
  return runAdminAction(detailPath(form, gpId), PUBLIC_PATHS, async () => {
    const marketId = uuidSchema.parse(trimmed(form, "market_id"));
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("markets").update({ status: "void" }).eq("id", marketId);
    if (error) throw new Error(error.message);
    return "marketVoided";
  });
}

// Undoes a wrong result or an unvoid. Picks were never deleted, so reopening
// makes the market scoreable again from the same predictions; whether players
// can still edit is decided by `locks_at`, not by this.
export async function reopenMarket(form: FormData): Promise<never> {
  const gpId = trimmed(form, "grand_prix_id");
  return runAdminAction(detailPath(form, gpId), PUBLIC_PATHS, async () => {
    const marketId = uuidSchema.parse(trimmed(form, "market_id"));
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("markets")
      .update({ status: "open", result: null, resolved_at: null, resolution_source: null })
      .eq("id", marketId);
    if (error) throw new Error(error.message);
    return "marketReopened";
  });
}

async function writeResult(
  marketId: string,
  pick: MarketPick,
  source: "manual" | "provider",
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("markets")
    .update({
      result: pick as unknown as Json,
      status: "resolved",
      resolution_source: source,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", marketId);
  if (error) throw new Error(error.message);
}
