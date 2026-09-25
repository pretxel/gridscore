import "server-only";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyOptOutToken } from "./token";

// Turns reminders off for the player a signed opt-out token names. No sign-in:
// the token is the proof. Runs through the service role because the player
// may be signed out, or signed in as someone else, when they click.
export async function optOutWithToken(token: string | null | undefined): Promise<boolean> {
  const secret = env.reminderSigningSecret;
  if (!token || !secret) return false;
  const userId = verifyOptOutToken(token, secret);
  if (!userId) return false;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("reminder_preferences")
    .upsert({ user_id: userId, lead_time: "off" }, { onConflict: "user_id" });
  if (error) {
    console.error("[reminders] opt-out failed:", error.message);
    return false;
  }
  return true;
}
