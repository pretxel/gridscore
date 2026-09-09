import { type Locale, localePath } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveOnboardingRedirect } from "./gate";

// Runs the sign-in + onboarding gate against the current user. Returns a
// redirect URL or null; callers redirect when non-null.
export async function checkOnboardingGate(locale: Locale): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return localePath(locale, "/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const target = resolveOnboardingRedirect({
    displayName: profile?.display_name ?? null,
  });

  return target ? localePath(locale, target) : null;
}
