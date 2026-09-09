// Market vocabulary shared by the UI, the server actions and the sync jobs.
// Mirrors the SQL side (validate_market_pick, market_locks_at): the database
// stays the authority; these schemas give friendly pre-write errors and
// narrow types.
//
// Pure module: no `server-only`, no DB access.

import { z } from "zod";

export const MARKET_TYPES = [
  "pole",
  "podium",
  "fastest_lap",
  "first_retirement",
  "safety_car",
  "sprint_winner",
] as const;

export type MarketType = (typeof MARKET_TYPES)[number];

export const MARKET_STATUSES = ["open", "locked", "resolved", "void"] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

export function isMarketType(value: string): value is MarketType {
  return (MARKET_TYPES as readonly string[]).includes(value);
}

// Markets only present on sprint weekends.
export const SPRINT_ONLY_MARKETS: readonly MarketType[] = ["sprint_winner"];

// Which Grand Prix session each market locks at. `race` is the fallback the
// SQL uses when the named session has no time.
export type LockSession = "qualifying" | "sprint" | "race";

export const MARKET_LOCK_SESSION: Record<MarketType, LockSession> = {
  pole: "qualifying",
  podium: "race",
  fastest_lap: "race",
  first_retirement: "race",
  safety_car: "race",
  sprint_winner: "sprint",
};

export type SessionTimes = {
  qualifying_at: string | null;
  sprint_at: string | null;
  race_at: string;
};

// TS mirror of public.market_locks_at(grands_prix, text).
export function marketLocksAt(gp: SessionTimes, type: MarketType): string {
  switch (MARKET_LOCK_SESSION[type]) {
    case "qualifying":
      return gp.qualifying_at ?? gp.race_at;
    case "sprint":
      return gp.sprint_at ?? gp.race_at;
    default:
      return gp.race_at;
  }
}

// The market types a Grand Prix carries.
export function marketTypesForGrandPrix(gp: { has_sprint: boolean }): MarketType[] {
  return MARKET_TYPES.filter((t) => gp.has_sprint || !SPRINT_ONLY_MARKETS.includes(t));
}

// ---------------------------------------------------------------------------
// Pick / result payload schemas (same shape for both).
// ---------------------------------------------------------------------------

const uuid = z.string().uuid();

export const driverPickSchema = z.object({ driver_id: uuid }).strict();
export const firstRetirementPickSchema = z.object({ driver_id: uuid.nullable() }).strict();
export const safetyCarPickSchema = z.object({ value: z.boolean() }).strict();
export const podiumPickSchema = z
  .object({ p1: uuid, p2: uuid, p3: uuid })
  .strict()
  .refine((p) => p.p1 !== p.p2 && p.p1 !== p.p3 && p.p2 !== p.p3, {
    message: "podium drivers must be distinct",
  });

export type DriverPick = z.infer<typeof driverPickSchema>;
export type FirstRetirementPick = z.infer<typeof firstRetirementPickSchema>;
export type SafetyCarPick = z.infer<typeof safetyCarPickSchema>;
export type PodiumPick = z.infer<typeof podiumPickSchema>;

export type PickFor<T extends MarketType> = T extends "podium"
  ? PodiumPick
  : T extends "first_retirement"
    ? FirstRetirementPick
    : T extends "safety_car"
      ? SafetyCarPick
      : DriverPick;

export type MarketPick = DriverPick | FirstRetirementPick | SafetyCarPick | PodiumPick;

const PICK_SCHEMAS: Record<MarketType, z.ZodTypeAny> = {
  pole: driverPickSchema,
  fastest_lap: driverPickSchema,
  sprint_winner: driverPickSchema,
  first_retirement: firstRetirementPickSchema,
  safety_car: safetyCarPickSchema,
  podium: podiumPickSchema,
};

export function pickSchemaFor(type: MarketType): z.ZodTypeAny {
  return PICK_SCHEMAS[type];
}

export function parsePick<T extends MarketType>(type: T, value: unknown): PickFor<T> {
  return PICK_SCHEMAS[type].parse(value) as PickFor<T>;
}

export function safeParsePick<T extends MarketType>(
  type: T,
  value: unknown,
): { success: true; data: PickFor<T> } | { success: false; error: z.ZodError } {
  const res = PICK_SCHEMAS[type].safeParse(value);
  return res.success
    ? { success: true, data: res.data as PickFor<T> }
    : { success: false, error: res.error };
}

// Driver ids a pick references, for eager validation against the season roster.
export function driverIdsInPick(type: MarketType, pick: MarketPick): string[] {
  if (type === "podium") {
    const p = pick as PodiumPick;
    return [p.p1, p.p2, p.p3];
  }
  if (type === "safety_car") return [];
  const id = (pick as DriverPick | FirstRetirementPick).driver_id;
  return id ? [id] : [];
}
