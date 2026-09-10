// Provider-agnostic shapes for the race data pipeline. Every provider maps
// its payload to these; calendar.ts and results.ts never see provider JSON.

export type RemoteGrandPrix = {
  round: number;
  name: string;
  circuitKey: string;
  circuitName: string;
  country: string | null;
  locality: string | null;
  // ISO instants (UTC). Only `race` is guaranteed.
  race: string;
  qualifying: string | null;
  sprint: string | null;
  sprintQualifying: string | null;
  fp1: string | null;
  fp2: string | null;
  fp3: string | null;
  // The provider's own row, stored verbatim for admin review.
  raw: unknown;
};

export type RemoteDriver = {
  key: string;
  code: string | null;
  number: number | null;
  givenName: string;
  familyName: string;
  // Provider key of the driver's current team, when the provider knows it.
  teamKey: string | null;
};

export type RemoteTeam = {
  key: string;
  name: string;
};

// One row of a race or sprint classification.
export type RemoteClassification = {
  // Final classified position; null for unclassified rows (R, D, W, N…).
  position: number | null;
  // Provider's position text: "1".."20" or R (retired), D, W, N, E, F.
  positionText: string;
  driverKey: string;
  teamKey: string;
  laps: number;
  status: string;
  // 1 for the fastest lap of the session; null when the provider has no lap data.
  fastestLapRank: number | null;
};

export type RemoteQualifyingRow = {
  driverKey: string;
  position: number;
};

export interface RaceDataProvider {
  name: string;
  // False when the provider cannot run (missing credentials); such providers
  // are skipped without counting as an error.
  available(): boolean;
  fetchCalendar(season: number): Promise<RemoteGrandPrix[]>;
  fetchDrivers(season: number): Promise<RemoteDriver[]>;
  fetchTeams(season: number): Promise<RemoteTeam[]>;
  // The three session fetches resolve to null when the session has not been
  // run yet (the provider returns an empty race list), never to [].
  fetchQualifying(season: number, round: number): Promise<RemoteQualifyingRow[] | null>;
  fetchRaceResults(season: number, round: number): Promise<RemoteClassification[] | null>;
  fetchSprintResults(season: number, round: number): Promise<RemoteClassification[] | null>;
}

export type CalendarSyncSummary = {
  provider: string;
  seasonYear: number;
  grandsPrix: number;
  grandsPrixCreated: number;
  drivers: number;
  teams: number;
  multipliersSkippedLocked: number;
  grandsPrixUnchanged: number;
  errors: number;
};

export type ResultsSyncSummary = {
  provider: string;
  seasonYear: number;
  grandsPrixChecked: number;
  fetched: number;
  locked: number;
  resolved: number;
  suggested: number;
  pending: number;
  errors: number;
};
