// Results sync: resolves locked markets from provider classifications.
//
// Auto-resolved: pole (qualifying P1), podium (race P1–P3), fastest_lap (race
// fastest-lap rank 1), sprint_winner (sprint P1). Suggested only:
// first_retirement (lowest laps among retired cars; a tie yields no
// suggestion). Never touched: safety_car (the provider has no such data).
// A resolved market is immutable to this job; corrections go through admin.

import type { Json } from "@/lib/database.types";
import type { LockedMarket, ResultsStore } from "@/lib/race-sync/store";
import type {
  RaceDataProvider,
  RemoteClassification,
  RemoteQualifyingRow,
  ResultsSyncSummary,
} from "@/lib/race-sync/types";

export type FirstRetirement =
  | { kind: "driver"; driverKey: string }
  | { kind: "none" }
  | { kind: "tie"; driverKeys: string[] };

// Retired cars carry positionText "R". Withdrawn (W), disqualified (D), not
// classified (N) and excluded (E) are not retirements.
export function firstRetirement(rows: RemoteClassification[]): FirstRetirement {
  const retired = rows.filter((r) => r.positionText === "R");
  if (retired.length === 0) return { kind: "none" };
  const minLaps = Math.min(...retired.map((r) => r.laps));
  const earliest = retired.filter((r) => r.laps === minLaps);
  if (earliest.length === 1) return { kind: "driver", driverKey: earliest[0]?.driverKey ?? "" };
  return { kind: "tie", driverKeys: earliest.map((r) => r.driverKey) };
}

export function classifiedAt(rows: RemoteClassification[], position: number): string | null {
  return rows.find((r) => r.position === position)?.driverKey ?? null;
}

export function fastestLapDriver(rows: RemoteClassification[]): string | null {
  return rows.find((r) => r.fastestLapRank === 1)?.driverKey ?? null;
}

export function poleDriver(rows: RemoteQualifyingRow[]): string | null {
  return rows.find((r) => r.position === 1)?.driverKey ?? null;
}

export type DueMarket = {
  locks_at: string;
  status: string;
  type: string;
  suggested_result: unknown;
};

// Whether any market the provider can still settle locked inside the trailing
// window: the hourly cron self-skips otherwise, so quiet weeks and markets
// that only an admin resolves (safety car, an already-suggested first
// retirement) cost no provider requests. `?force=1` bypasses this.
export function hasRecentLocks(
  markets: DueMarket[],
  now: Date,
  windowMs = 7 * 24 * 60 * 60 * 1000,
): boolean {
  const from = now.getTime() - windowMs;
  return markets.some((m) => {
    if (m.status !== "open" && m.status !== "locked") return false;
    if (m.type === "safety_car") return false;
    if (m.type === "first_retirement" && m.suggested_result != null) return false;
    const t = Date.parse(m.locks_at);
    return t <= now.getTime() && t >= from;
  });
}

export type ResultsSyncOptions = {
  seasonYear: number;
  provider: RaceDataProvider;
  store: ResultsStore;
};

type SessionCache = {
  qualifying?: RemoteQualifyingRow[] | null;
  race?: RemoteClassification[] | null;
  sprint?: RemoteClassification[] | null;
};

