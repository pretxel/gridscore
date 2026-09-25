import "server-only";
import type { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ReminderCandidate, ReminderStore } from "./run";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// The reminder job's view of the database, through the service role.
export function createSupabaseReminderStore(admin: AdminClient): ReminderStore {
  return {
    async candidates(now: Date): Promise<ReminderCandidate[]> {
      const { data, error } = await admin.rpc("reminder_candidates", {
        p_now: now.toISOString(),
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReminderCandidate[];
    },
    async recordSent(userId: string, marketIds: string[]): Promise<void> {
      const { error } = await admin.from("reminder_sends").upsert(
        marketIds.map((market_id) => ({ user_id: userId, market_id })),
        { onConflict: "user_id,market_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    },
  };
}
