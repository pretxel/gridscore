import type { OperationKind } from "@/lib/db";

// Cron cadence per job, mirroring vercel.json. Kept beside the jobs so the
// operations page can show "next run" without parsing cron expressions.
// Type-only import keeps this module free of server-only code.
//
// Both jobs run daily because the Vercel Hobby plan allows one invocation per
// cron per day. On a paid plan, `sync_results` goes back to hourly: set
// `{ cron: "0 * * * *", everyMinutes: 60 }` here and in vercel.json.
export type OperationSchedule = {
  cron: string;
  everyMinutes: number;
  // Hour of day (UTC) a daily job fires; ignored for sub-daily cadences.
  hourUtc?: number;
};

const DAILY = 24 * 60;

export const OPERATION_SCHEDULES: Record<OperationKind, OperationSchedule> = {
  sync_calendar: { cron: "0 6 * * *", everyMinutes: DAILY, hourUtc: 6 },
  // The job itself skips when no market locked recently, so a daily run costs
  // nothing on a quiet week; "Run now" covers same-day corrections.
  sync_results: { cron: "0 3 * * *", everyMinutes: DAILY, hourUtc: 3 },
};

// Next UTC instant the job fires: the next top-of-hour for sub-daily jobs, the
// next occurrence of `hourUtc` for daily ones.
export function nextScheduledRun(kind: OperationKind, now: Date): Date {
  const { everyMinutes, hourUtc = 0 } = OPERATION_SCHEDULES[kind];
  if (everyMinutes < DAILY) {
    const next = new Date(now);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  }
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc),
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
