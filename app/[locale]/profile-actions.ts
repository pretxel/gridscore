"use server";

import { revalidatePath } from "next/cache";
import { displayNameSchema } from "@/lib/display-name";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Result the profile menu acts on. `error` is a code the client maps to a
// localized message ("invalid" → validation, "failed" → not signed in / DB).
export type UpdateDisplayNameResult =
  | { ok: true; displayName: string }
  | { ok: false; error: "invalid" | "failed" };

// In-place display-name update for the profile menu. Unlike onboarding's
// setDisplayName it does not redirect; it returns a result so the menu can
// stay open and show inline feedback.
export async function updateDisplayName(formData: FormData): Promise<UpdateDisplayNameResult> {
  const parsed = displayNameSchema.safeParse({
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "failed" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name })
    .eq("id", user.id);

  if (error) return { ok: false, error: "failed" };

  revalidatePath("/", "layout");
  return { ok: true, displayName: parsed.data.display_name };
}