export async function runResultsSync(opts: ResultsSyncOptions): Promise<ResultsSyncSummary> {
  const { seasonYear, provider, store } = opts;
  const summary: ResultsSyncSummary = {
    provider: provider.name,
    seasonYear,
    grandsPrixChecked: 0,
    fetched: 0,
    locked: 0,
    resolved: 0,
    suggested: 0,
    pending: 0,
    errors: 0,
  };

  const season = await store.getSeasonByYear(seasonYear);
  if (!season) throw new Error(`season ${seasonYear} does not exist`);

  summary.locked = await store.lockDueMarkets();
  const markets = (await store.listLockedMarkets(season.id)).filter(
    (m) => m.gp_status !== "cancelled",
  );
  if (markets.length === 0) return summary;

  const driverIds = await store.driverIdsByKey(season.id);
  const byGp = new Map<string, LockedMarket[]>();
  for (const m of markets) {
    const list = byGp.get(m.grand_prix_id);
    if (list) list.push(m);
    else byGp.set(m.grand_prix_id, [m]);
  }

  const driverId = (key: string | null): string | null =>
    key ? (driverIds.get(key) ?? null) : null;

  for (const [gpId, gpMarkets] of byGp) {
    summary.grandsPrixChecked++;
    const round = gpMarkets[0]?.round ?? 0;
    const cache: SessionCache = {};

    const load = async <K extends keyof SessionCache>(
      key: K,
      fetcher: () => Promise<SessionCache[K]>,
    ): Promise<SessionCache[K]> => {
      if (!(key in cache)) {
        try {
          cache[key] = await fetcher();
          summary.fetched++;
        } catch (err) {
          summary.errors++;
          console.error(`[sync-results] round ${round} ${key} fetch failed:`, err);
          cache[key] = null;
        }
      }
      return cache[key];
    };

    for (const m of gpMarkets) {
      try {
        if (m.type === "pole") {
          const quali = await load("qualifying", () => provider.fetchQualifying(seasonYear, round));
          const id = driverId(quali ? poleDriver(quali) : null);
          if (!quali) summary.pending++;
          else if (id) {
            await store.resolveMarket(m.id, { driver_id: id });
            summary.resolved++;
          } else summary.errors++;
        } else if (m.type === "sprint_winner") {
          const sprint = await load("sprint", () => provider.fetchSprintResults(seasonYear, round));
          const id = driverId(sprint ? classifiedAt(sprint, 1) : null);
          if (!sprint) summary.pending++;
          else if (id) {
            await store.resolveMarket(m.id, { driver_id: id });
            summary.resolved++;
          } else summary.errors++;
        } else if (
          m.type === "podium" ||
          m.type === "fastest_lap" ||
          m.type === "first_retirement"
        ) {
          const race = await load("race", () => provider.fetchRaceResults(seasonYear, round));
          if (!race) {
            summary.pending++;
            continue;
          }
          if (m.type === "podium") {
            const p1 = driverId(classifiedAt(race, 1));
            const p2 = driverId(classifiedAt(race, 2));
            const p3 = driverId(classifiedAt(race, 3));
            if (p1 && p2 && p3) {
              await store.resolveMarket(m.id, { p1, p2, p3 });
              summary.resolved++;
            } else summary.errors++;
          } else if (m.type === "fastest_lap") {
            const id = driverId(fastestLapDriver(race));
            if (id) {
              await store.resolveMarket(m.id, { driver_id: id });
              summary.resolved++;
            } else {
              // Provider has no lap data for this race: leave it to the admin.
              summary.pending++;
            }
          } else {
            const fr = firstRetirement(race);
            let suggested: Json | null = null;
            if (fr.kind === "none") suggested = { driver_id: null };
            else if (fr.kind === "driver") {
              const id = driverId(fr.driverKey);
              suggested = id ? { driver_id: id } : null;
            }
            await store.suggestMarket(m.id, suggested);
            if (suggested) summary.suggested++;
            else summary.pending++;
          }
        } else {
          // safety_car: admin only.
          summary.pending++;
        }
      } catch (err) {
        summary.errors++;
        console.error(`[sync-results] market ${m.id} (${m.type}) failed:`, err);
      }
    }

    // Race classified → the weekend is over; otherwise something is running.
    try {
      if (cache.race) await store.setGrandPrixStatus(gpId, "completed");
      else await store.setGrandPrixStatus(gpId, "in_progress");
    } catch (err) {
      summary.errors++;
      console.error(`[sync-results] status update failed for ${gpId}:`, err);
    }
  }

  return summary;
}
