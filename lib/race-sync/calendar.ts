// Calendar sync: teams, drivers and Grands Prix for one season, from a
// RaceDataProvider into the CalendarStore. Idempotent: rows are upserted by
// provider key / round, admin-locked multipliers and terminal GP statuses are
// preserved.

import type { Json } from "@/lib/database.types";
import { defaultMultiplier } from "@/lib/race-sync/multipliers";
import type { CalendarStore, GrandPrixUpsert } from "@/lib/race-sync/store";
import type { CalendarSyncSummary, RaceDataProvider, RemoteGrandPrix } from "@/lib/race-sync/types";

// "<Name> <series> Team" → "<Name>", "Red Bull Racing" → "Red Bull". The series
// name never reaches the UI through this path; admins can still edit the result.
export function shortTeamName(name: string): string {
  let out = name.trim();
  out = out.replace(/\s+F\d\s+Team$/i, "");
  out = out.replace(/\s+Team$/i, "");
  if (/\s+Racing$/i.test(out) && out.split(/\s+/).length > 1) {
    out = out.replace(/\s+Racing$/i, "");
  }
  return out.slice(0, 40) || name.slice(0, 40);
}

// Circuit key → kebab-case slug. Falls back to the round when a season visits
// the same circuit twice.
export function grandPrixSlug(circuitKey: string, round: number, taken: Set<string>): string {
  const base =
    circuitKey
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `round-${round}`;
  const slug = taken.has(base) ? `${base}-r${round}` : base;
  taken.add(slug);
  return slug;
}

export function toGrandPrixUpsert(
  gp: RemoteGrandPrix,
  ctx: {
    lastRound: number;
    slug: string;
    existing?: {
      status: string;
      multiplier: number;
      multiplier_reason: string;
      multiplier_locked: boolean;
    };
  },
): GrandPrixUpsert {
  const hasSprint = gp.sprint != null;
  const computed = defaultMultiplier({
    round: gp.round,
    lastRound: ctx.lastRound,
    hasSprint,
    circuitKey: gp.circuitKey,
  });
  const keepMultiplier = ctx.existing?.multiplier_locked === true;
  const terminal = ctx.existing?.status === "completed" || ctx.existing?.status === "cancelled";
  return {
    round: gp.round,
    slug: ctx.slug,
    name: gp.name,
    circuit_key: gp.circuitKey,
    circuit_name: gp.circuitName,
    country: gp.country,
    locality: gp.locality,
    has_sprint: hasSprint,
    multiplier: keepMultiplier
      ? (ctx.existing?.multiplier ?? computed.multiplier)
      : computed.multiplier,
    multiplier_reason: keepMultiplier
      ? ((ctx.existing?.multiplier_reason as GrandPrixUpsert["multiplier_reason"]) ??
        computed.reason)
      : computed.reason,
    fp1_at: gp.fp1,
    fp2_at: gp.fp2,
    fp3_at: gp.fp3,
    sprint_qualifying_at: gp.sprintQualifying,
    sprint_at: gp.sprint,
    qualifying_at: gp.qualifying,
    race_at: gp.race,
    status: terminal ? (ctx.existing?.status as GrandPrixUpsert["status"]) : "scheduled",
    provider_metadata: gp.raw as Json,
  };
}

// Timestamps compare as instants (the DB renders +00:00, the provider Z).
function sameInstant(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a === b;
  return Date.parse(a) === Date.parse(b);
}

// True when a re-run would write the same row: skipping the upsert keeps
// updated_at meaningful.
export function sameGrandPrix(prior: GrandPrixUpsert, next: GrandPrixUpsert): boolean {
  const instants: (keyof GrandPrixUpsert)[] = [
    "fp1_at",
    "fp2_at",
    "fp3_at",
    "sprint_qualifying_at",
    "sprint_at",
    "qualifying_at",
    "race_at",
  ];
  for (const key of instants) {
    if (!sameInstant(prior[key] as string | null, next[key] as string | null)) return false;
  }
  const scalars: (keyof GrandPrixUpsert)[] = [
    "round",
    "slug",
    "name",
    "circuit_key",
    "circuit_name",
    "country",
    "locality",
    "has_sprint",
    "multiplier",
    "multiplier_reason",
    "status",
  ];
  for (const key of scalars) {
    if (prior[key] !== next[key]) return false;
  }
  return stableStringify(prior.provider_metadata) === stableStringify(next.provider_metadata);
}

// Key-order-independent serialization: jsonb columns come back with keys
// reordered, so a plain JSON.stringify would never match the provider row.
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export type CalendarSyncOptions = {
  seasonYear: number;
  provider: RaceDataProvider;
  store: CalendarStore;
};

export async function runCalendarSync(opts: CalendarSyncOptions): Promise<CalendarSyncSummary> {
  const { seasonYear, provider, store } = opts;
  const summary: CalendarSyncSummary = {
    provider: provider.name,
    seasonYear,
    grandsPrix: 0,
    grandsPrixCreated: 0,
    drivers: 0,
    teams: 0,
    multipliersSkippedLocked: 0,
    grandsPrixUnchanged: 0,
    errors: 0,
  };

  const season = await store.getSeasonByYear(seasonYear);
  if (!season) throw new Error(`season ${seasonYear} does not exist`);

  // Teams first so drivers can reference them.
  const remoteTeams = await provider.fetchTeams(seasonYear);
  const teamIds = await store.upsertTeams(
    season.id,
    remoteTeams.map((t) => ({
      provider_key: t.key,
      name: t.name,
      short_name: shortTeamName(t.name),
    })),
  );
  summary.teams = remoteTeams.length;

  const remoteDrivers = await provider.fetchDrivers(seasonYear);
  summary.drivers = await store.upsertDrivers(
    season.id,
    remoteDrivers.map((d) => ({
      provider_key: d.key,
      code: d.code,
      number: d.number,
      given_name: d.givenName,
      family_name: d.familyName,
      team_id: d.teamKey ? (teamIds.get(d.teamKey) ?? null) : null,
    })),
  );

  const calendar = await provider.fetchCalendar(seasonYear);
  const existing = new Map((await store.listGrandsPrix(season.id)).map((g) => [g.round, g]));
  const lastRound = calendar.reduce((max, gp) => Math.max(max, gp.round), 0);
  // Slugs already in use keep their value; new rounds pick a free one.
  const taken = new Set<string>();
  for (const gp of calendar.sort((a, b) => a.round - b.round)) {
    const prior = existing.get(gp.round);
    const slug = prior ? prior.slug : grandPrixSlug(gp.circuitKey, gp.round, taken);
    if (prior) taken.add(prior.slug);
    if (prior?.multiplier_locked) summary.multipliersSkippedLocked++;
    try {
      const row = toGrandPrixUpsert(gp, { lastRound, slug, existing: prior });
      if (prior && sameGrandPrix(prior, row)) {
        summary.grandsPrixUnchanged++;
        continue;
      }
      await store.upsertGrandPrix(season.id, row);
      summary.grandsPrix++;
      if (!prior) summary.grandsPrixCreated++;
    } catch (err) {
      summary.errors++;
      console.error(`[sync-calendar] round ${gp.round} failed:`, err);
    }
  }

  return summary;
}
