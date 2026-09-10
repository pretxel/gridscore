"use server";

import { localeFromForm, planSchema, trimmed, uuidSchema } from "@/lib/admin/parse";
import { runAdminAction } from "@/lib/admin/run-action";
import { localePath } from "@/lib/i18n";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// `leagues.plan` is service-role only (trg_leagues_guard_plan), so this is the
// only path that can lift a league's member cap. No payments yet: flipping the
// plan here is the manual stand-in for an upgrade.
export async function setLeaguePlan(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  return runAdminAction(
    localePath(locale, "/admin/leagues"),
    ["/admin/leagues", "/leagues"],
    async () => {
      const id = uuidSchema.parse(trimmed(form, "league_id"));
      const plan = planSchema.parse(trimmed(form, "plan"));

      const admin = createAdminSupabaseClient();
      const { error } = await admin.from("leagues").update({ plan }).eq("id", id);
      if (error) throw new Error(error.message);
      return plan === "pro" ? "leagueUpgraded" : "leagueDowngraded";
    },
  );
}
