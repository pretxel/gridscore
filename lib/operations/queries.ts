import "server-only";
import type { OperationKind, OperationRunRow } from "@/lib/db";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Read side of the operations ledger for the admin control room.
export async function listRecentRuns(kind: OperationKind, limit = 20): Promise<OperationRunRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("operation_runs")
    .select("*")
    .eq("kind", kind)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as OperationRunRow[];
}

export async function lastRun(kind: OperationKind): Promise<OperationRunRow | null> {
  const runs = await listRecentRuns(kind, 1);
  return runs[0] ?? null;
}
