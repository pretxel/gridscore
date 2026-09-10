import "server-only";
import type { Json } from "@/lib/database.types";
import type { OperationKind, OperationStatus, OperationTrigger } from "@/lib/db";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type { OperationKind, OperationStatus, OperationTrigger } from "@/lib/db";

export const OPERATION_KINDS: readonly OperationKind[] = ["sync_calendar", "sync_results"] as const;

// A job summary is a bag of counts; the conventional failure keys decide
// between "completed cleanly" and "completed with some failures".
export type OperationSummary = Record<string, unknown>;

const FAILURE_KEYS = ["errors", "failed"] as const;

export function deriveStatus(summary: OperationSummary): "success" | "partial" {
  for (const key of FAILURE_KEYS) {
    const value = summary[key];
    if (typeof value === "number" && value > 0) return "partial";
  }
  return "success";
}

export interface RunRecord {
  kind: OperationKind;
  trigger: OperationTrigger;
  status: OperationStatus;
  summary: OperationSummary;
  error: string | null;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}

// Persists one run record, returning its id (or null). A seam so tests can
// inject a fake without a database.
export type RunWriter = (record: RunRecord) => Promise<string | null>;

export interface RecordedRun<T> {
  summary: T;
  status: OperationStatus;
  runId: string | null;
}

const defaultWriter: RunWriter = async (record) => {
  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("operation_runs")
      .insert({
        kind: record.kind,
        trigger: record.trigger,
        status: record.status,
        summary: record.summary as Json,
        error: record.error,
        started_at: record.startedAt.toISOString(),
        finished_at: record.finishedAt.toISOString(),
        duration_ms: record.durationMs,
      })
      .select("id")
      .single();
    if (error) {
      console.error(`[operation-runs] failed to record ${record.kind} run:`, error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error(`[operation-runs] failed to record ${record.kind} run:`, err);
    return null;
  }
};

async function safeWrite(writer: RunWriter, record: RunRecord): Promise<string | null> {
  try {
    return await writer(record);
  } catch (err) {
    console.error(`[operation-runs] writer threw while recording ${record.kind} run:`, err);
    return null;
  }
}

// Times `fn`, derives its status and records exactly one operation_runs row,
// on success and on failure. A thrown error is recorded and re-thrown so the
// caller still surfaces it; recording is best-effort and never masks the job.
export async function recordRun<T>(
  kind: OperationKind,
  trigger: OperationTrigger,
  fn: () => Promise<T>,
  writer: RunWriter = defaultWriter,
): Promise<RecordedRun<T>> {
  const startedAt = new Date();
  let summary: T;
  try {
    summary = await fn();
  } catch (err) {
    const finishedAt = new Date();
    await safeWrite(writer, {
      kind,
      trigger,
      status: "error",
      summary: {},
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });
    throw err;
  }

  const finishedAt = new Date();
  const summaryRecord = summary as unknown as OperationSummary;
  const status = deriveStatus(summaryRecord);
  const runId = await safeWrite(writer, {
    kind,
    trigger,
    status,
    summary: summaryRecord,
    error: null,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });

  return { summary, status, runId };
}
