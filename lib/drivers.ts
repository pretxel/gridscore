import "server-only";
import type { DriverOption } from "@/lib/driver-format";
import type { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

export type { DriverOption } from "@/lib/driver-format";

// The admin panel reads the roster under the service role; every public
// caller uses the request-scoped client. Both expose the same query surface.
type Client =
  | Awaited<ReturnType<typeof createServerSupabaseClient>>
  | ReturnType<typeof createAdminSupabaseClient>;

// Every driver of the season (inactive ones included so historic picks and
// results still resolve to a name), sorted by team then family name.
export async function listSeasonDrivers(
  seasonId: string,
  supabase: Client,
): Promise<DriverOption[]> {
  const { data, error } = await supabase
    .from("drivers")
    .select("id, code, number, given_name, family_name, active, teams(short_name, color)")
    .eq("season_id", seasonId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((d) => ({
      id: d.id,
      code: d.code,
      number: d.number,
      givenName: d.given_name,
      familyName: d.family_name,
      teamName: d.teams?.short_name ?? null,
      teamColor: d.teams?.color ?? null,
      active: d.active,
    }))
    .sort(
      (a, b) =>
        // Drivers without a team (reserves) go last, then by team and name.
        Number(a.teamName == null) - Number(b.teamName == null) ||
        (a.teamName ?? "").localeCompare(b.teamName ?? "") ||
        a.familyName.localeCompare(b.familyName),
    );
}
