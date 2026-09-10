import "server-only";
import { cache } from "react";
import type { Plan } from "@/lib/db";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type Viewer = {
  userId: string | null;
  email: string | null;
  plan: Plan;
  isAdmin: boolean;
  displayName: string | null;
};

const ANONYMOUS: Viewer = {
  userId: null,
  email: null,
  plan: "free",
  isAdmin: false,
  displayName: null,
};

// Who is reading this page, for the gates that every surface needs: the plan
// (sponsor slots, premium stats) and the admin flag. `cache` keeps it to one
// query per request even though the nav, the page and a slot all ask.
//
// Anonymous visitors are `free`: a missing plan must never unlock anything.
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ANONYMOUS;

  const { data, error } = await supabase
    .from("profiles")
    .select("plan, is_admin, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[viewer] profile lookup failed:", error.message);
    return { ...ANONYMOUS, userId: user.id, email: user.email ?? null };
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    plan: (data?.plan as Plan) ?? "free",
    isAdmin: data?.is_admin ?? false,
    displayName: data?.display_name ?? null,
  };
});
