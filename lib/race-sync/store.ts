// Persistence seam for the sync jobs. calendar.ts and results.ts talk to these
// interfaces; the Supabase implementation lives here, tests use in-memory
// fakes. Keeping the SQL in one place also keeps the jobs readable.

import "server-only";
import type { Json } from "@/lib/database.types";
import type { GrandPrixStatus, MultiplierReason } from "@/lib/db";
import type { MarketType } from "@/lib/markets";
import type { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

export type SeasonRef = { id: string; year: number; slug: string };

export type TeamUpsert = { provider_key: string; name: string; short_name: string };
export type DriverUpsert = {
  provider_key: string;
  code: string | null;
  number: number | null;
  given_name: string;
  family_name: string;
  team_id: string | null;
};
export type GrandPrixUpsert = {
  round: number;
  slug: string;
  name: string;
  circuit_key: string;
  circuit_name: string;
  country: string | null;
  locality: string | null;
  has_sprint: boolean;
  multiplier: number;
  multiplier_reason: MultiplierReason;
  fp1_at: string | null;
  fp2_at: string | null;
  fp3_at: string | null;
  sprint_qualifying_at: string | null;
  sprint_at: string | null;
  qualifying_at: string | null;
  race_at: string;
  status: GrandPrixStatus;
  provider_metadata: Json;
};
export type ExistingGrandPrix = GrandPrixUpsert & {
  id: string;
  multiplier_locked: boolean;
};

export interface CalendarStore {
  getSeasonByYear(year: number): Promise<SeasonRef | null>;
  // Returns provider_key → team id for every team of the season after the upsert.
  upsertTeams(seasonId: string, rows: TeamUpsert[]): Promise<Map<string, string>>;
  upsertDrivers(seasonId: string, rows: DriverUpsert[]): Promise<number>;
  listGrandsPrix(seasonId: string): Promise<ExistingGrandPrix[]>;
  upsertGrandPrix(seasonId: string, row: GrandPrixUpsert): Promise<void>;
}

export type LockedMarket = {
  id: string;
  type: MarketType;
  status: "locked";
  grand_prix_id: string;
  round: number;
  gp_status: GrandPrixStatus;
  has_sprint: boolean;
};

export interface ResultsStore {
  getSeasonByYear(year: number): Promise<SeasonRef | null>;
  lockDueMarkets(): Promise<number>;
  // Every market still waiting for a result, with its Grand Prix context.
  listLockedMarkets(seasonId: string): Promise<LockedMarket[]>;
  // provider_key → driver id for the season.
  driverIdsByKey(seasonId: string): Promise<Map<string, string>>;
  resolveMarket(marketId: string, result: Json): Promise<void>;
  suggestMarket(marketId: string, suggested: Json | null): Promise<void>;
  setGrandPrixStatus(gpId: string, status: GrandPrixStatus): Promise<void>;
}

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

async function seasonByYear(admin: AdminClient, year: number): Promise<SeasonRef | null> {
  const { data, error } = await admin
    .from("seasons")
    .select("id, year, slug")
    .eq("year", year)
    .maybeSingle();
  if (error) fail("seasons", error.message);
  return data ? { id: data.id, year: data.year, slug: data.slug } : null;
}

export function createSupabaseCalendarStore(admin: AdminClient): CalendarStore {
  return {
    getSeasonByYear: (year) => seasonByYear(admin, year),

    async upsertTeams(seasonId, rows) {
      if (rows.length > 0) {
        const { error } = await admin.from("teams").upsert(
          rows.map((r) => ({ season_id: seasonId, ...r })),
          { onConflict: "season_id,provider_key" },
        );
        if (error) fail("teams upsert", error.message);
      }
      const { data, error } = await admin
        .from("teams")
        .select("id, provider_key")
        .eq("season_id", seasonId);
      if (error) fail("teams select", error.message);
      return new Map((data ?? []).map((t) => [t.provider_key, t.id]));
    },

    async upsertDrivers(seasonId, rows) {
      if (rows.length === 0) return 0;
      const { error } = await admin.from("drivers").upsert(
        rows.map((r) => ({ season_id: seasonId, ...r })),
        { onConflict: "season_id,provider_key" },
      );
      if (error) fail("drivers upsert", error.message);
      return rows.length;
    },

    async listGrandsPrix(seasonId) {
      const { data, error } = await admin.from("grands_prix").select("*").eq("season_id", seasonId);
      if (error) fail("grands_prix select", error.message);
      return (data ?? []).map((g) => ({
        id: g.id,
        round: g.round,
        slug: g.slug,
        name: g.name,
        circuit_key: g.circuit_key,
        circuit_name: g.circuit_name,
        country: g.country,
        locality: g.locality,
        has_sprint: g.has_sprint,
        multiplier: Number(g.multiplier),
        multiplier_reason: g.multiplier_reason as MultiplierReason,
        multiplier_locked: g.multiplier_locked,
        fp1_at: g.fp1_at,
        fp2_at: g.fp2_at,
        fp3_at: g.fp3_at,
        sprint_qualifying_at: g.sprint_qualifying_at,
        sprint_at: g.sprint_at,
        qualifying_at: g.qualifying_at,
        race_at: g.race_at,
        status: g.status as GrandPrixStatus,
        provider_metadata: g.provider_metadata,
      }));
    },

    async upsertGrandPrix(seasonId, row) {
      const { error } = await admin
        .from("grands_prix")
        .upsert({ season_id: seasonId, ...row }, { onConflict: "season_id,round" });
      if (error) fail(`grands_prix upsert round ${row.round}`, error.message);
    },
  };
}

export function createSupabaseResultsStore(admin: AdminClient): ResultsStore {
  return {
    getSeasonByYear: (year) => seasonByYear(admin, year),

    async lockDueMarkets() {
      const { data, error } = await admin.rpc("lock_due_markets");
      if (error) fail("lock_due_markets", error.message);
      return data ?? 0;
    },

    async listLockedMarkets(seasonId) {
      const { data, error } = await admin
        .from("markets")
        .select(
          "id, type, status, grand_prix_id, grands_prix!inner(round, status, has_sprint, season_id)",
        )
        .eq("status", "locked")
        .eq("grands_prix.season_id", seasonId);
      if (error) fail("markets select", error.message);
      return (data ?? []).map((m) => ({
        id: m.id,
        type: m.type as MarketType,
        status: "locked" as const,
        grand_prix_id: m.grand_prix_id,
        round: m.grands_prix.round,
        gp_status: m.grands_prix.status as GrandPrixStatus,
        has_sprint: m.grands_prix.has_sprint,
      }));
    },

    async driverIdsByKey(seasonId) {
      const { data, error } = await admin
        .from("drivers")
        .select("id, provider_key")
        .eq("season_id", seasonId);
      if (error) fail("drivers select", error.message);
      return new Map((data ?? []).map((d) => [d.provider_key, d.id]));
    },

    async resolveMarket(marketId, result) {
      const { error } = await admin
        .from("markets")
        .update({ result, resolution_source: "provider", suggested_result: null })
        .eq("id", marketId)
        .eq("status", "locked");
      if (error) fail("market resolve", error.message);
    },

    async suggestMarket(marketId, suggested) {
      const { error } = await admin
        .from("markets")
        .update({ suggested_result: suggested })
        .eq("id", marketId)
        .eq("status", "locked");
      if (error) fail("market suggest", error.message);
    },

    async setGrandPrixStatus(gpId, status) {
      const { error } = await admin
        .from("grands_prix")
        .update({ status })
        .eq("id", gpId)
        .neq("status", "cancelled");
      if (error) fail("grands_prix status", error.message);
    },
  };
}
