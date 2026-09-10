import "server-only";
import { cookies } from "next/headers";
import type { SeasonRow } from "@/lib/db";
import { getActiveSeason } from "@/lib/seasons";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Which season the admin panel is pointed at. Defaults to the active one; a
// cookie lets an operator prepare next year (status `upcoming`) or correct a
// finished season without flipping `status` for every visitor.
export const MANAGED_SEASON_COOKIE = "gs_admin_managed_season";

export type ManagedSeason = { season: SeasonRow; seasons: SeasonRow[]; isActive: boolean };

// Every season, newest first, plus the one currently being managed. Null only
// when the database has no seasons at all.
export async function getManagedSeason(): Promise<ManagedSeason | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("seasons")
    .select("*")
    .order("year", { ascending: false });
  if (error) throw new Error(error.message);
  const seasons = (data ?? []) as SeasonRow[];
  if (seasons.length === 0) return null;

  const store = await cookies();
  const wanted = store.get(MANAGED_SEASON_COOKIE)?.value;
  const active = await getActiveSeason(admin);
  const season = seasons.find((s) => s.slug === wanted) ?? active ?? seasons[0];
  return { season, seasons, isActive: season.id === active?.id };
}
