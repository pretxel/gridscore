// Human-readable rendering of a pick or result payload. Pure; used by server
// pages and client forms alike.

import type { DriverOption } from "@/lib/driver-format";
import type { MarketPick, MarketType, PodiumPick } from "@/lib/markets";

export type PickLabels = { none: string; yes: string; no: string; unknown: string };

export type DriverLookup = ReadonlyMap<
  string,
  Pick<DriverOption, "code" | "givenName" | "familyName">
>;

export function driverShort(
  id: string | null | undefined,
  drivers: DriverLookup,
  labels: PickLabels,
): string {
  if (!id) return labels.none;
  const d = drivers.get(id);
  if (!d) return labels.unknown;
  return d.code ?? d.familyName;
}

export function formatPick(
  type: MarketType,
  pick: MarketPick | null | undefined,
  drivers: DriverLookup,
  labels: PickLabels,
): string {
  if (!pick) return "";
  switch (type) {
    case "podium": {
      const p = pick as PodiumPick;
      return [p.p1, p.p2, p.p3].map((id) => driverShort(id, drivers, labels)).join(" · ");
    }
    case "safety_car":
      return (pick as { value: boolean }).value ? labels.yes : labels.no;
    default:
      return driverShort((pick as { driver_id: string | null }).driver_id, drivers, labels);
  }
}
