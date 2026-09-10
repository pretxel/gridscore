import { describe, expect, it } from "vitest";
import type { Json } from "@/lib/database.types";
import { grandPrixSlug, runCalendarSync, shortTeamName } from "@/lib/race-sync/calendar";
import { createJolpicaProvider } from "@/lib/race-sync/providers/jolpica";
import type { CalendarStore, ExistingGrandPrix, GrandPrixUpsert } from "@/lib/race-sync/store";
import { fixtureFetch } from "./helpers/fixtures";

const SEASON = { id: "season-2026", year: 2026, slug: "2026" };

function memoryStore(existing: ExistingGrandPrix[] = []) {
  const teams = new Map<string, string>();
  const drivers: unknown[] = [];
  const upserts: GrandPrixUpsert[] = [];
  const store: CalendarStore = {
    async getSeasonByYear(year) {
      return year === SEASON.year ? SEASON : null;
    },
    async upsertTeams(_seasonId, rows) {
      for (const r of rows) teams.set(r.provider_key, `team-${r.provider_key}`);
      return teams;
    },
    async upsertDrivers(_seasonId, rows) {
      drivers.push(...rows);
      return rows.length;
    },
    async listGrandsPrix() {
      return existing;
    },
    async upsertGrandPrix(_seasonId, row) {
      upserts.push(row);
    },
  };
  return { store, teams, drivers, upserts };
}

function existingRow(over: Partial<ExistingGrandPrix>): ExistingGrandPrix {
  return {
    id: "gp-x",
    round: 1,
    slug: "x",
    name: "x",
    circuit_key: "x",
    circuit_name: "x",
    country: null,
    locality: null,
    has_sprint: false,
    multiplier: 1,
    multiplier_reason: "normal",
    multiplier_locked: false,
    fp1_at: null,
    fp2_at: null,
    fp3_at: null,
    sprint_qualifying_at: null,
    sprint_at: null,
    qualifying_at: null,
    race_at: "2026-01-01T00:00:00Z",
    status: "scheduled",
    provider_metadata: {},
    ...over,
  };
}

// Recursively reverses object key order, mimicking a jsonb round-trip.
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([k, v]) => [k, reverseKeys(v)]),
    );
  }
  return value;
}

function provider2026() {
  return createJolpicaProvider({
    baseUrl: "https://jolpica.test/ergast/f1",
    minIntervalMs: 0,
    sleep: async () => {},
    fetch: fixtureFetch({
      "/2026/races.json?limit=100": "races-2026.json",
      "/2026/drivers.json?limit=100": "drivers-2025.json",
      "/2026/driverstandings.json?limit=100": "driverstandings-2025.json",
      "/2026/constructors.json?limit=100": "constructors-2025.json",
    }),
  });
}

describe("shortTeamName", () => {
  it("strips championship and team suffixes", () => {
    expect(shortTeamName(`Alpine ${"F"}1 Team`)).toBe("Alpine");
    expect(shortTeamName("Red Bull Racing")).toBe("Red Bull");
    expect(shortTeamName("Racing Bulls")).toBe("Racing Bulls");
    expect(shortTeamName("McLaren")).toBe("McLaren");
    expect(shortTeamName(`Haas ${"F"}1 Team`)).toBe("Haas");
  });
});

describe("grandPrixSlug", () => {
  it("kebab-cases the circuit key and disambiguates repeats", () => {
    const taken = new Set<string>();
    expect(grandPrixSlug("albert_park", 1, taken)).toBe("albert-park");
    expect(grandPrixSlug("albert_park", 7, taken)).toBe("albert-park-r7");
    expect(grandPrixSlug("", 3, taken)).toBe("round-3");
  });
});

