import "server-only";
import type { GrandPrixBoardRow, LeaderboardRow } from "@/lib/db";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// Both surfaces share the row shape; the page renders them identically.
export type BoardRow = LeaderboardRow | GrandPrixBoardRow;

export type BoardResult = { rows: BoardRow[]; error: string | null };

// Season standings (v_leaderboard_overall, scoped by active_season_id()).
export async function getOverallBoard(supabase: Client): Promise<BoardResult> {
  const { data, error } = await supabase
    .from("v_leaderboard_overall")
    .select("*")
    .order("rank", { ascending: true });
  return { rows: (data ?? []) as BoardRow[], error: error?.message ?? null };
}

// Standings for one weekend.
export async function getGrandPrixBoard(gpId: string, supabase: Client): Promise<BoardResult> {
  const { data, error } = await supabase.rpc("leaderboard_for_grand_prix", { p_gp_id: gpId });
  return { rows: (data ?? []) as BoardRow[], error: error?.message ?? null };
}
