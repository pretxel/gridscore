"use server";

import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n";
import { reminderLeadSchema } from "@/lib/reminders/preferences";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SaveReminderResult = { ok: true } | { ok: false; error: "invalid" | "error" };

// Saves the caller's own reminder lead time, and the locale they are using,
// which is the language their reminder emails will be written in. RLS limits
// the write to the caller's row.
export async function saveReminderPreference(formData: FormData): Promise<SaveReminderResult> {
  const lead = reminderLeadSchema.safeParse(formData.get("lead"));
  const rawLocale = formData.get("locale");
  if (!lead.success || typeof rawLocale !== "string" || !isLocale(rawLocale)) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "error" };

  const { error } = await supabase
    .from("reminder_preferences")
    .upsert(
      { user_id: user.id, lead_time: lead.data, locale: rawLocale },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[settings] reminder preference failed:", error.message);
    return { ok: false, error: "error" };
  }
  revalidatePath(`/${rawLocale}/settings`);
  return { ok: true };
}
