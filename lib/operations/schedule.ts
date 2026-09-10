import type { OperationKind } from "@/lib/db";

// Cron cadence per job, mirroring vercel.json. Kept beside the jobs so the
// operations page can show "next run" without parsing cron expressions.
// Type-only import keeps this module free of server-only code.
export const OPERATION_SCHEDULES: Record<OperationKind, { cron: string; everyMinutes: number }> = {
  // Daily at 06:00 UTC.
  sync_calendar: { cron: "0 6 * * *", everyMinutes: 24 * 60 },
  // Hourly; the job itself skips when no market locked recently.
  sync_results: { cron: "0 * * * *", everyMinutes: 60 },
};

// Next UTC instant the job fires: the next top-of-hour for hourly jobs, the
// next 06:00 UTC for the daily one.
export function nextScheduledRun(kind: OperationKind, now: Date): Date {
  const { everyMinutes } = OPERATION_SCHEDULES[kind];
  if (everyMinutes === 60) {
    const next = new Date(now);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  }
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
