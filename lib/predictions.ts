import "server-only";
import type { PredictionRow, ScoreRow } from "@/lib/db";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PickState = {
  prediction: PredictionRow | null;
  score: ScoreRow | null;
};

// The signed-in user's picks and scores for a set of markets, keyed by
// market id. Empty map when signed out. RLS scopes both reads to the caller.
export async function getMyPickStates(
  marketIds: string[],
  supabase: Client,
): Promise<Map<string, PickState>> {
  const out = new Map<string, PickState>();
  if (marketIds.length === 0) return out;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return out;

  const [{ data: picks, error: pErr }, { data: scores, error: sErr }] = await Promise.all([
    supabase.from("predictions").select("*").eq("user_id", user.id).in("market_id", marketIds),
    supabase.from("scores").select("*").eq("user_id", user.id).in("market_id", marketIds),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (sErr) throw new Error(sErr.message);

  for (const p of (picks ?? []) as PredictionRow[]) {
    out.set(p.market_id, { prediction: p, score: null });
  }
  for (const s of (scores ?? []) as ScoreRow[]) {
    const cur = out.get(s.market_id) ?? { prediction: null, score: null };
    out.set(s.market_id, { ...cur, score: s });
  }
  return out;
}
