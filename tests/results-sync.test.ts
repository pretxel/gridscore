import { describe, expect, it } from "vitest";
import type { Json } from "@/lib/database.types";
import { createJolpicaProvider } from "@/lib/race-sync/providers/jolpica";
import {
  type DueMarket,
  firstRetirement,
  hasRecentLocks,
  runResultsSync,
} from "@/lib/race-sync/results";
import type { LockedMarket, ResultsStore } from "@/lib/race-sync/store";
import type { RemoteClassification } from "@/lib/race-sync/types";
import { fixtureFetch, jolpicaFixture } from "./helpers/fixtures";

const SEASON = { id: "season-2025", year: 2025, slug: "2025" };

function row(over: Partial<RemoteClassification>): RemoteClassification {
  return {
    position: null,
    positionText: "R",
    driverKey: "x",
    teamKey: "t",
    laps: 0,
    status: "Retired",
    fastestLapRank: null,
    ...over,
  };
}

describe("firstRetirement", () => {
  it("picks the retired car with the fewest laps", () => {
    const res = firstRetirement([
      row({ driverKey: "a", laps: 10 }),
      row({ driverKey: "b", laps: 3 }),
      row({ driverKey: "c", positionText: "5", position: 5, laps: 57, status: "Finished" }),
    ]);
    expect(res).toEqual({ kind: "driver", driverKey: "b" });
  });
  it("reports a tie when several retire on the same lap", () => {
    const res = firstRetirement([
      row({ driverKey: "a", laps: 0 }),
      row({ driverKey: "b", laps: 0 }),
    ]);
    expect(res).toEqual({ kind: "tie", driverKeys: ["a", "b"] });
  });
  it("reports none when every car is classified, ignoring W/D/N", () => {
    expect(
      firstRetirement([
        row({ driverKey: "a", positionText: "1", position: 1, laps: 57, status: "Finished" }),
        row({ driverKey: "w", positionText: "W", laps: 0, status: "Withdrew" }),
        row({ driverKey: "d", positionText: "D", laps: 57, status: "Disqualified" }),
      ]),
    ).toEqual({ kind: "none" });
  });
  it("works on a real classification", () => {
    const rows = (jolpicaFixture("results-2025-1.json") as any).MRData.RaceTable.Races[0].Results;
    const mapped = rows.map((r: any) => ({
      position: /^\d+$/.test(r.positionText) ? Number(r.position) : null,
      positionText: r.positionText,
      driverKey: r.Driver.driverId,
      teamKey: r.Constructor.constructorId,
      laps: Number(r.laps),
      status: r.status,
      fastestLapRank: r.FastestLap?.rank ? Number(r.FastestLap.rank) : null,
    }));
    const res = firstRetirement(mapped);
    // Three cars went out on lap 0 in this race: a tie, never a guess.
    expect(res.kind).toBe("tie");
    if (res.kind === "tie") {
      expect(res.driverKeys).toHaveLength(3);
      for (const key of res.driverKeys) {
        expect(mapped.find((m: any) => m.driverKey === key).laps).toBe(0);
      }
    }
  });
});

describe("hasRecentLocks", () => {
  const now = new Date("2026-05-24T18:00:00Z");
  const due = (over: Partial<DueMarket>): DueMarket => ({
    locks_at: "2026-05-24T13:00:00Z",
    status: "locked",
    type: "podium",
    suggested_result: null,
    ...over,
  });
  it("is true when a provider-resolvable market locked inside the window", () => {
    expect(hasRecentLocks([due({})], now)).toBe(true);
    expect(hasRecentLocks([due({ status: "open" })], now)).toBe(true);
    expect(hasRecentLocks([due({ locks_at: "2026-05-18T13:00:00Z" })], now)).toBe(true);
  });
  it("is false for future, old or resolved markets", () => {
    expect(hasRecentLocks([due({ locks_at: "2026-05-25T13:00:00Z", status: "open" })], now)).toBe(
      false,
    );
    expect(hasRecentLocks([due({ locks_at: "2026-05-10T13:00:00Z" })], now)).toBe(false);
    expect(hasRecentLocks([due({ status: "resolved" })], now)).toBe(false);
    expect(hasRecentLocks([], now)).toBe(false);
  });
  it("ignores markets only an admin can settle", () => {
    expect(hasRecentLocks([due({ type: "safety_car" })], now)).toBe(false);
    expect(
      hasRecentLocks(
        [due({ type: "first_retirement", suggested_result: { driver_id: null } })],
        now,
      ),
    ).toBe(false);
    expect(hasRecentLocks([due({ type: "first_retirement" })], now)).toBe(true);
  });
});

