import "server-only";
import type { LeagueBoardRow, LeagueRole, Plan } from "@/lib/db";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type MyLeague = {
  id: string;
  name: string;
  join_code: string;
  plan: Plan;
  owner_id: string;
  season_id: string;
  member_count: number;
  role: LeagueRole;
};

// Leagues the caller belongs to. RLS already hides everything else; admins
// can read every league, so membership is filtered here too.
export async function listMyLeagues(userId: string, supabase: Client): Promise<MyLeague[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, join_code, plan, owner_id, season_id, league_members(user_id, role)")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[leagues] list failed:", error.message);
    return [];
  }
  const out: MyLeague[] = [];
  for (const league of data ?? []) {
    const members = league.league_members ?? [];
    const mine = members.find((m) => m.user_id === userId);
    if (!mine) continue;
    out.push({
      id: league.id,
      name: league.name,
      join_code: league.join_code,
      plan: league.plan as Plan,
      owner_id: league.owner_id,
      season_id: league.season_id,
      member_count: members.length,
      role: mine.role as LeagueRole,
    });
  }
  return out;
}

export type LeagueMember = {
  user_id: string;
  role: LeagueRole;
  joined_at: string;
  display_name: string | null;
};

export type LeagueDetail = {
  id: string;
  name: string;
  join_code: string;
  plan: Plan;
  owner_id: string;
  season_id: string;
  created_at: string;
  members: LeagueMember[];
};

// One league with its roster. Null when it does not exist or the caller is
// not a member (RLS returns no row either way).
export async function getLeague(id: string, supabase: Client): Promise<LeagueDetail | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select(
      "id, name, join_code, plan, owner_id, season_id, created_at, league_members(user_id, role, joined_at, profiles!league_members_user_id_fkey(display_name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[leagues] load failed:", error.message);
    return null;
  }
  if (!data) return null;
  const members: LeagueMember[] = (data.league_members ?? [])
    .map((m) => ({
      user_id: m.user_id,
      role: m.role as LeagueRole,
      joined_at: m.joined_at,
      display_name: m.profiles?.display_name ?? null,
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
      return a.joined_at.localeCompare(b.joined_at);
    });
  return {
    id: data.id,
    name: data.name,
    join_code: data.join_code,
    plan: data.plan as Plan,
    owner_id: data.owner_id,
    season_id: data.season_id,
    created_at: data.created_at,
    members,
  };
}

export type LeagueBoardResult = { rows: LeagueBoardRow[]; error: string | null };

// Members only, each counted from the weekend they joined (SQL enforces
// both). Empty for non-members.
export async function getLeagueBoard(id: string, supabase: Client): Promise<LeagueBoardResult> {
  const { data, error } = await supabase.rpc("leaderboard_for_league", { p_league_id: id });
  return { rows: data ?? [], error: error?.message ?? null };
}

export type LeaguePreview = { id: string; name: string; member_count: number; plan: Plan };

// What an invitee sees before joining. Null for an unknown code.
export async function getLeaguePreview(
  code: string,
  supabase: Client,
): Promise<LeaguePreview | null> {
  const { data, error } = await supabase.rpc("league_preview", { p_code: code });
  if (error) {
    console.error("[leagues] preview failed:", error.message);
    return null;
  }
  const row = data?.[0];
  return row ? { ...row, plan: row.plan as Plan } : null;
}

// Whether the caller already belongs to the league behind a join code.
export async function isMemberOf(leagueId: string, supabase: Client): Promise<boolean> {
  const { data } = await supabase.rpc("is_league_member", { p_league_id: leagueId });
  return data === true;
}
