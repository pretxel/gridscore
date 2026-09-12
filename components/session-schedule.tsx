import { SessionRow } from "@/components/session-row";
import type { GrandPrixRow } from "@/lib/db";
import { type SessionKey, sessionsOf } from "@/lib/sessions";
import { cn } from "@/lib/utils";

export type { SessionKey };

// The weekend timetable, in the visitor's local time. `labels` carries the
// translated session names so this stays a Server Component; each row then
// tracks its own start on the client, because a session can go live while the
// page is sitting open.
export function SessionSchedule({
  grandPrix,
  labels,
  liveLabel,
  className,
  now = Date.now(),
}: {
  grandPrix: GrandPrixRow;
  labels: Record<SessionKey, string>;
  liveLabel: string;
  className?: string;
  now?: number;
}) {
  return (
    <ol className={cn("divide-y divide-border rounded-xl border border-border bg-card", className)}>
      {sessionsOf(grandPrix).map((s) => (
        <SessionRow key={s.key} session={s} label={labels[s.key]} liveLabel={liveLabel} now={now} />
      ))}
    </ol>
  );
}
