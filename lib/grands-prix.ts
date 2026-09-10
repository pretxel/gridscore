import "server-only";
import type { GrandPrixRow, MarketRow, SeasonRow } from "@/lib/db";
import { sortMarkets } from "@/lib/market-utils";
import { getActiveSeason } from "@/lib/seasons";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type SeasonCalendar = { season: SeasonRow; grandsPrix: GrandPrixRow[] };

// The active season's calendar ordered by round. Empty when no season is
// active or the calendar has not been imported yet.
export async function listSeasonGrandsPrix(client?: Client): Promise<SeasonCalendar | null> {
  const supabase = client ?? (await createServerSupabaseClient());
  const season = await getActiveSeason(supabase);
  if (!season) return null;
  const { data, error } = await supabase
    .from("grands_prix")
    .select("*")
    .eq("season_id", season.id)
    .order("round", { ascending: true });
  if (error) throw new Error(error.message);
  return { season, grandsPrix: (data ?? []) as GrandPrixRow[] };
}

export async function getGrandPrixBySlug(
  slug: string,
  client?: Client,
): Promise<{ season: SeasonRow; grandPrix: GrandPrixRow } | null> {
  const supabase = client ?? (await createServerSupabaseClient());
  const season = await getActiveSeason(supabase);
  if (!season) return null;
  const { data, error } = await supabase
    .from("grands_prix")
    .select("*")
    .eq("season_id", season.id)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { season, grandPrix: data as GrandPrixRow } : null;
}

// A weekend's markets in display order.
export async function getMarketsForGrandPrix(gpId: string, client?: Client): Promise<MarketRow[]> {
  const supabase = client ?? (await createServerSupabaseClient());
  const { data, error } = await supabase.from("markets").select("*").eq("grand_prix_id", gpId);
  if (error) throw new Error(error.message);
  return sortMarkets((data ?? []) as MarketRow[]);
}

// Markets for many Grands Prix at once (calendar page, my picks).
export async function getMarketsForGrandsPrix(
  gpIds: string[],
  client?: Client,
): Promise<Map<string, MarketRow[]>> {
  const out = new Map<string, MarketRow[]>();
  if (gpIds.length === 0) return out;
  const supabase = client ?? (await createServerSupabaseClient());
  const { data, error } = await supabase.from("markets").select("*").in("grand_prix_id", gpIds);
  if (error) throw new Error(error.message);
  for (const m of (data ?? []) as MarketRow[]) {
    const list = out.get(m.grand_prix_id);
    if (list) list.push(m);
    else out.set(m.grand_prix_id, [m]);
  }
  for (const [k, v] of out) out.set(k, sortMarkets(v));
  return out;
}
