import type { GrandPrixRow } from "@/lib/db";

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

// How long each session runs. Only the start time is imported, so these are the
// scheduled lengths: a practice hour, a qualifying hour, and a race window wide
// enough to cover the red flags and safety cars that stretch a Sunday. They
// decide how long a session reads as live, nothing else.
export const SESSION_MINUTES: Record<SessionKey, number> = {
  fp1: 60,
  fp2: 60,
  fp3: 60,
  sprintQualifying: 45,
  sprint: 60,
  qualifying: 60,
  race: 150,
};

export type SessionPhase = "upcoming" | "live" | "past";

export function sessionPhase(session: { key: SessionKey; at: string }, now: number): SessionPhase {
  const start = Date.parse(session.at);
  if (Number.isNaN(start) || now < start) return "upcoming";
  return now < start + SESSION_MINUTES[session.key] * 60_000 ? "live" : "past";
}
