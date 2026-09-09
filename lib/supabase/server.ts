import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

// `seasonSlug` scopes DB reads/writes to a season: it is sent as the
// `x-season` request header, which `active_season_id()` resolves so every
// season-scoped view/RLS/function targets that season. Omit it to fall back to
// the single active season.
export async function createServerSupabaseClient(seasonSlug?: string) {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    ...(seasonSlug ? { global: { headers: { "x-season": seasonSlug } } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // Server Components can't set cookies; the proxy refreshes them.
        }
      },
    },
  });
}
