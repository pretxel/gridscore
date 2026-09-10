import "server-only";
import type { ScoringRuleKey } from "@/lib/db";
import type { MarketType } from "@/lib/markets";
import type { ScoringRules } from "@/lib/scoring";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// The season's scoring_rules as the nested map lib/scoring.ts consumes.
export async function getScoringRules(seasonId: string, supabase: Client): Promise<ScoringRules> {
  const { data, error } = await supabase
    .from("scoring_rules")
    .select("market_type, rule_key, points")
    .eq("season_id", seasonId);
  if (error) throw new Error(error.message);
  const rules: ScoringRules = {};
  for (const row of data ?? []) {
    const type = row.market_type as MarketType;
    const key = row.rule_key as ScoringRuleKey;
    rules[type] = { ...(rules[type] ?? {}), [key]: row.points };
  }
  return rules;
}
