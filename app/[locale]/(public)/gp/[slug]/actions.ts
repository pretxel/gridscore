"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isCurrentUserAdmin } from "@/lib/admin/current-user";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { lockReason } from "@/lib/market-utils";
import { isMarketType, type MarketType, safeParsePick } from "@/lib/markets";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const envelope = z.object({
  marketId: z.string().uuid(),
  slug: z.string().min(1).max(80),
  type: z.string().refine(isMarketType, "unknown market type"),
  pick: z.unknown(),
});

export type SubmitPickResult = { ok: true } | { ok: false; error: string };

// Saves (or updates) the caller's pick for one market. The database enforces
// the lock twice (RLS + trigger); this action just turns refusals into
// localized messages and refreshes the pages that show the pick.
export async function submitPick(input: unknown): Promise<SubmitPickResult> {
  const t = await getTranslations("pickForm");
  const parsed = envelope.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("errorInvalid") };
  const type = parsed.data.type as MarketType;
  const pick = safeParsePick(type, parsed.data.pick);
  if (!pick.success) {
    const dup = pick.error.issues.some((i) => /distinct/.test(i.message));
    return { ok: false, error: t(dup ? "errorDuplicateDrivers" : "errorInvalid") };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t("errorNotSignedIn") };
  if (await isCurrentUserAdmin(supabase)) return { ok: false, error: t("errorAdmin") };

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("id, type, status, locks_at")
    .eq("id", parsed.data.marketId)
    .maybeSingle();
  if (marketError) {
    console.error("[submitPick] market lookup failed:", marketError.message);
    return { ok: false, error: t("errorGeneric") };
  }
  if (!market) return { ok: false, error: t("errorMarketNotFound") };
  if (market.type !== type) return { ok: false, error: t("errorInvalid") };
  if (lockReason(market)) return { ok: false, error: t("errorLocked") };

  const { error } = await supabase
    .from("predictions")
    .upsert(
      { user_id: user.id, market_id: market.id, pick: pick.data },
      { onConflict: "user_id,market_id" },
    );
  if (error) {
    if (error.code === "42501" || /row-level security|prediction locked/i.test(error.message)) {
      return { ok: false, error: t("errorLocked") };
    }
    console.error("[submitPick] upsert failed:", error.message);
    return { ok: false, error: t("errorGeneric") };
  }

  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}/gp/${parsed.data.slug}`);
    revalidatePath(`/${locale}/gp`);
    revalidatePath(`/${locale}/my-picks`);
  }
  return { ok: true };
}
