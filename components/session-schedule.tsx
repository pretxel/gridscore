import { LocalTime } from "@/components/local-time";
import type { GrandPrixRow } from "@/lib/db";
import { cn } from "@/lib/utils";

export type SessionKey =
  | "fp1"
  | "fp2"
  | "fp3"
  | "sprintQualifying"
  | "sprint"
  | "qualifying"
  | "race";

const SESSION_COLUMNS: { key: SessionKey; column: keyof GrandPrixRow }[] = [
  { key: "fp1", column: "fp1_at" },
  { key: "fp2", column: "fp2_at" },
  { key: "fp3", column: "fp3_at" },
  { key: "sprintQualifying", column: "sprint_qualifying_at" },
  { key: "sprint", column: "sprint_at" },
  { key: "qualifying", column: "qualifying_at" },
  { key: "race", column: "race_at" },
];

export function sessionsOf(gp: GrandPrixRow): { key: SessionKey; at: string }[] {
  return SESSION_COLUMNS.flatMap(({ key, column }) => {
    const at = gp[column];
    return typeof at === "string" ? [{ key, at }] : [];
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

// The weekend timetable, in the visitor's local time. `labels` carries the
// translated session names so this stays a Server Component.
export function SessionSchedule({
  grandPrix,
  labels,
  className,
  now = Date.now(),
}: {
  grandPrix: GrandPrixRow;
  labels: Record<SessionKey, string>;
  className?: string;
  now?: number;
}) {
  const sessions = sessionsOf(grandPrix);
  return (
    <ol className={cn("divide-y divide-border rounded-xl border border-border bg-card", className)}>
      {sessions.map((s) => {
        const past = Date.parse(s.at) <= now;
        const key = s.key === "race" || s.key === "qualifying" || s.key === "sprint";
        return (
          <li
            key={s.key}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-2.5 text-sm",
              past && "text-muted-foreground",
            )}
          >
            <span className={cn("flex items-center gap-2", key && "font-medium")}>
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  past ? "bg-muted-foreground/40" : key ? "bg-signal" : "bg-border",
                )}
              />
              {labels[s.key]}
            </span>
            <span className="font-mono text-xs tabular-nums">
              <LocalTime iso={s.at} format="datetime" />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