type Fake = {
  store: ResultsStore;
  resolved: Map<string, Json>;
  suggested: Map<string, Json | null>;
  statuses: Map<string, string>;
};

function memoryStore(markets: LockedMarket[], driverKeys: string[]): Fake {
  const resolved = new Map<string, Json>();
  const suggested = new Map<string, Json | null>();
  const statuses = new Map<string, string>();
  const store: ResultsStore = {
    async getSeasonByYear(year) {
      return year === SEASON.year ? SEASON : null;
    },
    async lockDueMarkets() {
      return 2;
    },
    async listLockedMarkets() {
      return markets;
    },
    async driverIdsByKey() {
      return new Map(driverKeys.map((k) => [k, `id-${k}`]));
    },
    async resolveMarket(id, result) {
      resolved.set(id, result);
    },
    async suggestMarket(id, s) {
      suggested.set(id, s);
    },
    async setGrandPrixStatus(gpId, status) {
      statuses.set(gpId, status);
    },
  };
  return { store, resolved, suggested, statuses };
}

function market(id: string, type: LockedMarket["type"], gp = "gp-1", round = 1): LockedMarket {
  return {
    id,
    type,
    status: "locked",
    grand_prix_id: gp,
    round,
    gp_status: "scheduled",
    has_sprint: round === 2,
  };
}

const ALL_DRIVERS = [
  "norris",
  "piastri",
  "russell",
  "antonelli",
  "albon",
  "stroll",
  "hulkenberg",
  "leclerc",
  "hamilton",
  "max_verstappen",
  "gasly",
  "bearman",
  "ocon",
  "lawson",
  "tsunoda",
  "sainz",
  "doohan",
  "bortoleto",
  "alonso",
  "hadjar",
];

function provider2025(calls: string[] = []) {
  return createJolpicaProvider({
    baseUrl: "https://jolpica.test/ergast/f1",
    minIntervalMs: 0,
    sleep: async () => {},
    fetch: fixtureFetch(
      {
        "/2025/1/qualifying.json?limit=100": "qualifying-2025-1.json",
        "/2025/1/results.json?limit=100": "results-2025-1.json",
        "/2025/2/sprint.json?limit=100": "sprint-2025-2.json",
        "/2025/1/sprint.json?limit=100": "sprint-2025-1-none.json",
        "/2025/3/results.json?limit=100": "sprint-2025-1-none.json",
      },
      calls,
    ),
  });
}

