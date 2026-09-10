import "server-only";
import type { DriverRow, GrandPrixRow, MarketRow, Plan, ScoringRuleKey, TeamRow } from "@/lib/db";
import { sortMarkets } from "@/lib/market-utils";
import type { MarketType } from "@/lib/markets";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Read side of the admin panel. Everything here runs under the service role,
// so every caller must have passed `assertAdmin` (pages sit behind the admin
// layout, actions call it directly).

export type GrandPrixSummary = GrandPrixRow & {
  marketCounts: Record<"open" | "locked" | "resolved" | "void", number>;
  pendingSuggestions: number;
};

export async function listGrandsPrix(seasonId: string): Promise<GrandPrixSummary[]> {
  const admin = createAdminSupabaseClient();
  const [{ data: gps, error: gpError }, { data: markets, error: marketError }] = await Promise.all([
    admin.from("grands_prix").select("*").eq("season_id", seasonId).order("round"),
    admin
      .from("markets")
      .select("grand_prix_id, status, suggested_result, result, grands_prix!inner(season_id)")
      .eq("grands_prix.season_id", seasonId),
  ]);
  if (gpError) throw new Error(gpError.message);
  if (marketError) throw new Error(marketError.message);

  const empty = () => ({ open: 0, locked: 0, resolved: 0, void: 0 });
  const counts = new Map<string, ReturnType<typeof empty>>();
  const pending = new Map<string, number>();
  for (const m of markets ?? []) {
    const bucket = counts.get(m.grand_prix_id) ?? empty();
    const status = m.status as keyof ReturnType<typeof empty>;
    bucket[status] = (bucket[status] ?? 0) + 1;
    counts.set(m.grand_prix_id, bucket);
    // A suggestion only needs attention while the market is still unresolved.
    if (m.suggested_result != null && m.result == null) {
      pending.set(m.grand_prix_id, (pending.get(m.grand_prix_id) ?? 0) + 1);
    }
  }

  return ((gps ?? []) as GrandPrixRow[]).map((gp) => ({
    ...gp,
    marketCounts: counts.get(gp.id) ?? empty(),
    pendingSuggestions: pending.get(gp.id) ?? 0,
  }));
}

export type GrandPrixDetail = {
  grandPrix: GrandPrixRow;
  markets: MarketRow[];
  scoredPoints: number;
  scoredRows: number;
};

export async function getGrandPrixDetail(id: string): Promise<GrandPrixDetail | null> {
  const admin = createAdminSupabaseClient();
  const { data: gp, error } = await admin
    .from("grands_prix")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!gp) return null;

  const { data: markets, error: marketError } = await admin
    .from("markets")
    .select("*")
    .eq("grand_prix_id", id);
  if (marketError) throw new Error(marketError.message);
  const rows = sortMarkets((markets ?? []) as MarketRow[]);

  // How much this weekend has already awarded, so an operator can see at a
  // glance whether a rescore actually changed anything.
  const { data: scores, error: scoreError } = await admin
    .from("scores")
    .select("points, markets!inner(grand_prix_id)")
    .eq("markets.grand_prix_id", id);
  if (scoreError) throw new Error(scoreError.message);

  return {
    grandPrix: gp as GrandPrixRow,
    markets: rows,
    scoredRows: (scores ?? []).length,
    scoredPoints: (scores ?? []).reduce((sum, s) => sum + (s.points ?? 0), 0),
  };
}

export type RosterDriver = DriverRow & { teamName: string | null };

export type Roster = { teams: TeamRow[]; drivers: RosterDriver[] };

export async function getRoster(seasonId: string): Promise<Roster> {
  const admin = createAdminSupabaseClient();
  const [{ data: teams, error: teamError }, { data: drivers, error: driverError }] =
    await Promise.all([
      admin.from("teams").select("*").eq("season_id", seasonId).order("name"),
      admin.from("drivers").select("*, teams(short_name)").eq("season_id", seasonId),
    ]);
  if (teamError) throw new Error(teamError.message);
  if (driverError) throw new Error(driverError.message);

  const roster = (drivers ?? []).map((d) => {
    const { teams: team, ...row } = d as DriverRow & { teams: { short_name: string } | null };
    return { ...row, teamName: team?.short_name ?? null };
  });
  roster.sort(
    (a, b) =>
      Number(a.teamName == null) - Number(b.teamName == null) ||
      (a.teamName ?? "").localeCompare(b.teamName ?? "") ||
      a.family_name.localeCompare(b.family_name),
  );
  return { teams: (teams ?? []) as TeamRow[], drivers: roster };
}

export type ScoringRuleCell = { marketType: MarketType; ruleKey: ScoringRuleKey; points: number };

export async function listScoringRules(seasonId: string): Promise<ScoringRuleCell[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("scoring_rules")
    .select("market_type, rule_key, points")
    .eq("season_id", seasonId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    marketType: r.market_type as MarketType,
    ruleKey: r.rule_key as ScoringRuleKey,
    points: r.points,
  }));
}

export type AdminLeague = {
  id: string;
  name: string;
  join_code: string;
  plan: Plan;
  created_at: string;
  ownerName: string | null;
  memberCount: number;
};

export async function listLeagues(seasonId: string): Promise<AdminLeague[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("leagues")
    .select(
      "id, name, join_code, plan, created_at, profiles!leagues_owner_id_fkey(display_name), league_members(user_id)",
    )
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    join_code: l.join_code,
    plan: l.plan as Plan,
    created_at: l.created_at,
    ownerName: l.profiles?.display_name ?? null,
    memberCount: (l.league_members ?? []).length,
  }));
}
