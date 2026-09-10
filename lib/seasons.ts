import "server-only";
import type { SeasonRow } from "@/lib/db";
import type { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type AnyClient =
  | ReturnType<typeof createAdminSupabaseClient>
  | Awaited<ReturnType<typeof createServerSupabaseClient>>;

// The season the app currently runs: newest with status = 'active'. Null when
// none is active (cold database, off-season).
export async function getActiveSeason(client: AnyClient): Promise<SeasonRow | null> {
  const { data, error } = await client
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SeasonRow | null) ?? null;
}
