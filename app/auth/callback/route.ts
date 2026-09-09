import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Land on onboarding by default: it bounces straight to the home page once a
  // display name exists, and forces the name on a first sign-in.
  const next = url.searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