describe("runResultsSync", () => {
  it("resolves pole, podium, fastest lap and sprint; suggests first retirement; leaves safety car", async () => {
    const fake = memoryStore(
      [
        market("m-pole", "pole"),
        market("m-podium", "podium"),
        market("m-fl", "fastest_lap"),
        market("m-fr", "first_retirement"),
        market("m-sc", "safety_car"),
        market("m-sprint", "sprint_winner", "gp-2", 2),
      ],
      ALL_DRIVERS,
    );
    const calls: string[] = [];
    const summary = await runResultsSync({
      seasonYear: 2025,
      provider: provider2025(calls),
      store: fake.store,
    });

    expect(fake.resolved.get("m-pole")).toEqual({ driver_id: "id-norris" });
    expect(fake.resolved.get("m-podium")).toEqual({
      p1: "id-norris",
      p2: "id-max_verstappen",
      p3: "id-russell",
    });
    expect(fake.resolved.get("m-fl")).toEqual({ driver_id: "id-norris" });
    expect(fake.resolved.get("m-sprint")).toEqual({ driver_id: "id-hamilton" });
    expect(fake.resolved.has("m-sc")).toBe(false);
    expect(fake.resolved.has("m-fr")).toBe(false);
    // Three cars out on lap 0: a tie leaves no suggestion for the admin.
    expect(fake.suggested.has("m-fr")).toBe(true);
    expect(fake.suggested.get("m-fr")).toBeNull();
    expect(fake.statuses.get("gp-1")).toBe("completed");
    expect(fake.statuses.get("gp-2")).toBe("in_progress");
    expect(summary).toMatchObject({
      locked: 2,
      grandsPrixChecked: 2,
      resolved: 4,
      suggested: 0,
      pending: 2,
      errors: 0,
    });
    // The race classification is fetched once for the three race markets.
    expect(calls.filter((c) => c.includes("/2025/1/results.json"))).toHaveLength(1);
  });

  it("suggests the first retirement when it is unambiguous", async () => {
    const fake = memoryStore([market("m-fr", "first_retirement", "gp-3", 3)], ["a", "b", "c"]);
    const custom = {
      ...provider2025(),
      fetchRaceResults: async () => [
        row({ driverKey: "a", positionText: "1", position: 1, laps: 50, status: "Finished" }),
        row({ driverKey: "b", laps: 12 }),
        row({ driverKey: "c", laps: 30 }),
      ],
    };
    const summary = await runResultsSync({ seasonYear: 2025, provider: custom, store: fake.store });
    expect(fake.suggested.get("m-fr")).toEqual({ driver_id: "id-b" });
    expect(summary.suggested).toBe(1);
  });

  it("marks markets pending when the session has not been run", async () => {
    const fake = memoryStore(
      [market("m-sprint", "sprint_winner", "gp-1", 1), market("m-podium", "podium", "gp-3", 3)],
      ALL_DRIVERS,
    );
    const summary = await runResultsSync({
      seasonYear: 2025,
      provider: provider2025(),
      store: fake.store,
    });
    expect(fake.resolved.size).toBe(0);
    expect(summary.pending).toBe(2);
    expect(fake.statuses.get("gp-3")).toBe("in_progress");
  });

  it("counts unknown drivers as errors without resolving", async () => {
    const fake = memoryStore([market("m-pole", "pole")], ["someone-else"]);
    const summary = await runResultsSync({
      seasonYear: 2025,
      provider: provider2025(),
      store: fake.store,
    });
    expect(fake.resolved.size).toBe(0);
    expect(summary.errors).toBe(1);
  });

  it("skips cancelled weekends and returns early with nothing locked", async () => {
    const cancelled = { ...market("m-pole", "pole"), gp_status: "cancelled" as const };
    const fake = memoryStore([cancelled], ALL_DRIVERS);
    const summary = await runResultsSync({
      seasonYear: 2025,
      provider: provider2025(),
      store: fake.store,
    });
    expect(summary.grandsPrixChecked).toBe(0);
    expect(fake.resolved.size).toBe(0);
  });

  it("records a fetch failure as an error and keeps going", async () => {
    const fake = memoryStore([market("m-pole", "pole"), market("m-sc", "safety_car")], ALL_DRIVERS);
    const broken = createJolpicaProvider({
      baseUrl: "https://jolpica.test/ergast/f1",
      minIntervalMs: 0,
      sleep: async () => {},
      fetch: async () => new Response("down", { status: 503, statusText: "Unavailable" }),
    });
    const summary = await runResultsSync({ seasonYear: 2025, provider: broken, store: fake.store });
    expect(summary.errors).toBe(1);
    expect(summary.pending).toBe(2);
  });
});
