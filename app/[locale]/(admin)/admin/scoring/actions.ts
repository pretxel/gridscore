"use server";

import {
  localeFromForm,
  marketTypeSchema,
  pointsSchema,
  scoringRuleKeySchema,
  trimmed,
  uuidSchema,
} from "@/lib/admin/parse";
import { runAdminAction } from "@/lib/admin/run-action";
import { localePath } from "@/lib/i18n";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Editing a rule changes what future results award. Already-scored weekends
// keep their points until an operator rescores them from the Grands Prix
// screen, so a mid-season correction never silently rewrites history.
export async function saveScoringRule(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  return runAdminAction(
    localePath(locale, "/admin/scoring"),
    ["/admin/scoring", "/how-it-works"],
    async () => {
      const seasonId = uuidSchema.parse(trimmed(form, "season_id"));
      const marketType = marketTypeSchema.parse(trimmed(form, "market_type"));
      const ruleKey = scoringRuleKeySchema.parse(trimmed(form, "rule_key"));
      const points = pointsSchema.parse(trimmed(form, "points"));

      const admin = createAdminSupabaseClient();
      const { error } = await admin
        .from("scoring_rules")
        .upsert(
          { season_id: seasonId, market_type: marketType, rule_key: ruleKey, points },
          { onConflict: "season_id,market_type,rule_key" },
        );
      if (error) throw new Error(error.message);
      return "ruleSaved";
    },
  );
}