describe("runCalendarSync", () => {
  it("imports teams, drivers and every round with default multipliers", async () => {
    const { store, drivers, upserts } = memoryStore();
    const summary = await runCalendarSync({ seasonYear: 2026, provider: provider2026(), store });

    expect(summary).toMatchObject({
      provider: "jolpica",
      grandsPrix: 23,
      grandsPrixCreated: 23,
      teams: 10,
      errors: 0,
      multipliersSkippedLocked: 0,
    });
    expect(drivers.length).toBeGreaterThan(20);
    expect((drivers[0] as { team_id: string | null }).team_id).toMatch(/^team-/);

    const byRound = new Map(upserts.map((u) => [u.round, u]));
    expect(byRound.get(1)).toMatchObject({
      slug: "albert-park",
      has_sprint: false,
      multiplier: 1,
      multiplier_reason: "normal",
    });
    expect(byRound.get(2)).toMatchObject({
      has_sprint: true,
      multiplier: 1.25,
      multiplier_reason: "sprint",
    });
    expect(byRound.get(6)).toMatchObject({
      circuit_key: "monaco",
      multiplier: 1.5,
      multiplier_reason: "legend",
    });
    expect(byRound.get(23)).toMatchObject({ multiplier: 2, multiplier_reason: "finale" });
    expect(byRound.get(2)?.sprint_at).toBeTruthy();
    expect(byRound.get(1)?.sprint_at).toBeNull();
    expect(byRound.get(1)?.status).toBe("scheduled");
    expect(byRound.get(1)?.provider_metadata).toMatchObject({ raceName: "Australian Grand Prix" });
  });

  it("keeps locked multipliers, existing slugs and terminal statuses on re-run", async () => {
    const existing: ExistingGrandPrix[] = [
      existingRow({ id: "gp-1", round: 1, slug: "melbourne", status: "completed" }),
      existingRow({
        id: "gp-6",
        round: 6,
        slug: "monaco",
        multiplier: 3,
        multiplier_reason: "custom",
        multiplier_locked: true,
      }),
    ];
    const { store, upserts } = memoryStore(existing);
    const summary = await runCalendarSync({ seasonYear: 2026, provider: provider2026(), store });

    expect(summary.grandsPrixCreated).toBe(21);
    expect(summary.multipliersSkippedLocked).toBe(1);
    const byRound = new Map(upserts.map((u) => [u.round, u]));
    expect(byRound.get(1)).toMatchObject({ slug: "melbourne", status: "completed" });
    expect(byRound.get(6)).toMatchObject({ multiplier: 3, multiplier_reason: "custom" });
  });

  it("skips rows that would not change, so updated_at stays meaningful", async () => {
    const first = memoryStore();
    await runCalendarSync({ seasonYear: 2026, provider: provider2026(), store: first.store });
    // Feed the first run's rows back as the existing state (DB renders +00:00).
    const asExisting = first.upserts.map((u, i) => ({
      ...u,
      id: `gp-${i}`,
      multiplier_locked: false,
      race_at: u.race_at.replace("Z", "+00:00"),
      // jsonb round-trips with reordered keys.
      provider_metadata: reverseKeys(u.provider_metadata) as Json,
    }));
    const second = memoryStore(asExisting);
    const summary = await runCalendarSync({
      seasonYear: 2026,
      provider: provider2026(),
      store: second.store,
    });
    expect(summary.grandsPrixUnchanged).toBe(23);
    expect(summary.grandsPrix).toBe(0);
    expect(second.upserts).toHaveLength(0);
  });

  it("throws when the season row is missing", async () => {
    const { store } = memoryStore();
    await expect(
      runCalendarSync({ seasonYear: 1999, provider: provider2026(), store }),
    ).rejects.toThrow(/season 1999/);
  });

  it("counts a failed round as an error and continues", async () => {
    const { store } = memoryStore();
    store.upsertGrandPrix = async (_s, row) => {
      if (row.round === 3) throw new Error("boom");
    };
    const summary = await runCalendarSync({ seasonYear: 2026, provider: provider2026(), store });
    expect(summary.errors).toBe(1);
    expect(summary.grandsPrix).toBe(22);
  });
});
