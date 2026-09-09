import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// True when the signed-in user's profile is flagged is_admin. Returns false for
// anonymous visitors and on any lookup error. Admins are operators, not
// contestants: excluded from leaderboards and blocked from submitting picks.
// Shared by pages (to disable controls) and server actions (to reject writes).
export async function isCurrentUserAdmin(supabase: ServerClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return false;
  return data?.is_admin ?? false;
}

// Throws unless the current user is an admin. Call at the top of every admin
// server action before touching the service-role client.
export async function assertAdmin(supabase: ServerClient): Promise<void> {
  if (!(await isCurrentUserAdmin(supabase))) throw new Error("Admin only");
}
