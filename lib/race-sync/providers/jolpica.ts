// Jolpica provider (Ergast-compatible JSON API). No credentials; the public
// endpoint allows short bursts and 500 requests/hour, so requests are spaced
// and a 429 is retried once after the Retry-After delay.

import { env } from "@/lib/env";
import type {
  RaceDataProvider,
  RemoteClassification,
  RemoteDriver,
  RemoteGrandPrix,
  RemoteQualifyingRow,
  RemoteTeam,
} from "@/lib/race-sync/types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type JolpicaOptions = {
  baseUrl?: string;
  fetch?: FetchLike;
  // Minimum spacing between requests; keeps well under the burst limit.
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

// --- Provider JSON (only the fields we read) --------------------------------

type Session = { date: string; time?: string } | undefined;

type RaceJson = {
  round: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location?: { locality?: string; country?: string };
  };
  date: string;
  time?: string;
  FirstPractice?: Session;
  SecondPractice?: Session;
  ThirdPractice?: Session;
  Qualifying?: Session;
  Sprint?: Session;
  SprintQualifying?: Session;
};

type DriverJson = {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
};

type ConstructorJson = { constructorId: string; name: string };

type ResultJson = {
  position?: string;
  positionText: string;
  Driver: { driverId: string };
  Constructor: { constructorId: string };
  laps: string;
  status: string;
  FastestLap?: { rank?: string };
};

type QualifyingJson = { position: string; Driver: { driverId: string } };

type StandingJson = {
  Driver: { driverId: string };
  Constructors?: { constructorId: string }[];
};

type Envelope = {
  MRData: {
    total?: string;
    RaceTable?: {
      Races: (RaceJson & {
        Results?: ResultJson[];
        SprintResults?: ResultJson[];
        QualifyingResults?: QualifyingJson[];
      })[];
    };
    DriverTable?: { Drivers: DriverJson[] };
    ConstructorTable?: { Constructors: ConstructorJson[] };
    StandingsTable?: { StandingsLists: { DriverStandings: StandingJson[] }[] };
  };
};

// --- Mapping helpers (pure, exported for tests) -----------------------------

export function sessionInstant(session: Session): string | null {
  if (!session?.date) return null;
  // Sessions without a time are date-only; treat them as midnight UTC.
  const time = session.time ?? "00:00:00Z";
  const iso = `${session.date}T${time}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function mapRace(race: RaceJson): RemoteGrandPrix {
  const raceAt = sessionInstant({ date: race.date, time: race.time });
  if (!raceAt) throw new Error(`race ${race.round} has no usable date`);
  return {
    round: Number(race.round),
    name: race.raceName,
    circuitKey: race.Circuit.circuitId,
    circuitName: race.Circuit.circuitName,
    country: race.Circuit.Location?.country ?? null,
    locality: race.Circuit.Location?.locality ?? null,
    race: raceAt,
    qualifying: sessionInstant(race.Qualifying),
    sprint: sessionInstant(race.Sprint),
    sprintQualifying: sessionInstant(race.SprintQualifying),
    fp1: sessionInstant(race.FirstPractice),
    fp2: sessionInstant(race.SecondPractice),
    fp3: sessionInstant(race.ThirdPractice),
    raw: race,
  };
}

export function mapDriver(driver: DriverJson, teamKey: string | null): RemoteDriver {
  const num = driver.permanentNumber ? Number(driver.permanentNumber) : null;
  return {
    key: driver.driverId,
    code: driver.code && /^[A-Z]{3}$/.test(driver.code) ? driver.code : null,
    number: num != null && Number.isInteger(num) ? num : null,
    givenName: driver.givenName,
    familyName: driver.familyName,
    teamKey,
  };
}

export function mapClassification(row: ResultJson): RemoteClassification {
  const pos = row.position ? Number(row.position) : Number.NaN;
  const rank = row.FastestLap?.rank ? Number(row.FastestLap.rank) : Number.NaN;
  return {
    position: Number.isInteger(pos) && /^\d+$/.test(row.positionText) ? pos : null,
    positionText: row.positionText,
    driverKey: row.Driver.driverId,
    teamKey: row.Constructor.constructorId,
    laps: Number(row.laps) || 0,
    status: row.status,
    fastestLapRank: Number.isInteger(rank) ? rank : null,
  };
}

// Driver → current team, from the season standings (the last constructor
// listed is the current one when a driver changed teams mid-season).
export function teamMapFromStandings(standings: StandingJson[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of standings) {
    const teams = s.Constructors ?? [];
    const last = teams[teams.length - 1];
    if (last) out.set(s.Driver.driverId, last.constructorId);
  }
  return out;
}

// --- Client -------------------------------------------------------------------

export function createJolpicaProvider(opts: JolpicaOptions = {}): RaceDataProvider {
  const baseUrl = (opts.baseUrl ?? env.jolpicaBaseUrl).replace(/\/$/, "");
  const fetchImpl: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  const minInterval = opts.minIntervalMs ?? 300;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  let lastRequestAt = 0;

  async function get(path: string): Promise<Envelope> {
    const wait = lastRequestAt + minInterval - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();

    const url = `${baseUrl}/${path}`;
    let resp = await fetchImpl(url, { cache: "no-store", headers: { accept: "application/json" } });
    if (resp.status === 429) {
      const retryAfter = Number(resp.headers.get("retry-after") ?? "1");
      await sleep((Number.isFinite(retryAfter) ? retryAfter : 1) * 1000);
      lastRequestAt = now();
      resp = await fetchImpl(url, { cache: "no-store", headers: { accept: "application/json" } });
    }
    if (!resp.ok) {
      throw new Error(`jolpica ${path} failed: ${resp.status} ${resp.statusText}`);
    }
    return (await resp.json()) as Envelope;
  }

  return {
    name: "jolpica",
    available: () => true,

    async fetchCalendar(season) {
      const body = await get(`${season}/races.json?limit=100`);
      return (body.MRData.RaceTable?.Races ?? []).map(mapRace);
    },

    async fetchDrivers(season) {
      const [drivers, standings] = await Promise.all([
        get(`${season}/drivers.json?limit=100`),
        get(`${season}/driverstandings.json?limit=100`),
      ]);
      const teams = teamMapFromStandings(
        standings.MRData.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [],
      );
      return (drivers.MRData.DriverTable?.Drivers ?? []).map((d) =>
        mapDriver(d, teams.get(d.driverId) ?? null),
      );
    },

    async fetchTeams(season) {
      const body = await get(`${season}/constructors.json?limit=100`);
      return (body.MRData.ConstructorTable?.Constructors ?? []).map((c) => ({
        key: c.constructorId,
        name: c.name,
      }));
    },

    async fetchQualifying(season, round) {
      const body = await get(`${season}/${round}/qualifying.json?limit=100`);
      const race = body.MRData.RaceTable?.Races?.[0];
      if (!race?.QualifyingResults) return null;
      return race.QualifyingResults.map((q) => ({
        driverKey: q.Driver.driverId,
        position: Number(q.position),
      }));
    },

    async fetchRaceResults(season, round) {
      const body = await get(`${season}/${round}/results.json?limit=100`);
      const race = body.MRData.RaceTable?.Races?.[0];
      if (!race?.Results) return null;
      return race.Results.map(mapClassification);
    },

    async fetchSprintResults(season, round) {
      const body = await get(`${season}/${round}/sprint.json?limit=100`);
      const race = body.MRData.RaceTable?.Races?.[0];
      if (!race?.SprintResults) return null;
      return race.SprintResults.map(mapClassification);
    },
  };
}
