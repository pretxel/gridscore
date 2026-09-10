import "server-only";
import type { MarketType } from "@/lib/markets";
import type { MarketStat, WeekendPoints } from "@/lib/stats";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type UserSeasonStats = {
  markets: MarketStat[];
  weekends: WeekendPoints[];
  averagePoints: number;
};

const EMPTY: UserSeasonStats = { markets: [], weekends: [], averagePoints: 0 };

// Everything /stats needs, in one place. The SQL functions are season-scoped
// and refuse to return another user's rows, so an empty result is the right
// answer for an unauthorised caller rather than an error page.
export async function getUserStats(userId: string, client?: Client): Promise<UserSeasonStats> {
  const supabase = client ?? (await createServerSupabaseClient());
  const [markets, weekends, average] = await Promise.all([
    supabase.rpc("user_market_stats", { p_user_id: userId }),
    supabase.rpc("user_weekend_points", { p_user_id: userId }),
    supabase.rpc("season_average_points"),
  ]);

  const failure = markets.error ?? weekends.error ?? average.error;
  if (failure) {
    console.error("[stats] load failed:", failure.message);
    return EMPTY;
  }

  return {
    markets: (markets.data ?? []).map((row) => ({
      marketType: row.market_type as MarketType,
      scored: row.scored,
      hits: row.hits,
      points: row.points,
    })),
    weekends: (weekends.data ?? []).map((row) => ({
      grandPrixId: row.grand_prix_id,
      round: row.round,
      name: row.name,
      points: row.points,
      scored: row.scored,
    })),
    averagePoints: Number(average.data ?? 0),
  };
}
