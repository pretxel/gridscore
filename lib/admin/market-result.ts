// Turns the admin result form into a market result payload. Pure: no DB, no
// `server-only`, so the shapes are unit-tested directly.
//
// The database validates the payload again (validate_market_pick) and the
// markets trigger forces `status = 'resolved'`; this layer only gives the
// operator a precise error before the round trip.

import { type MarketPick, type MarketType, safeParsePick } from "@/lib/markets";

// What the form renders for each market type.
export type ResultControl = "driver" | "driver-or-none" | "yes-no" | "podium";

export const RESULT_CONTROL: Record<MarketType, ResultControl> = {
  pole: "driver",
  fastest_lap: "driver",
  sprint_winner: "driver",
  first_retirement: "driver-or-none",
  safety_car: "yes-no",
  podium: "podium",
};

// The sentinel the "no retirement" option submits. Not a uuid on purpose, so
// it can never collide with a driver id.
export const NO_RETIREMENT = "none";

export type ResultFormValues = {
  driver_id?: string | null;
  value?: string | null;
  p1?: string | null;
  p2?: string | null;
  p3?: string | null;
};

export type ParsedResult =
  | { ok: true; pick: MarketPick }
  | { ok: false; error: "missing" | "invalid" | "duplicate" };

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

// Builds the payload for one market type, or names why it cannot.
export function parseResultForm(type: MarketType, values: ResultFormValues): ParsedResult {
  switch (RESULT_CONTROL[type]) {
    case "yes-no": {
      const raw = clean(values.value);
      if (raw === "") return { ok: false, error: "missing" };
      if (raw !== "yes" && raw !== "no") return { ok: false, error: "invalid" };
      return finish(type, { value: raw === "yes" });
    }
    case "driver-or-none": {
      const raw = clean(values.driver_id);
      if (raw === "") return { ok: false, error: "missing" };
      return finish(type, { driver_id: raw === NO_RETIREMENT ? null : raw });
    }
    case "podium": {
      const p1 = clean(values.p1);
      const p2 = clean(values.p2);
      const p3 = clean(values.p3);
      if (!p1 || !p2 || !p3) return { ok: false, error: "missing" };
      if (p1 === p2 || p1 === p3 || p2 === p3) return { ok: false, error: "duplicate" };
      return finish(type, { p1, p2, p3 });
    }
    default: {
      const raw = clean(values.driver_id);
      if (raw === "") return { ok: false, error: "missing" };
      return finish(type, { driver_id: raw });
    }
  }
}

// Runs the same zod schema the pick path uses, so a malformed uuid is caught
// here rather than by Postgres.
function finish(type: MarketType, candidate: unknown): ParsedResult {
  const parsed = safeParsePick(type, candidate);
  if (parsed.success) return { ok: true, pick: parsed.data };
  const duplicate = parsed.error.issues.some((issue) => /distinct/.test(issue.message));
  return { ok: false, error: duplicate ? "duplicate" : "invalid" };
}

// Reads the current result (or the provider's suggestion) back into the form
// controls, so the editor opens pre-filled instead of blank.
export function resultToFormValues(
  type: MarketType,
  result: MarketPick | null | undefined,
): ResultFormValues {
  if (!result) return {};
  switch (RESULT_CONTROL[type]) {
    case "yes-no": {
      const value = (result as { value?: boolean }).value;
      return { value: value === true ? "yes" : value === false ? "no" : "" };
    }
    case "driver-or-none": {
      const id = (result as { driver_id?: string | null }).driver_id;
      return { driver_id: id ?? NO_RETIREMENT };
    }
    case "podium": {
      const p = result as { p1?: string; p2?: string; p3?: string };
      return { p1: p.p1 ?? "", p2: p.p2 ?? "", p3: p.p3 ?? "" };
    }
    default:
      return { driver_id: (result as { driver_id?: string }).driver_id ?? "" };
  }
}
