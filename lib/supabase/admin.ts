import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env, requireServiceRoleKey } from "@/lib/env";

// Service-role client: bypasses RLS. Only import from server actions and route
// handlers that have already verified the caller (assertAdmin / cron secret).
// `seasonSlug` is forwarded as the `x-season` header so season-scoped SQL
// resolves against that season instead of the active one.
export function createAdminSupabaseClient(seasonSlug?: string) {
  return createClient<Database>(env.supabaseUrl, requireServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(seasonSlug ? { global: { headers: { "x-season": seasonSlug } } } : {}),
  });
}
